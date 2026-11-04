import { supabase } from '../../lib/supabase';
import { detachSaved, hydrateListFilters } from '../lib/worklistListFilters';
import { applyPendingPickup, applyPickup, applyRecentFill, recomputeMeasure, withManualRecentFill } from '../../features/pharmacy-worklist/fillEvents';
import { OUTREACH_TONE_COLOR, addDaysMdy, callMatchesLog, enrichPharmacyMember, latestBarrierRecord, measureStatus, medLabel, outreachTone, parseMdy, reconcileMeasure, setPlanTimers, sortMeasures, todayMdy } from '../../features/pharmacy-worklist/pharmacyWorklist.utils';

function rowToMember(r) {
  return {
    id: r.id,
    initials: r.initials,
    name: r.name,
    gender: r.gender,
    age: r.age,
    dob: r.dob,
    memberId: r.member_id,
    language: r.language,
    healthPlan: r.health_plan,
    ipa: r.ipa,
    bookOfBusiness: r.book_of_business,
    status: r.status,
    statusManual: !!r.status_manual,
    assigneeId: r.assignee_id,
    assigneeName: r.assignee_name,
    assigneeInitials: r.assignee_initials,
    leadNote: r.lead_note,
    followUpDue: r.follow_up_due,
    barrier: r.barrier,
    daysInQueue: r.days_in_queue,
    prescriber: r.prescriber,
    pharmacy: r.pharmacy,
    phones: r.phones || [],
    callHistory: r.call_history || [],
    interventionLog: r.intervention_log || [],
    activityLog: r.activity_log || [],
    measures: sortMeasures(r.measures),
    patientId: r.patient_id,
    sourcePriority: r.source_priority ?? null,
    comments: r.comments || [],
    otherCareGaps: r.other_care_gaps || [],
    eligibilityStatus: r.eligibility_status || 'Active',
    termDate: r.term_date ?? null,
  };
}

// Pickups confirmed by the pharmacy: their own records, apart from claims.
function rowToPickup(r) {
  return {
    id: r.id,
    memberRowId: r.member_row_id,
    measureCode: r.measure_code,
    pickupDate: r.pickup_date,
    source: r.source,
    loggedBy: r.logged_by,
    loggedAt: r.logged_at,
    note: r.note,
  };
}
const pickupToRow = (p) => ({
  id: p.id, member_row_id: p.memberRowId, measure_code: p.measureCode, pickup_date: p.pickupDate,
  source: p.source, logged_by: p.loggedBy, logged_at: p.loggedAt, note: p.note,
});

const COLUMN_TO_FIELD = {
  status: 'status', status_manual: 'statusManual', assignee_id: 'assigneeId', assignee_name: 'assigneeName', assignee_initials: 'assigneeInitials',
  measures: 'measures', call_history: 'callHistory', intervention_log: 'interventionLog', barrier: 'barrier',
  follow_up_due: 'followUpDue', comments: 'comments',
};

// A fill left on the shelf brings the follow-up forward to the next pickup
// reminder (every 2–3 days). The follow-up stays its own date: one already
// sooner is kept.
const PICKUP_FOLLOW_UP_DAYS = 3;
function withPickupFollowUp(m, date, changes) {
  const due = addDaysMdy(date, PICKUP_FOLLOW_UP_DAYS);
  if (m.followUpDue && parseMdy(m.followUpDue) <= parseMdy(due)) return m.followUpDue;
  changes.push(`Follow-up due ${due} (pickup reminder)`);
  return due;
}

const MED_FIELD_LABEL = {
  status: 'Status', sig: 'SIG', conditions: 'Conditions', nonAdherenceReason: 'Reason for non-adherence',
  notesToMd: 'Notes to MD', internalNotes: 'Internal notes',
};

async function persist(id, patch) {
  const { error } = await supabase.from('pharmacy_worklist_members').update(patch).eq('id', id);
  if (error) console.warn('[store] pharmacy_worklist_members update failed:', error.message);
}

// A profile can be opened by worklist row id, member id, or linked patient id.
export function findPharmacyMember(members, patientId) {
  if (!patientId) return null;
  const pid = String(patientId);
  return (members || []).find(m => m.id === pid || String(m.memberId) === pid || m.patientId === pid) || null;
}

/** Pharmacy (Med Adherence) worklist: one row per member. Backed by pharmacy_worklist_members. */
export function createPharmacyWorklistSlice(set, get) {
  // Keys already tried this session (in flight, or failed), so a re-render
  // can't start a second create or retry a failing insert on every update.
  const claimTasksTried = new Set();
  // Apply `fn` to one member, append an activity-log entry, and persist the
  // listed columns (activity_log always). `fn` may return `_changes` (fill
  // updates it made); `activity` may be a function of those changes.
  const update = (memberRowId, fn, columns, activity) => {
    let next = null;
    set(s => ({
      pharmacyWorklistMembers: s.pharmacyWorklistMembers.map(m => {
        if (m.id !== memberRowId) return m;
        const { _changes, ...changed } = fn(m);
        const a = typeof activity === 'function' ? activity(_changes || []) : activity;
        next = {
          ...changed,
          // A null activity records the change without a log entry.
          activityLog: a ? [{ at: new Date().toISOString(), actor: get().currentUserProfile?.name || 'You', ...a }, ...(m.activityLog || [])] : (m.activityLog || []),
        };
        return next;
      }),
    }));
    if (!next) return;
    const patch = { activity_log: next.activityLog };
    for (const col of columns) patch[col] = next[COLUMN_TO_FIELD[col]];
    persist(memberRowId, patch);
  };

  // Takes barriers (`resolve`) and/or one intervention (`complete`) off a
  // gap's active record, or one drug's (`medId`). A new log entry carries the
  // record without them, so Active Barriers drops them, plus `resolved` /
  // `completed` for History; a drug's Reason for Non-Adherence goes when it
  // is one of the resolved barriers.
  const closeOutBarrierItems = (memberRowId, { code, medId = null, resolve = [], complete = null }) => {
    const m = get().pharmacyWorklistMembers.find(x => x.id === memberRowId);
    const measure = m?.measures.find(x => x.code === code);
    if (!measure) return;
    const med = medId ? measure.medications.find(d => d.id === medId) : null;
    const medName = med ? medLabel(med) : null;
    const latest = latestBarrierRecord(m.interventionLog, code)?.rec || { barriers: [], interventions: [], result: null };
    const strip = (r) => ({
      ...r,
      barriers: (r.barriers || []).filter(b => !resolve.includes(b)),
      interventions: (r.interventions || []).filter(v => v !== complete?.intervention),
    });
    const medications = latest.medications?.map(r => (!medId || r.id === medId ? strip(r) : r));
    const rec = medications
      ? { ...latest, medications, barriers: [...new Set(medications.flatMap(r => r.barriers))], interventions: [...new Set(medications.flatMap(r => r.interventions))] }
      : (medId ? latest : strip(latest));
    const tag = { code, ...(medName ? { medication: medName } : {}) };
    const entry = {
      date: todayMdy(),
      at: new Date().toISOString(),
      by: get().currentUserProfile?.name || 'You',
      ...(medName ? { medication: medName } : {}),
      ...(resolve.length ? { resolved: resolve.map(barrier => ({ ...tag, barrier })) } : {}),
      ...(complete ? { completed: [{ ...tag, ...complete }] } : {}),
      measures: { [code]: rec },
    };
    const where = `${code}${medName ? ` · ${medName}` : ''}`;
    const title = complete
      ? `Intervention ${complete.outcome === 'Done' ? 'done' : "didn't work"} · ${where}`
      : `Barrier resolved · ${where}`;
    const note = [complete?.intervention, resolve.length ? `${complete ? 'Resolved: ' : ''}${resolve.join(', ')}` : null].filter(Boolean).join('\n');
    update(memberRowId, x => ({
      ...x,
      measures: x.measures.map(g => (g.code !== code ? g : {
        ...g,
        medications: g.medications.map(d => ((!medId || d.id === medId) && resolve.includes(d.nonAdherenceReason) ? { ...d, nonAdherenceReason: null } : d)),
      })),
      interventionLog: [entry, ...(x.interventionLog || [])],
      barrier: resolve.includes(x.barrier) ? null : x.barrier,
    }), ['intervention_log', 'barrier', 'measures'], { t: 'note', title, note });
  };


  // One pickup record per measure. Mock rows stay local, like their members.
  const recordPickups = (memberRowId, codes, date, source) => {
    const loggedAt = new Date().toISOString();
    const loggedBy = get().currentUserProfile?.name || 'You';
    const rows = codes.map(code => ({
      id: `pu-${memberRowId}-${code.toLowerCase()}-${date.replaceAll('/', '')}-${Date.now().toString(36)}`,
      memberRowId, measureCode: code, pickupDate: date, source, loggedBy, loggedAt, note: null,
    }));
    set(s => ({ pharmacyPickups: [...rows, ...s.pharmacyPickups] }));
    if (get().pharmacyWorklistIsMock) return;
    supabase.from('pharmacy_pickup_confirmations').insert(rows.map(pickupToRow))
      .then(({ error }) => { if (error) console.warn('[store] pharmacy_pickup_confirmations insert failed:', error.message); });
  };

  return {
    pharmacyWorklistMembers: [],
    pharmacyWorklistLoading: false,
    pharmacyWorklistError: null,
    // True while the rows are the local dev mock, not Supabase data.
    pharmacyWorklistIsMock: false,
    pharmacyWorklistDidFetch: false,
    fetchPharmacyWorklistMembers: async () => {
      if (get().pharmacyWorklistDidFetch) return;
      set({ pharmacyWorklistDidFetch: true, pharmacyWorklistLoading: true, pharmacyWorklistError: null });

      const [{ data, error }, timers] = await Promise.all([
        supabase.from('pharmacy_worklist_members').select('*').order('id', { ascending: true }),
        supabase.from('pharmacy_plan_timers').select('*'),
      ]);
      // Claim timers per plan; without the table the built-in defaults stay.
      if (timers.error) console.warn('fetchPharmacyPlanTimers failed:', timers.error.message);
      else if (timers.data?.length) setPlanTimers(timers.data);

      // A failed fetch is shown as an error with Retry, never papered over
      // with mock patients: staff must not act on rows that are not real.
      // Rows already loaded this session are kept as they are.
      if (error) {
        console.warn('fetchPharmacyWorklistMembers failed:', error.message);
        set({ pharmacyWorklistLoading: false, pharmacyWorklistDidFetch: false, pharmacyWorklistError: error.message });
        return;
      }
      // The local mock only stands in for an empty table during development.
      if (!data?.length) {
        if (import.meta.env.DEV && !get().pharmacyWorklistMembers.length) {
          const { PHARMACY_WORKLIST_MEMBERS } = await import('../../features/pharmacy-worklist/data/mock');
          set({ pharmacyWorklistMembers: PHARMACY_WORKLIST_MEMBERS.map(m => ({ ...m, measures: sortMeasures(m.measures) })), pharmacyWorklistLoading: false, pharmacyWorklistIsMock: true });
          get().fetchPharmacyPickups();
          return;
        }
        set({ pharmacyWorklistLoading: false });
        return;
      }
      set({ pharmacyWorklistMembers: data.map(rowToMember), pharmacyWorklistLoading: false, pharmacyWorklistIsMock: false });
      get().fetchPharmacyPickups();
    },

    pharmacyPickups: [],
    pharmacyPickupsDidFetch: false,
    // After the members load, so the dev mock pickups only stand in for the
    // dev mock members.
    fetchPharmacyPickups: async () => {
      if (get().pharmacyPickupsDidFetch) return;
      set({ pharmacyPickupsDidFetch: true });
      const { data, error } = await supabase
        .from('pharmacy_pickup_confirmations')
        .select('*')
        .order('logged_at', { ascending: false });
      if (error) console.warn('fetchPharmacyPickups failed:', error.message);
      if (data?.length) {
        set({ pharmacyPickups: data.map(rowToPickup) });
        return;
      }
      if (import.meta.env.DEV && get().pharmacyWorklistIsMock) {
        const { PHARMACY_PICKUP_CONFIRMATIONS } = await import('../../features/pharmacy-worklist/data/mock');
        set({ pharmacyPickups: PHARMACY_PICKUP_CONFIRMATIONS });
      }
    },

    // Click-to-dial on a prescriber or pharmacy number (Snapshot).
    logPharmacyDial: (id, who, number) => {
      update(id, m => m, [], { t: 'call', title: `Dialed ${who}`, note: number });
    },

    // Recent Fill for one drug, edited in Medication Review or Gap Closure.
    // An empty date removes that confirmed fill. Next fill, Next Fill Due and
    // the projected PDC follow (recomputeMeasure).
    setPharmacyRecentFill: (id, code, medId, date) => {
      const med = get().pharmacyWorklistMembers.find(m => m.id === id)
        ?.measures.find(y => y.code === code)?.medications.find(d => d.id === medId);
      if (!med || (med.recentFill || null) === (date || null)) return;
      update(id, m => ({
        ...m,
        measures: m.measures.map(y => (y.code !== code ? y : withManualRecentFill(y, medId, date || null))),
      }), ['measures'], {
        t: 'note', title: `${code} recent fill edited · ${med.name}`, note: `${med.recentFill || '-'} → ${date || '-'}`,
      });
    },

    // Bulk Recent Fill from Medication Review: one date for several drugs,
    // across gaps (`items`: [{ code, medId }]). One activity entry.
    setPharmacyRecentFillBulk: (id, items, date) => {
      const row = get().pharmacyWorklistMembers.find(m => m.id === id);
      if (!row) return;
      const found = items
        .map(it => ({ ...it, d: row.measures.find(y => y.code === it.code)?.medications.find(x => x.id === it.medId) }))
        .filter(it => it.d);
      if (!found.length) return;
      const names = found.map(({ code, d }) => `${code} ${d.name}`);
      update(id, m => ({
        ...m,
        measures: m.measures.map(y => found.filter(it => it.code === y.code)
          .reduce((x, it) => withManualRecentFill(x, it.medId, date || null), y)),
      }), ['measures'], {
        t: 'note', title: `Recent fill ${date ? `set to ${date}` : 'cleared'} for ${names.length} drug${names.length === 1 ? '' : 's'}`, note: names.join(', '),
      });
    },

    // Per-gap status. A hand-picked status overrides the one derived from
    // fills and claims; null hands it back to the data.
    setPharmacyGapStatus: (id, code, status) => {
      const row = get().pharmacyWorklistMembers.find(m => m.id === id);
      const prev = row && enrichPharmacyMember(row).measureStatuses[code]?.gap;
      const to = status ?? (row && enrichPharmacyMember({
        ...row, measures: row.measures.map(x => (x.code === code ? { ...x, statusManual: false } : x)),
      }).measureStatuses[code]?.gap);
      update(id, m => ({
        ...m,
        measures: m.measures.map(x => (x.code !== code ? x
          : status ? { ...x, status, statusManual: true, statusManualSince: todayMdy() } : { ...x, statusManual: false })),
      }), ['measures'], {
        t: 'status_change', title: status ? `${code} status changed` : `${code} status set from data`, from: prev, to,
      });
    },

    // A PDC typed by the team wins until cleared; Fold keeps calculating it
    // underneath (`value` null goes back to the calculated PDC).
    setPharmacyPdcOverride: (id, code, value) => {
      const by = get().currentUserProfile?.name || 'You';
      update(id, m => ({
        ...m,
        measures: m.measures.map(x => (x.code !== code ? x
          : value == null ? { ...x, pdcManual: null, pdcManualOn: null, pdcManualBy: null }
          : { ...x, pdcManual: value, pdcManualOn: todayMdy(), pdcManualBy: by })),
      }), ['measures'], {
        t: 'note', title: value == null ? `${code} PDC override cleared` : `${code} PDC set to ${value}%`,
      });
    },

    // A fill whose claim did not match (none inside the plan's window), was
    // reversed, or was billed outside Part D needs rework.
    // Create that follow-up task once per fill; the marker on the measure
    // keeps it from being created again.
    // Runs when the worklist loads, in each viewer's browser; the tasks
    // table's unique source_key keeps it to one task per fill. Never for
    // mock rows: those patients don't exist, but the tasks would.
    ensureClaimFollowUpTasks: async () => {
      if (get().pharmacyWorklistIsMock) return;
      for (const row of get().pharmacyWorklistMembers) {
        for (const x of row.measures || []) {
          const recon = reconcileMeasure(x, row.healthPlan);
          if (!recon?.rework) continue;
          // Not savable gaps get no follow-up.
          if (measureStatus(x, row).gap === 'Failed for Year') continue;
          const key = `pharm-claim-unmatched-${row.id}-${x.code}-${recon.medId}-${recon.fillDate}`;
          if (x.claimFollowUpTask?.key === key || claimTasksTried.has(key)) continue;
          claimTasksTried.add(key);
          // Another viewer may have created it already; reuse theirs instead
          // of racing the unique index.
          const { data: existing } = await supabase.from('tasks').select('id').eq('source_key', key).maybeSingle();
          const created = existing || await get().createTask({
            name: `Rework: ${x.code} ${recon.status.toLowerCase()}`,
            status: 'pending', priority: 'high', due_date: todayMdy(),
            assigned_to: row.assigneeName || null, assigned_to_id: row.assigneeId || null, member: row.name,
            labels: [], meta: '', pool: null, mentions: [], attachments: 0, comments: 0,
            description: `${recon.detail}. Call ${row.pharmacy?.name || 'the pharmacy'}${row.pharmacy?.phone ? ` at ${row.pharmacy.phone}` : ''} to confirm the fill was billed to Part D.`,
            is_subtask: false, parent_task: null, parent_task_id: null,
            program_code: 'PHARM', patient_id: String(row.patientId || row.id), source_key: key,
          }, { auditUserName: 'Fold Automation' });
          if (!created) continue;
          update(row.id, m => ({
            ...m,
            measures: m.measures.map(y => (y.code === x.code ? { ...y, claimFollowUpTask: { key, taskId: created.id, createdAt: new Date().toISOString() } } : y)),
          }), ['measures'], existing ? null : { t: 'system', title: `Pharmacy rework task created (${x.code})`, note: recon.detail });
        }
      }
    },

    // Accepts AssigneeChange's { id, name, initials } shape; null unassigns.
    setPharmacyAssignee: (id, user) => {
      const prev = get().pharmacyWorklistMembers.find(m => m.id === id)?.assigneeName || 'Unassigned';
      update(id, m => ({
        ...m,
        assigneeId: user?.id || null,
        assigneeName: user?.name || null,
        assigneeInitials: user?.initials || null,
      }), ['assignee_id', 'assignee_name', 'assignee_initials'], {
        t: 'assignee_change', title: 'Assignee changed', note: `${prev} → ${user?.name || 'Unassigned'}`,
      });
    },

    // Comments on the member (Pharmacy Gap Details > Comments), newest first.
    // `comment`: { id, author, authorId, role, date, time, body, mentionIds }.
    addPharmacyComment: (id, comment) => {
      update(id, m => ({ ...m, comments: [comment, ...(m.comments || [])] }), ['comments'], {
        t: 'comment', title: 'Comment added', note: comment.body,
      });
    },
    editPharmacyComment: (id, commentId, body, mentionIds) => {
      update(id, m => ({
        ...m,
        comments: (m.comments || []).map(c => (c.id === commentId ? { ...c, body, mentionIds, edited: true } : c)),
      }), ['comments'], { t: 'comment', title: 'Comment edited', note: body });
    },
    deletePharmacyComment: (id, commentId) => {
      update(id, m => ({ ...m, comments: (m.comments || []).filter(c => c.id !== commentId) }), ['comments'], {
        t: 'comment', title: 'Comment deleted',
      });
    },

    // Medication Review edits (status, SIG, condition, non-adherence reason,
    // notes) live on the medication inside the member's measures jsonb.
    updatePharmacyMedication: (memberRowId, medId, patch) => {
      const member = get().pharmacyWorklistMembers.find(m => m.id === memberRowId);
      const measure = member?.measures.find(x => x.medications.some(d => d.id === medId));
      const med = measure?.medications.find(d => d.id === medId);
      // A Reason for Non-Adherence picked on a drug is also its gap's barrier:
      // a Barriers & Interventions entry that keeps the gap's latest
      // interventions and result, so the gap's current state stays whole.
      const reason = patch.nonAdherenceReason;
      const logReason = !!(reason && med && reason !== med.nonAdherenceReason);
      update(memberRowId, m => {
        const next = {
          ...m,
          // A status change (e.g. Discontinued) moves Next Fill Due and the
          // projected PDC, so the gap is recomputed.
          measures: m.measures.map(x => (!x.medications.some(d => d.id === medId) ? x : recomputeMeasure({
            ...x,
            medications: x.medications.map(d => (d.id === medId ? { ...d, ...patch } : d)),
          }))),
        };
        if (!logReason) return next;
        const latest = (m.interventionLog || []).find(e => e.measures?.[measure.code])?.measures[measure.code];
        const entry = {
          date: todayMdy(),
          at: new Date().toISOString(),
          by: get().currentUserProfile?.name || 'You',
          source: 'Medication review',
          medication: med.name,
          measures: { [measure.code]: { interventions: [], result: null, ...latest, barriers: [reason] } },
        };
        return { ...next, interventionLog: [entry, ...(m.interventionLog || [])] };
      }, logReason ? ['measures', 'intervention_log'] : ['measures'], {
        t: 'note', title: `Medication updated · ${med?.name || ''}`,
        note: Object.entries(patch).map(([k, v]) => `${MED_FIELD_LABEL[k] || k}: ${Array.isArray(v) ? v.join(', ') : (v || '-')}`).join(' · '),
      });
    },

    // Outreach logged from the program's Outreach step: one call-history row
    // per outreach. Pickup outcomes ripple into the record: the measure turns
    // pickup-confirmed and each medication's fill dates move (applyPickup);
    // "Pending: Pick up" marks the measure pending pickup.
    logPharmacyOutreach: (memberRowId, entry, { pickupCodes = [], pendingCodes = [], recentFillCodes = [], recentFillOutcome = null } = {}) => {
      if (pickupCodes.length) recordPickups(memberRowId, pickupCodes, entry.date, `${entry.contact || 'Pharmacy'} call`);
      update(memberRowId, m => {
        let measures = m.measures;
        let changes = [];
        if (pickupCodes.length) ({ measures, changes } = applyPickup({ ...m, measures }, pickupCodes, entry.date, 'Pickup confirmed by call'));
        if (pendingCodes.length) measures = applyPendingPickup({ ...m, measures }, pendingCodes, entry.date);
        // Pickups already added their fill above, so this only reaches drugs
        // with an older latest fill.
        if (recentFillCodes.length) measures = applyRecentFill({ ...m, measures }, recentFillCodes, entry.date, recentFillOutcome, changes);
        // Any outreach puts the member In Progress. Gaps never close here; a
        // pickup is the gap's sub-status.
        const status = 'In Progress';
        if (status !== m.status) changes.push(`Status ${m.status} → ${status}`);
        const followUpDue = pendingCodes.length ? withPickupFollowUp(m, entry.date, changes) : m.followUpDue;
        return { ...m, status, measures, followUpDue, callHistory: [entry, ...(m.callHistory || [])], _changes: changes };
      }, ['status', 'call_history', 'measures', 'follow_up_due'], (changes) => ({
        t: 'outreach', title: `Outreach · ${entry.contact} (${(entry.measures || []).join(', ')})`,
        outcome: entry.outcome, outcomeColor: OUTREACH_TONE_COLOR[outreachTone(entry.result)],
        note: [entry.note, ...changes].filter(Boolean).join('\n'),
      }));
    },

    // An outreach edited in the feed: the line (one measure of the call) is
    // saved back to the member's call history and logged in Activity. When
    // the call covered several measures with their own outcomes, only this
    // measure's part changes. Locked calls are never edited.
    editPharmacyOutreach: (memberRowId, logId, { measure, outcome, note, type, date, time }) => {
      update(memberRowId, m => ({
        ...m,
        callHistory: (m.callHistory || []).map(c => {
          if (c.locked || !callMatchesLog(c, logId)) return c;
          const parts = (c.outcome || '').split('; ');
          const perMeasure = (c.measures || []).length > 1 && parts.some(p => p.startsWith(`${measure}: `));
          return {
            ...c,
            // An older call keyed by its content keeps that key once edited.
            id: c.id || String(logId),
            outcome: perMeasure ? parts.map(p => (p.startsWith(`${measure}: `) ? `${measure}: ${outcome}` : p)).join('; ') : outcome,
            note, type, time,
            date: date ? `${date}/${c.date.slice(6)}` : c.date,
          };
        }),
      }), ['call_history'], { t: 'outreach', title: `Outreach edited (${measure})`, outcome, note });
    },

    // An outreach deleted from the feed: that measure leaves the call, and
    // the call goes once no measure is left. Logged in Activity.
    deletePharmacyOutreach: (memberRowId, logId, measures) => {
      update(memberRowId, m => ({
        ...m,
        callHistory: (m.callHistory || []).flatMap(c => {
          if (c.locked || !callMatchesLog(c, logId)) return [c];
          const left = (c.measures || []).filter(x => !measures.includes(x));
          return left.length ? [{ ...c, measures: left, logIds: (c.logIds || []).filter(id => id !== logId) }] : [];
        }),
      }), ['call_history'], { t: 'outreach', title: `Outreach deleted (${measures.join(', ')})` });
    },

    // Pharmacy verification call, locked: one call-history entry for every
    // medication and measure covered by the call (one locked action = one
    // outreach in the KPI report). Pickups run the same fill update as an
    // Outreach pickup; fills left on the shelf mark the measure pending.
    lockPharmacyVerification: (memberRowId, entry, { pickedUpCodes, pendingCodes, refillsByMed, status }) => {
      const prevStatus = get().pharmacyWorklistMembers.find(m => m.id === memberRowId)?.status;
      if (pickedUpCodes.length) recordPickups(memberRowId, pickedUpCodes, entry.date, 'Pharmacy verification');
      update(memberRowId, m => {
        let measures = m.measures;
        let changes = [];
        if (pickedUpCodes.length) ({ measures, changes } = applyPickup({ ...m, measures }, pickedUpCodes, entry.date, 'Pickup confirmed by pharmacy'));
        if (pendingCodes.length) measures = applyPendingPickup({ ...m, measures }, pendingCodes, entry.date);
        measures = measures.map(x => ({
          ...x,
          medications: x.medications.map(d => (refillsByMed[d.id] == null ? d : { ...d, refillsRemaining: refillsByMed[d.id] })),
        }));
        const followUpDue = pendingCodes.length ? withPickupFollowUp(m, entry.date, changes) : m.followUpDue;
        return { ...m, status: status || m.status, measures, followUpDue, callHistory: [entry, ...(m.callHistory || [])], _changes: changes };
      }, ['status', 'call_history', 'measures', 'follow_up_due'], (changes) => ({
        t: 'call', title: `Verification call · ${entry.party || 'Pharmacy'}: ${entry.contact} (locked)`,
        verificationId: entry.id,
        outcome: entry.outcome, outcomeColor: entry.result === 'failed' ? 'var(--status-warning)' : 'var(--status-success)',
        // What was answered for each drug, then the call note and what changed.
        note: [
          ...(entry.items || []).map(it => `${it.measure} · ${it.drug}: ${(it.steps || []).join(', ')}`),
          entry.note, ...changes, status && status !== prevStatus ? `Status ${prevStatus} → ${status}` : null,
        ].filter(Boolean).join('\n'),
      }));
    },

    // Barrier & Intervention log: one entry per call, recorded per measure
    // (barriers, interventions and result kept apart). The newest barrier
    // feeds the worklist's Barrier column.
    // `clearReasons`: the gap's lists replace what was there (Update Barriers),
    // so a gap saved with no barrier clears its drugs' reasons too. An outreach
    // only adds what it found and leaves them.
    logPharmacyInterventions: (memberRowId, entry, { clearReasons = false } = {}) => {
      update(memberRowId, m => {
        const firstBarrier = Object.values(entry.measures).flatMap(r => r.barriers)[0];
        // A measure's barrier is also each of its active medications' Reason
        // for Non-Adherence (Medication Review); set per medication, each
        // drug takes its own first barrier, and a drug cleared there loses it.
        const measures = m.measures.map(x => {
          const rec = entry.measures[x.code];
          if (!rec) return x;
          const byMed = rec.medications ? Object.fromEntries(rec.medications.map(r => [r.id, r])) : null;
          return {
            ...x,
            medications: x.medications.map(d => {
              if (d.status === 'Discontinued') return d;
              if (byMed?.[d.id]) return { ...d, nonAdherenceReason: byMed[d.id].barriers[0] || null };
              const barrier = byMed ? null : rec.barriers?.[0];
              if (barrier) return { ...d, nonAdherenceReason: barrier };
              return clearReasons && !byMed ? { ...d, nonAdherenceReason: null } : d;
            }),
          };
        });
        // `at`: when it was logged, so History and Activity can show the time.
        return { ...m, measures, interventionLog: [{ at: new Date().toISOString(), ...entry }, ...(m.interventionLog || [])], barrier: firstBarrier || m.barrier };
      }, ['intervention_log', 'barrier', 'measures'], {
        t: 'note', title: `Barriers & interventions (${Object.keys(entry.measures).join(', ')})`,
        note: Object.entries(entry.measures)
          .flatMap(([code, r]) => (r.medications
            ? r.medications.map(d => `${code} · ${d.name}: ${[...d.barriers, ...d.interventions].join(', ') || 'Cleared'}`)
            : [`${code}: ${[...r.barriers, ...r.interventions, r.result].filter(Boolean).join(', ')}`]))
          .join('\n'),
      });
    },

    // Resolves one barrier on a gap, or on one drug (`medId`).
    resolvePharmacyBarrier: (memberRowId, { code, barrier, medId = null }) => {
      closeOutBarrierItems(memberRowId, { code, medId, resolve: [barrier] });
    },

    // An intervention on a gap (or one drug) marked Done or Didn't work.
    // Either way it leaves the active list; Done can resolve the barriers it
    // addressed (`resolve`), Didn't work leaves them standing.
    completePharmacyIntervention: (memberRowId, { code, intervention, outcome, medId = null, resolve = [] }) => {
      closeOutBarrierItems(memberRowId, { code, medId, resolve: outcome === 'Done' ? resolve : [], complete: { intervention, outcome } });
    },

    // The gap a user opened from the worklist; the program's Medication
    // Review puts it first. { memberId, code }
    pharmacyFocusGap: null,

    // Pharmacy Gap Details drawer (worklist): which member and gap it shows.
    pharmacyGapDrawer: null,
    // `medId` + view 'claims' opens straight to that drug's claim history,
    // with the Outreaches tab beside it (the "Claim not matched" rework).
    // `focus`: opened from one gap (its badge or rework flag), so the drawer
    // starts scoped to that gap; otherwise to every gap that needs work.
    openPharmacyGapDrawer: (memberId, code, { medId = null, view = null, focus = false } = {}) => set({
      pharmacyGapDrawer: { memberId, code, medId, view, focus },
      pharmacyFocusGap: { memberId, code },
    }),
    // The worklist's rows in screen order, for the drawer's previous / next.
    pharmacyWorklistOrder: [],
    setPharmacyWorklistOrder: (ids) => set({ pharmacyWorklistOrder: ids }),
    closePharmacyGapDrawer: () => set({ pharmacyGapDrawer: null }),

    pharmacyFilters: hydrateListFilters('Pharmacy'),
    setPharmacyFilter: (k, vals) => set(s => {
      const next = { ...s.pharmacyFilters };
      if (!vals?.length) delete next[k];
      else next[k] = vals;
      return { pharmacyFilters: next };
    }),
    // Clearing also deselects the applied saved filter, like the other lists.
    clearPharmacyFilters: () => set(s => ({ pharmacyFilters: {}, activeSavedIdByList: detachSaved(s.activeSavedIdByList, 'Pharmacy') })),
    // Chips picked from More Filters (null: the primary set).
    pharmacyVisibleFilterKeys: null,
    setPharmacyVisibleFilterKeys: (keys) => set({ pharmacyVisibleFilterKeys: [...keys] }),
    clearPharmacyVisibleFilters: () => set({ pharmacyVisibleFilterKeys: [] }),
  };
}

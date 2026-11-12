/* Live call workspace (care management redesign prototype, Call view): the
   transcript revealed so far, the action items it has raised and the talking
   points it has covered. Pure, so the overlay and tests share it. */

/** A live_call_scripts row as the overlay reads it. */
export function scriptFromRow(r) {
  return {
    memberId: r.member_id,
    reason: r.reason || '',
    interpreter: r.interpreter || 'English',
    summary: r.summary || '',
    speakers: r.speakers || {},
    lines: Array.isArray(r.lines) ? r.lines : [],
    points: Array.isArray(r.points) ? r.points : [],
    meds: Array.isArray(r.meds) ? r.meds : [],
    items: Array.isArray(r.items) ? r.items : [],
  };
}

/** A short call for a patient with no script yet: greeting, reason, one follow-up. */
export function fallbackScript(patient = {}) {
  const name = patient.name || 'Patient';
  const first = name.split(/\s+/)[0];
  const reason = patient.relayNote || patient.admitReason || 'Care management check-in';
  return {
    memberId: String(patient.memberId || patient.id || ''),
    reason,
    interpreter: 'English',
    summary: '',
    speakers: { cm: { role: 'Care Manager' }, pt: { name, role: 'Patient', ini: patient.initials || initialsOf(name) } },
    lines: [
      { who: 'cm', t: '00:04', text: `Hi ${first}, this is {cmFirst} from your care team. Do you have a few minutes?` },
      { who: 'pt', t: '00:12', text: 'Yes, go ahead.' },
      { who: 'cm', t: '00:20', text: `I’m calling about: ${reason}.` },
      { who: 'pt', t: '00:34', text: 'Okay. That works for me.' },
      { who: 'cm', t: '00:46', text: 'Let’s set up a follow-up call in two weeks to see how it’s going.' },
      { who: 'pt', t: '00:55', text: 'Two weeks is fine, mornings are best.', hl: 'mornings are best', item: 'f1' },
    ],
    points: [{ t: 'Reason for the call', line: 3 }, { t: 'Next follow-up', line: 5 }],
    meds: [],
    items: [
      { id: 'f1', type: 'New Appointment', tone: 'primary', icon: 'solar:calendar-add-linear', where: 'Calendar', title: 'Follow-up call in 2 weeks', fields: [['Preferred Time', 'Mornings'], ['Type', 'Phone']] },
    ],
  };
}

export function initialsOf(name) {
  return (name || '').split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

/** Puts the care manager's name into `{cm}` / `{cmFirst}`. */
export function fillCm(text, cmName) {
  const name = cmName || 'your care manager';
  return String(text || '').replaceAll('{cmFirst}', name.split(/\s+/)[0]).replaceAll('{cm}', name);
}

/** Who said a line: name, role and initials. */
export function speakerOf(script, who, cmName) {
  const s = script.speakers?.[who] || {};
  if (who === 'cm') {
    const name = cmName || 'Care Manager';
    return { name, role: s.role || 'Care Manager', ini: initialsOf(name), kind: 'staff' };
  }
  return { name: s.name || 'Patient', role: s.role || 'Patient', ini: s.ini || initialsOf(s.name), kind: 'patient' };
}

/** The line split around its highlight, for <mark>. */
export function splitHighlight(text, hl) {
  const k = hl ? text.indexOf(hl) : -1;
  if (k < 0) return { before: text, mid: '', after: '' };
  return { before: text.slice(0, k), mid: hl, after: text.slice(k + hl.length) };
}

export const itemState = (session, id) => (session.accepted[id] ? 'accepted' : session.dismissed[id] ? 'dismissed' : 'pending');

/** Action items raised by the lines shown so far, in the order they came up. */
export function raisedItems(script, shown) {
  const lineOf = new Map();
  script.lines.forEach((l, i) => { if (l.item && !lineOf.has(l.item)) lineOf.set(l.item, i); });
  return script.items
    .map(it => ({ ...it, lineIdx: lineOf.has(it.id) ? lineOf.get(it.id) : -1 }))
    .filter(it => it.lineIdx >= 0 && it.lineIdx < shown)
    .sort((a, b) => a.lineIdx - b.lineIdx);
}

/** Counts and the filtered, newest-first list for the Action Items panel. */
export function actionItemsView(script, shown, session) {
  const raised = raisedItems(script, shown);
  const pending = raised.filter(it => itemState(session, it.id) === 'pending');
  const accepted = raised.filter(it => itemState(session, it.id) === 'accepted');
  const visible = raised.filter(it => {
    const st = itemState(session, it.id);
    if (session.filter === 'pending') return st === 'pending';
    if (session.filter === 'accepted') return st === 'accepted';
    return st !== 'dismissed';
  }).reverse();
  const newest = raised.length ? raised[raised.length - 1].id : null;
  return { raised, visible, pendingN: pending.length, acceptedN: accepted.length, newest, bulk: pending.filter(it => it.where !== 'Medications') };
}

/** Talking points, covered once the line that answers them is shown. */
export function pointsView(script, shown) {
  const points = script.points.map(p => {
    const done = shown > p.line;
    return { ...p, done, at: done ? `Covered at ${script.lines[p.line]?.t || ''}` : 'Not covered yet' };
  });
  return { points, done: points.filter(p => p.done).length };
}

/** What Accept says and does for an item: medication changes route, others save at wrap-up. */
export function acceptCopy(item) {
  if (item.where !== 'Medications') return { label: 'Accept', done: 'Accepted · saved with the call at wrap-up' };
  const [kind] = item.src || [];
  const label = { Reconciled: 'Reconcile', 'Refill Request': 'Send for Signature', Ordered: 'Apply Order' }[kind] || 'Send to Prescriber';
  return { label, done: `${label === 'Reconcile' ? 'Reconciled' : 'Accepted'} · saved with the call at wrap-up` };
}

/** Header status for the recording. */
export function recordingStatus(session, total) {
  if (session.consent === 'pending') return { label: 'Not Recording · Ask Consent', tone: 'warning' };
  if (session.consent === 'no') return { label: 'Not Recording · Declined', tone: 'neutral' };
  if (session.held) return { label: 'On Hold · Transcript Paused', tone: 'warning' };
  return { label: session.shown >= total ? 'Recording · Up to Date' : 'Recording', tone: 'success' };
}

/**
 * The wrap-up's draft summary and what it rests on. The drafted summary of
 * the whole call is used only when the transcript ran to the end; a call
 * ended early says what was and wasn't covered; with no recording there's
 * nothing to summarise, so the care manager writes it.
 */
export function wrapUpDraft(script, session) {
  const recorded = session.consent === 'yes';
  const shown = recorded ? session.shown : 0;
  const view = actionItemsView(script, shown, { ...session, filter: 'all' });
  const accepted = view.raised.filter(it => itemState(session, it.id) === 'accepted').map(it => ({ ...it, title: session.edits[it.id] || it.title }));
  const pending = view.raised.filter(it => itemState(session, it.id) === 'pending');
  const sources = recorded && shown > 0 ? ['Live transcript', ...(accepted.length ? [`${accepted.length} accepted ${accepted.length === 1 ? 'item' : 'items'}`] : [])] : [];

  let summary = '';
  if (recorded && shown >= script.lines.length && script.summary) {
    summary = script.summary;
  } else if (recorded && shown > 0) {
    const { points } = pointsView(script, shown);
    const covered = points.filter(p => p.done).map(p => p.t);
    const open = points.filter(p => !p.done).map(p => p.t);
    summary = [
      shown < script.lines.length ? `Call ended before the brief was finished. ${script.reason}` : script.reason,
      covered.length ? `Covered: ${covered.join('; ')}.` : '',
      open.length ? `Not covered: ${open.join('; ')}.` : '',
      accepted.length ? `Agreed on the call: ${accepted.map(it => it.title).join('; ')}.` : '',
    ].filter(Boolean).join(' ');
  }
  const medUpdates = medUpdateLines(script, session.medEdits || {});
  const stepUpdates = Object.values(session.stepsThisCall || {}).map(s => `${s.programCode} ${s.stepName}: ${s.status === 'skipped' ? 'Skipped' : 'Reviewed'}`);
  return { summary, sources, accepted, pending, recorded, medUpdates, stepUpdates };
}

const pad2 = n => String(n).padStart(2, '0');
const stamp = d => `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

/** Sentences of a summary, for the call log's key points. */
export const summaryPoints = text => String(text || '').split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map(s => s.trim()).filter(Boolean);

/** The call_details record a completed wrap-up saves (callDetailJsToDb shape). */
export function callRecordFromWrapUp({ patient, script, session, cmName, summary, disposition, seconds, endedAt = new Date(), accepted = [], medUpdates = [], stepUpdates = [] }) {
  const started = new Date(endedAt.getTime() - seconds * 1000);
  const shown = session.consent === 'yes' ? session.shown : 0;
  return {
    id: `lc-${endedAt.getTime()}`,
    patientId: String(patient.id),
    callType: 'completed',
    agentName: cmName,
    direction: 'outgoing',
    isBot: false,
    startedAt: stamp(started),
    endedAt: stamp(endedAt),
    duration: `${pad2(Math.floor(seconds / 60))}:${pad2(seconds % 60)}`,
    outcome: disposition,
    callSummary: {
      summary,
      keyPoints: summaryPoints(summary),
      actionItems: [...accepted.map(it => `${it.type}: ${it.title}`), ...medUpdates.map(m => `Medication update: ${m}`), ...stepUpdates.map(st => `Program step: ${st}`)],
    },
    callTranscript: script.lines.slice(0, shown).map(l => {
      const who = speakerOf(script, l.who, cmName);
      return { name: who.name, sender: l.who === 'cm' ? 'agent' : 'patient', text: fillCm(l.text, cmName), time: l.t };
    }),
  };
}

/* ── Medication editor (call brief → right rail) ───────────────────────── */

export const STOP_REASONS = ['Adverse Reaction', 'Duplicate', 'End of Course', 'Ineffective', 'Not Applicable to Patient', 'Not in Stock', 'Off Formulary', 'Patient Refused', 'Stopped By PCP', 'Stopped By Specialist', 'Therapeutic Change', 'Too Expensive', 'Unknown'];

/** The medication record the editor works on: what's on file, then any edit saved on this call. */
export function medRecord(med, saved) {
  return {
    status: med.status || 'Active',
    start: med.start || '',
    stop: med.stop || '',
    reason: med.reason || '',
    sig: med.sig || '',
    last: med.last || '',
    days: med.days ?? '',
    note: '',
    by: med.by || '',
    ...(saved || {}),
  };
}

const isoDays = (a, b) => Math.round((new Date(`${a}T12:00:00`) - new Date(`${b}T12:00:00`)) / 86400000);
const isoPlus = (iso, n) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + Number(n)); return d.toISOString().slice(0, 10); };
export const isoToUs = iso => (iso ? `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}` : '');

/** When an active medication's supply runs out, from the last fill and days supply. */
export function supplyOf(rec, todayIso) {
  if (rec.status !== 'Active' || !rec.last || !rec.days) return null;
  const out = isoPlus(rec.last, rec.days);
  const left = isoDays(out, todayIso);
  return { out, left, text: left < 0 ? `Ran out ${isoToUs(out)}` : `Runs out ${isoToUs(out)} · ${left} ${left === 1 ? 'day' : 'days'} left` };
}

/** The badge a medication shows in the brief: as on file, or as updated on this call. */
export function medBadge(med, saved, todayIso) {
  if (!saved) return { label: med.st, tone: med.tone };
  if (saved.status === 'Stopped') return { label: saved.reason ? `Stopped: ${saved.reason}` : 'Stopped', tone: 'neutral' };
  const sup = supplyOf(medRecord(med, saved), todayIso);
  if (!sup) return { label: 'Updated', tone: 'success' };
  return { label: sup.left < 0 ? 'Out of supply' : `${sup.left} days left`, tone: sup.left <= 7 ? 'danger' : 'success' };
}

/** Whether the editor's draft can be saved, and why not. */
export function medDraftError(d) {
  if (!d.status || !d.start || !String(d.sig || '').trim()) return 'Status, start date and sig are required.';
  if (d.status === 'Stopped') {
    if (!d.stop || !d.reason) return 'A stopped medication needs a stop date and a reason.';
    if (d.stop < d.start) return 'Stop date cannot be before the start date.';
  }
  return '';
}

/** Lines shown so far that mention the medication (by its first word). */
export function medMentions(script, shown, med, limit = 3) {
  const word = med.n.split(' ')[0].toLowerCase();
  return script.lines
    .map((l, i) => ({ ...l, i }))
    .filter(l => l.i < shown && l.text.toLowerCase().includes(word))
    .slice(0, limit);
}

/** One line per medication updated on the call, for the wrap-up and the call log. */
export function medUpdateLines(script, medEdits) {
  return script.meds.filter(m => medEdits[m.n]).map(m => {
    const r = medRecord(m, medEdits[m.n]);
    return r.status === 'Stopped' ? `${m.n}: stopped ${isoToUs(r.stop)} (${r.reason})` : `${m.n}: ${r.sig}`;
  });
}

import { useMemo } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { useOutreachTab } from '../../patient/left-panel/tabs/outreach/OutreachTab/useOutreachTab';
import { MEASURE_ORDER, OUTREACH_TONE_COLOR, callKey, outreachTone } from '../pharmacyWorklist.utils';
import { schemaOutcomeItems } from '../interventionSchema';
import { fillEventFor, setsRecentFill } from '../fillEvents';
import { mapOutcomesToIntervention } from '../outcomeMapping';
import { DEFAULT_CALL_TYPES } from '../../patient/left-panel/tabs/outreach/OutreachTab/OutreachTab.utils';

// Measure pills (MAD / MAH / MAC) pick outcomes from the Medication Adherence
// Intervention Schema; any other program pill keeps the standard list.
const measureOutcomeItems = (status, progs) => (
  progs.length && progs.every(p => MEASURE_ORDER.includes(p)) ? schemaOutcomeItems(status) : null
);

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// The member's saved outreach (call history) in the Outreach Activity feed's
// shape, month-grouped, so the feed shows what was actually logged for this
// member: and still shows it after leaving and reopening the step.
function toLogGroups(callHistory) {
  const groups = [];
  (callHistory || []).forEach((c) => {
    const [mm, dd, yyyy] = c.date.split('/');
    const key = `${mm}-${yyyy}`;
    let g = groups.find(x => x.id === key);
    if (!g) { g = { id: key, label: `${MONTH[Number(mm) - 1]} ${yyyy}`, logs: [] }; groups.push(g); }
    const verification = c.kind === 'pharmacy-verification';
    g.logs.push({
      id: callKey(c),
      locked: !!c.locked,
      type: c.type || 'Call',
      date: `${mm}/${dd}`,
      time: c.time || '',
      author: c.by,
      title: verification ? `Verification call · ${c.party || 'Pharmacy'}: ${c.contact} (locked)` : (c.title ? `${c.title} · ${c.contact}` : `Outgoing Call · ${c.contact}`),
      programs: c.measures || [],
      // Stored as "Side effects: Experienced" (outcome matching relies on
      // it); shown as "Side effects: Experienced".
      outcome: c.outcome?.replaceAll(' \u2014 ', ': '),
      outcomeColor: OUTREACH_TONE_COLOR[outreachTone(c.result)],
      note: c.note,
    });
  });
  return groups;
}

// Adherence calls also go to the pharmacy and the prescriber.
const CALL_TYPES = [...DEFAULT_CALL_TYPES, 'Pharmacy', 'Prescriber'];

// The PHARM outreach state: exactly the outreach form every program uses
// (same program pills), with the member's open measures (MAD / MAH / MAC)
// added and pre-selected in place of PHARM, so outcomes are logged per
// measure while the other care programs stay selectable. Shared by the
// program's Outreach step and the Pharmacy Gap Details drawer.
export function usePharmacyOutreachTab(member, { programCode = 'PHARM', ...options } = {}) {
  const logPharmacyOutreach = useAppStore(s => s.logPharmacyOutreach);
  const logPharmacyInterventions = useAppStore(s => s.logPharmacyInterventions);
  const editPharmacyOutreach = useAppStore(s => s.editPharmacyOutreach);
  const deletePharmacyOutreach = useAppStore(s => s.deletePharmacyOutreach);

  // OutreachTab reads this once per mount (it keeps its own feed after that,
  // and a save appends to both it and the store).
  const logGroups = toLogGroups(member?.callHistory);

  const measures = useMemo(() => {
    const open = new Set((member?.measures || []).map(x => x.code));
    return open.size ? MEASURE_ORDER.filter(c => open.has(c)) : MEASURE_ORDER;
  }, [member]);

  // One outreach → one call-history row covering every measure it touched,
  // so the worklist Outreach cell counts it once. Pickup outcomes update the
  // measure and its medications' fill dates (see fillEvents.js).
  const handleSaved = (saved, { isEdit, editedId }) => {
    const entries = saved.filter(e => MEASURE_ORDER.includes(e.programs[0]));
    if (!member || !entries.length) return;
    // An edit saves the changed line back to the call it belongs to; it does
    // not replay pickups or fills.
    if (isEdit) {
      const e = entries[0];
      editPharmacyOutreach(member.id, editedId, {
        measure: e.programs[0], outcome: e.outcome, note: e.note, type: e.type, date: e.date, time: e.time,
      });
      return;
    }
    const first = entries[0];
    const outcomesOf = (e) => (e.outcomes?.length ? e.outcomes : [e.outcome]);
    // Same outcomes on every measure (a common note) read once; differing
    // per-measure outcomes keep their measure prefix.
    const distinct = new Set(entries.map(e => outcomesOf(e).join(', ')));
    const outcomes = distinct.size === 1 ? [...distinct] : entries.map(e => `${e.programs[0]}: ${outcomesOf(e).join(', ')}`);
    const codesWith = (event) => entries
      .filter(e => outcomesOf(e).some(o => fillEventFor(o) === event))
      .map(e => e.programs[0]);
    const firstOutcome = outcomesOf(first)[0] || '';
    logPharmacyOutreach(member.id, {
      id: `out-${first.id}`,
      // The feed lines this call was saved from, so editing or deleting one
      // finds the call.
      logIds: entries.map(e => e.id),
      date: `${first.date}/${new Date().getFullYear()}`,
      time: first.time,
      type: first.type,
      title: first.title,
      // Schema outcomes are "Stakeholder · Outcome"; the stakeholder is who was contacted.
      contact: firstOutcome.includes(' · ') ? firstOutcome.split(' · ')[0] : first.title,
      outcome: outcomes.join('; '),
      result: (first.outcomeColor || '').includes('error') ? 'failed' : (first.outcomeColor || '').includes('warning') ? 'note' : 'success',
      by: first.author,
      note: [...new Set(entries.map(e => e.note).filter(Boolean))].join(' / '),
      measures: entries.map(e => e.programs[0]),
    }, {
      pickupCodes: codesWith('pickup'),
      pendingCodes: codesWith('pending-pickup'),
      // Pickup / refill-approved outcomes set each gap's Recent Fill Date.
      recentFillCodes: entries.filter(e => outcomesOf(e).some(setsRecentFill)).map(e => e.programs[0]),
      recentFillOutcome: outcomesOf(entries.find(e => outcomesOf(e).some(setsRecentFill)) || first).find(setsRecentFill),
    });

    // Barriers / interventions / results picked as outcomes also go to the
    // Barrier & Intervention log, per measure.
    const byMeasure = {};
    for (const e of entries) {
      const rec = mapOutcomesToIntervention(outcomesOf(e));
      if (rec) byMeasure[e.programs[0]] = rec;
    }
    if (Object.keys(byMeasure).length) {
      logPharmacyInterventions(member.id, {
        date: `${first.date}/${new Date().getFullYear()}`,
        by: first.author,
        note: [...new Set(entries.map(e => e.note).filter(Boolean))].join(' / '),
        source: 'Outreach',
        // Its History line wears the outreach type's icon (call, SMS, email…).
        outreachType: first.type,
        measures: byMeasure,
      });
    }
  };

  return useOutreachTab({
    programsLabel: 'Select Programs/Gaps',
    initialLogGroups: logGroups,
    defaultPrograms: measures,
    scopedProgram: programCode,
    activityProgramCode: programCode,
    defaultLogFor: 'care-program',
    outcomeItems: measureOutcomeItems,
    callTypeOptions: CALL_TYPES,
    onSaved: handleSaved,
    // One feed line can stand for a call over several gaps: all of them go.
    onDeleted: (log) => { if (member && log.programs?.length) deletePharmacyOutreach(member.id, log.id, log.programs); },
    ...options,
  });
}

import { useMemo, useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { MEASURE_ORDER, medLabel, todayMdy } from '../pharmacyWorklist.utils';

// Newest log entry that recorded this measure.
export function latestFor(log, code) {
  const e = (log || []).find(x => x.measures?.[code]);
  return e ? { date: e.date, source: e.source, rec: e.measures[code] } : null;
}

export const EMPTY = { barriers: [], interventions: [] };
const sameSet = (a, b) => a.length === b.length && a.every(v => b.includes(v));
const samePair = (a, b) => sameSet(a.barriers, b.barriers) && sameSet(a.interventions, b.interventions);
const union = (lists) => [...new Set(lists.flat())];
export const activeMeds = (x) => x.medications.filter(d => d.status !== 'Discontinued');

// A gap's editable state from its latest record: one pair for the whole gap,
// or (when it was last set per medication) one pair per drug.
function stateFrom(x, rec) {
  const byMed = Object.fromEntries((rec?.medications || []).map(r => [r.id, r]));
  return {
    perMed: !!rec?.medications?.length,
    gap: { barriers: rec?.barriers || [], interventions: rec?.interventions || [] },
    meds: Object.fromEntries(activeMeds(x).map(d => [d.id, {
      barriers: byMed[d.id]?.barriers || [], interventions: byMed[d.id]?.interventions || [],
    }])),
  };
}
const isChanged = (x, s, base) => s.perMed !== base.perMed || (s.perMed
  ? activeMeds(x).some(d => !samePair(s.meds[d.id] || EMPTY, base.meds[d.id] || EMPTY))
  : !samePair(s.gap, base.gap));

// The record saved for a gap. Per medication, the gap-level lists are the
// union of its drugs' so readers that only know gaps still see them.
function recordFor(x, s) {
  if (!s.perMed) return { ...s.gap, result: null };
  const medications = activeMeds(x).map(d => ({ id: d.id, name: medLabel(d), ...(s.meds[d.id] || EMPTY) }));
  return {
    barriers: union(medications.map(m => m.barriers)),
    interventions: union(medications.map(m => m.interventions)),
    result: null,
    medications,
  };
}

// A gap's record with barriers / interventions added to one drug. A gap-wide
// record turns per medication first (each drug keeping the gap's lists, as
// the form's switch does), so the other drugs are unchanged.
export function recordWithMedAdditions(x, rec, medId, add) {
  const s = stateFrom(x, rec);
  const meds = s.perMed ? { ...s.meds } : Object.fromEntries(activeMeds(x).map(d => [d.id, { ...s.gap }]));
  const cur = meds[medId] || EMPTY;
  meds[medId] = { barriers: union([cur.barriers, add.barriers]), interventions: union([cur.interventions, add.interventions]) };
  return recordFor(x, { ...s, perMed: true, meds });
}

// The barrier form's state and save, apart from its layout, so a host (the
// gap drawer) can put Save in its own header, as it does for Outreach.
export function useBarrierForm(member) {
  const logInterventions = useAppStore(s => s.logPharmacyInterventions);
  const currentUser = useAppStore(s => s.currentUserProfile);
  const showToast = useAppStore(s => s.showToast);

  const measures = useMemo(() => (member?.measures || [])
    .toSorted((a, b) => MEASURE_ORDER.indexOf(a.code) - MEASURE_ORDER.indexOf(b.code)), [member]);
  const [draft, setDraft] = useState({});
  const [note, setNote] = useState('');
  const base = (x) => stateFrom(x, latestFor(member?.interventionLog, x.code)?.rec);
  const stateOf = (x) => draft[x.code] || base(x);
  const patch = (x, p) => setDraft(d => ({ ...d, [x.code]: { ...stateOf(x), ...p } }));
  const patchGap = (x, p) => patch(x, { gap: { ...stateOf(x).gap, ...p } });
  const patchMed = (x, id, p) => {
    const s = stateOf(x);
    patch(x, { meds: { ...s.meds, [id]: { ...(s.meds[id] || EMPTY), ...p } } });
  };
  // Switching to per medication starts each drug from the gap's lists, and
  // back again from what the drugs had in common, so nothing typed is lost.
  const togglePerMed = (x, on) => {
    const s = stateOf(x);
    if (on) {
      patch(x, { perMed: true, meds: Object.fromEntries(activeMeds(x).map(d => [d.id, { ...s.gap }])) });
    } else {
      const pairs = activeMeds(x).map(d => s.meds[d.id] || EMPTY);
      patch(x, { perMed: false, gap: { barriers: union(pairs.map(r => r.barriers)), interventions: union(pairs.map(r => r.interventions)) } });
    }
  };
  const changed = measures.filter(x => isChanged(x, stateOf(x), base(x)));
  const discard = () => setDraft({});
  const save = () => {
    if (!member || !changed.length) return;
    const recorded = Object.fromEntries(changed.map(x => [x.code, recordFor(x, stateOf(x))]));
    logInterventions(member.id, { date: todayMdy(), by: currentUser?.name || 'You', note, measures: recorded }, { clearReasons: true });
    setDraft({});
    setNote('');
    showToast?.(`Updated ${Object.keys(recorded).join(', ')}`);
  };
  return { measures, stateOf, patchGap, patchMed, togglePerMed, changed, canSave: changed.length > 0, note, setNote, discard, save };
}

// DSF scoring helpers. The canonical PHQ-2 / PHQ-9 items, response
// options, and interpretation cutoffs already live in the shared
// validated-instruments module (`src/features/forms/builder/
// validatedInstruments.js`). This helper adapts them to the DSF forms'
// simple use-case: an array of numeric responses maps to a total score
// plus a matching interpretation band. We don't build a full
// FormDefinition here because the DSF surface only ever asks the two
// canonical questions of each instrument in a fixed order.

import { INSTRUMENTS } from '../../forms/builder/validatedInstruments';
import { parseLocalDate } from '../../../lib/localDate';

const PHQ2 = INSTRUMENTS.find(i => i.key === 'phq2');
const PHQ9 = INSTRUMENTS.find(i => i.key === 'phq9');

export function getInstrument(key) {
  if (key === 'phq2') return PHQ2;
  if (key === 'phq9') return PHQ9;
  return null;
}

// Response scale is shared across PHQ instruments (0..3, "Not at all"
// through "Nearly every day"). Exposed so the LikertMatrix renders the
// same 4-column header without re-declaring the labels.
export function getResponseScale(key) {
  const inst = getInstrument(key);
  return inst?.responseOptions ?? [];
}

// Items for the given instrument. Each item has `{ code, text }`.
export function getItems(key) {
  const inst = getInstrument(key);
  return inst?.items ?? [];
}

// Sum non-null numeric responses. Returns null when ANY item is
// unanswered so callers can gate "Save score" on completion. Values are
// expected to be the numeric `score` from `responseOptions` (0..3), not
// the display label.
export function totalScore(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  let sum = 0;
  for (const v of values) {
    if (v === null || v === undefined || Number.isNaN(v)) return null;
    sum += Number(v) || 0;
  }
  return sum;
}

// Look up the interpretation band by total score for the given
// instrument. Returns { label, severity } or null.
export function bandFor(key, total) {
  const inst = getInstrument(key);
  if (!inst || total === null || total === undefined) return null;
  const match = (inst.score?.interpretations || []).find(
    b => total >= b.min && total <= b.max,
  );
  return match ? { label: match.label, severity: match.severity } : null;
}

// PHQ-2 cutoff is 3 (see validatedInstruments.js). Kept behind a helper
// so callers don't hard-code the boundary.
export function isPhq2Positive(total) {
  return typeof total === 'number' && total >= 3;
}

// PHQ-9 severity → the caller's care-plan branch key. Maps every
// interpretation label in `validatedInstruments.js` PHQ-9 def to the
// scoring reference's four-band scheme:
//    0-4 points  → minimal (/ none)
//    5-9 points  → mild
//    10-19 pts   → moderate  (folds validatedInstruments'
//                  "moderately severe" 15-19 into this bucket)
//    20-27 pts   → severe
export function phq9Branch(total) {
  if (typeof total !== 'number') return null;
  if (total <= 4) return 'minimal';
  if (total <= 9) return 'mild';
  if (total <= 19) return 'moderate';
  return 'severe';
}

// Resolve the 30-day due date for the PHQ-9 (DSF-B) assessment.
// Anchor priority, per product spec:
//   1) Fold-native: the paired DSF-A PHQ-2 `savedAt` + 30 days. This is
//      the moment the Positive result was committed in Fold.
//   2) Standalone (Astrana ingestion): the DSF-B gap's persisted
//      `dueDateISO` (seeded/openNativeGap) or `startDate` + 30 days
//      when the gap has no explicit due date on it.
//   3) Last-resort fallback: today + 30 days.
// Returns an ISO string.
export function computeDsfbDueDateISO({ dsfaSavedAt, dsfbGap } = {}) {
  const plus30 = (date) => {
    const d = new Date(date);
    d.setDate(d.getDate() + 30);
    return d.toISOString();
  };
  if (dsfaSavedAt) return plus30(new Date(dsfaSavedAt));
  if (dsfbGap?.dueDateISO) return dsfbGap.dueDateISO;
  if (dsfbGap?.startDate) {
    const parsed = parseLocalDate(dsfbGap.startDate);
    if (parsed) return plus30(parsed);
  }
  return plus30(new Date());
}

// Human-readable band label: matches the scoring reference's
// vocabulary exactly (Minimal / None, Mild, Moderate, Severe) so the
// interpretation Badge reads the same as the clinical worksheet.
export function phq9BandLabel(branch) {
  switch (branch) {
    case 'minimal':  return 'Minimal / None';
    case 'mild':     return 'Mild';
    case 'moderate': return 'Moderate';
    case 'severe':   return 'Severe';
    default: return null;
  }
}

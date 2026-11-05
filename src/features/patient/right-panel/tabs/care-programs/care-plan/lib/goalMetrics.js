import { isClosedStatus } from './gbiStatus';

/**
 * Goal progress band (5-band, Figma 2632:81504), used by the Goal Details
 * drawer readout and the care-plan audit log so the "changed the Progress"
 * pill and the drawer label read identically.
 */
export function goalProgressBand(pct) {
  const n = Number(pct) || 0;
  if (n <= 0) return 'Poor';
  if (n < 40) return 'Low';
  if (n < 80) return 'Moderate';
  if (n < 100) return 'High';
  return 'Complete';
}
export function goalProgressTone(label) {
  if (/Poor|Low/.test(label)) return 'error';
  if (/Moderate/.test(label)) return 'warning';
  if (/High|Complete/.test(label)) return 'success';
  return 'grey';
}
/** "70% - Moderate", the exact string the care-plan audit stores as detail. */
export function goalProgressAuditDetail(pct) {
  return `${Number(pct) || 0}% - ${goalProgressBand(pct)}`;
}

/**
 * Adherence band (3-band, Figma 2632:110774), used by the intervention
 * preview drawer's slider + badge. Adherence is a separate metric from
 * goal progress and the product intentionally uses fewer bands here.
 */
export function adherenceBand(pct) {
  const n = Number(pct) || 0;
  if (n < 40) return 'Poor';
  if (n < 80) return 'Moderate';
  return 'Good';
}
export function adherenceTone(label) {
  if (/Poor/.test(label)) return 'error';
  if (/Moderate/.test(label)) return 'warning';
  if (/Good/.test(label)) return 'success';
  return 'grey';
}

/**
 * Roll up a goal's progress from its linked interventions and any barriers
 * that block it. Called from the store after intervention or barrier saves
 * so `goal.progress` stops being purely a manual slider.
 *
 * Contract:
 *   • Average `adherence` (as a number) across every intervention whose
 *     `goalId === goal.id`, non-numeric adherence values ("-", null,
 *     undefined) are excluded from the average, not counted as 0.
 *   • Any open barrier (no final status, see gbiStatus isClosedStatus,
 *     i.e. an active blocker) linked to the goal caps the progress at 80% of
 *     the raw average, so an active barrier is visible on the goal's
 *     progress ring without wiping progress the patient already made.
 *   • Returns `null` when there are no linked interventions to derive
 *     from: the caller should leave `goal.progress` untouched in that
 *     case (a plan with no interventions yet keeps its manual value).
 *
 * `barriers` may carry `goalIds: string[]` (new join-table shape) or the
 * legacy single `goalId`; both are checked.
 */
export function computeGoalProgress(goal, interventions = [], barriers = []) {
  if (!goal?.id) return null;
  const linked = interventions.filter(i => i && i.goalId === goal.id);
  const numericAdherence = linked
    .map(i => Number(i?.adherence))
    .filter(n => Number.isFinite(n));
  if (numericAdherence.length === 0) return null;
  const rawAvg = numericAdherence.reduce((a, b) => a + b, 0) / numericAdherence.length;

  const hasActiveBarrier = (barriers || []).some(b => {
    if (!b) return false;
    if (isClosedStatus(b.status)) return false;
    const goalIds = Array.isArray(b.goalIds) && b.goalIds.length > 0
      ? b.goalIds
      : (b.goalId ? [b.goalId] : []);
    return goalIds.includes(goal.id);
  });

  const cap = hasActiveBarrier ? 0.8 : 1;
  return Math.max(0, Math.min(100, Math.round(rawAvg * cap)));
}

/** First numeric token in a reading (e.g. "145/90" → 145): shared by table + drawer. */
export function sparkNum(v) {
  const m = String(v).match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : NaN;
}

/** Measurements for one goal, oldest → newest. */
export function goalMeasurements(goalId, measurements = []) {
  return measurements
    .filter(m => m.goalId === goalId)
    .slice()
    .sort((a, b) => new Date(a.takenAt) - new Date(b.takenAt));
}

/**
 * Derive care-plan table fields from the same goal row + readings the drawer uses.
 * `progress` and `status` live on the goal; value/trend come from measurements.
 */
export function deriveGoalTableFields(goal, measurements = []) {
  const rows = goalMeasurements(goal?.id, measurements);
  let currentValue = 'No Data';
  let trend = '-';

  if (rows.length) {
    const latest = rows[rows.length - 1];
    const unit = latest.unit || goal?.customUnit || '';
    currentValue = unit && !String(latest.value).includes(unit)
      ? `${latest.value} ${unit}`.trim()
      : latest.value;

    if (rows.length >= 2) {
      const prev = sparkNum(rows[rows.length - 2].value);
      const next = sparkNum(rows[rows.length - 1].value);
      if (!Number.isNaN(prev) && !Number.isNaN(next)) {
        if (next > prev) trend = '↑';
        else if (next < prev) trend = '↓';
        else trend = '→';
      }
    }
  }

  return {
    currentValue,
    trend,
    progress: Number.isFinite(goal?.progress) ? goal.progress : 0,
    status: goal?.status || 'Not Started',
  };
}

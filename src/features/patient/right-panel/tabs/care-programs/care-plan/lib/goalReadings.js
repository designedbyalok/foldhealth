import {
  MEASURE_CONFIG,
  normalizeCategory,
  goalTargetUnit,
} from '../../../../../../settings/care-plan-library/lib';

/** Reading value stored when an Assessment goal is marked done. */
export const ASSESSMENT_COMPLETED = 'Completed';

/**
 * How a reading for this goal is entered, from the goal's own measure:
 *   assessment — no value; the goal is marked completed on a date
 *   dual       — two parts joined by a separator (Blood Pressure 130/80)
 *   select     — a fixed scale (Pain 0–10)
 *   number     — one numeric value in the measure's unit
 *   text       — free-form ("Others", or a measure with no config)
 */
export function goalReadingSpec(goal) {
  const category = normalizeCategory(goal?.category);
  if (category === 'Assessment') return { kind: 'assessment' };
  const cfg = MEASURE_CONFIG[goal?.measure];
  if (category !== 'Others' && cfg) {
    if (cfg.kind === 'select') return { kind: 'select', options: cfg.options, unit: '' };
    if (cfg.dual) {
      return {
        kind: 'dual',
        separator: cfg.separator || '/',
        labels: cfg.placeholders || ['Value 1', 'Value 2'],
        units: cfg.units || [],
        unit: cfg.units?.[1] || '',
      };
    }
    if (cfg.unit) return { kind: 'number', unit: cfg.unit };
  }
  return { kind: 'text', unit: goalTargetUnit(goal || {}) };
}

/** Unit stored with a new reading — the measure's unit, or the goal's own. */
export function goalReadingUnit(goal) {
  return goalReadingSpec(goal).unit || '';
}

const num = (v) => {
  const n = Number(String(v ?? '').trim());
  return String(v ?? '').trim() !== '' && Number.isFinite(n) ? n : null;
};

function meets(value, comparator, a, b) {
  switch (comparator) {
    case '<': return value < a;
    case '<=': return value <= a;
    case '>': return value > a;
    case '>=': return value >= a;
    case '=': return value === a;
    case 'between': return b != null && value >= Math.min(a, b) && value <= Math.max(a, b);
    default: return null;
  }
}

/**
 * Whether a reading meets the goal's target: true / false, or null when it
 * can't be judged (no target, free-text target, unparseable value). Callers
 * fall back to the clinician's own call when this returns null.
 *
 * Dual measures (Blood Pressure) compare each part against its own target
 * part — a reading is in target only when both parts are.
 */
export function evaluateReading(goal, value) {
  if (!goal || goal.setTarget === false || !goal.targetValue) return null;
  const spec = goalReadingSpec(goal);
  if (spec.kind === 'assessment') return null;
  const comparator = goal.comparator || '=';
  if (spec.kind === 'dual' && comparator !== 'between') {
    const parts = String(value ?? '').split(spec.separator).map(num);
    const targets = [num(goal.targetValue), num(goal.targetValue2)];
    if (parts.length !== 2 || parts.some(p => p == null) || targets.some(t => t == null)) return null;
    const results = parts.map((p, i) => meets(p, comparator, targets[i]));
    return results.some(r => r == null) ? null : results.every(Boolean);
  }
  const v = num(value);
  const a = num(goal.targetValue);
  if (v == null || a == null) return null;
  const b = comparator === 'between' ? num(goal.targetValue2) : null;
  return meets(v, comparator, a, b);
}

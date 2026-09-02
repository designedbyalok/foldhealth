/* Measure shapes + the formatters the library table renders them with. */
export const MEASURE_CONFIG = {
  'Blood Pressure': { dual: true, units: ['mmHg', 'mmHg'], placeholders: ['Systolic BP', 'Diastolic BP'], separator: '/' },
  Height: { dual: true, units: ['Ft', 'in'], placeholders: ['Enter Value', 'Enter Value'], separator: '/' },
  Weight: { unit: 'lbs' },
  BMI: { unit: 'kg/m²' },
  'Blood Glucose': { unit: 'mg/dL' },
  'Pain Scale': { kind: 'select', options: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] },
  'Waist Circumference': { unit: 'cm' },
  'Head Circumference': { unit: 'cm' },
  'Respiration Rate': { unit: 'bpm' },
  'Body Temperature': { unit: 'fahrenheit', stepper: true },
  'Pulse Rate': { unit: 'bpm' },
  'Oxygen Saturation': { unit: '%' },

  // Activity
  Steps: { unit: 'steps' },
  Calories: { unit: 'kcal', stepper: true },
  Duration: { unit: 'minutes' },
  Aerobics: { unit: 'minutes' },
  Archery: { unit: 'minutes' },
  Badminton: { unit: 'minutes' },
  Baseball: { unit: 'minutes' },
  Basketball: { unit: 'minutes' },
  Biking: { unit: 'minutes' },
  Spinning: { unit: 'minutes' },

  // Lab results — units so a saved lab target renders as "< 7 %".
  'Hemoglobin A1c': { unit: '%' },
  'Estim. Avg Glu (eAG)': { unit: 'mg/dL' },
  'Glucose, Fasting': { unit: 'mg/dL' },
  eGFR: { unit: 'mL/min' },
  Creatinine: { unit: 'mg/dL' },
  'LDL Cholesterol': { unit: 'mg/dL' },
  'HDL Cholesterol': { unit: 'mg/dL' },
  'Total Cholesterol': { unit: 'mg/dL' },
  Triglycerides: { unit: 'mg/dL' },
};

/**
 * Renders a saved goal's target as "< 140 mg/dl" (or "120 / 80 mmHg" for the
 * dual-part measures). Exported so the library table shows what was entered.
 */
export function formatGoalTarget(g) {
  if (!g || g.setTarget === false || !g.targetValue) return '';
  const cfg = MEASURE_CONFIG[g.measure] || {};
  const isRange = g.comparator === 'between';
  const unit = g.category === 'Other' ? g.customUnit : (cfg.dual ? cfg.units?.[1] : cfg.unit);
  const parts = [];
  if (!isRange && g.comparator && g.comparator !== '=') parts.push(g.comparator);
  if (cfg.dual || isRange) {
    const sep = isRange ? 'to' : (cfg.separator || '/');
    parts.push(`${g.targetValue} ${sep} ${g.targetValue2 || ''}`.trim());
  } else {
    parts.push(String(g.targetValue));
  }
  if (unit) parts.push(unit);
  return parts.join(' ');
}

export function formatGoalDuration(g) {
  if (!g || g.setTarget === false || !g.duration) return '';
  const unit = g.durationUnit || '';
  const plural = String(g.duration) === '1' ? unit : `${unit}s`;
  return `${g.duration} ${plural}`.trim();
}

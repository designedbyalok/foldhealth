/**
 * The vitals a clinician can record (Figma 67:131374), in drawer order.
 * Shared by the Record Vitals drawer, the Vitals tab table and the seed.
 *
 *   key     – stored in patient_vitals.vital_key
 *   parts   – how many number boxes the drawer shows (BP: sys/dia, Height: ft/in)
 *   sep     – text between the two boxes
 *   units   – unit text after each box ('' for none)
 */
export const VITALS = [
  { key: 'bp',     name: 'Blood Pressure',      unit: 'mmHg',        parts: 2, sep: '/',  units: ['', 'mmHg'] },
  { key: 'spo2',   name: 'Oxygen Saturation',   unit: '%',           parts: 1, units: ['%'] },
  { key: 'hr',     name: 'Heart Rate',          unit: 'bpm',         parts: 1, units: ['bpm'] },
  { key: 'rr',     name: 'Respiration Rate',    unit: 'breaths/min', parts: 1, units: ['bpm'] },
  { key: 'ht',     name: 'Height',              unit: 'ft',          parts: 2, units: ['ft', 'in'] },
  { key: 'wt',     name: 'Weight',              unit: 'lbs',         parts: 1, units: ['lbs'] },
  { key: 'bmi',    name: 'BMI',                 unit: 'BMI',         parts: 1, units: [''] },
  { key: 'waist',  name: 'Waist Circumference', unit: 'cm',          parts: 1, units: ['cm'] },
  { key: 'hc',     name: 'Head Circumference',  unit: 'cm',          parts: 1, units: ['cm'] },
  { key: 'bt',     name: 'Body Temperature',    unit: '°F',          parts: 1, units: ['fahrenheit'] },
  { key: 'pain',   name: 'Pain Scale',          unit: '0–10',        parts: 1, units: [''] },
];

export const VITALS_BY_KEY = Object.fromEntries(VITALS.map(v => [v.key, v]));

/** Reading as the table shows it: 120/80, 98%, 5'8", 150. */
export function formatVital(key, value, value2) {
  if (key === 'bp') return `${value}/${value2}`;
  if (key === 'ht') return `${value}'${value2 || 0}"`;
  if (key === 'spo2') return `${value}%`;
  return String(value);
}

/** Reading with its unit for the drawer's "Last Recorded" line: 120/80 mmHg, 80 bpm. */
export function formatVitalWithUnit(key, value, value2) {
  const v = VITALS_BY_KEY[key];
  const text = formatVital(key, value, value2);
  if (!v || key === 'ht' || key === 'spo2' || key === 'pain') return text;
  return `${text} ${v.unit}`;
}

/**
 * Sample history shown for a vital the patient has no recorded readings of
 * yet (and the seed for the demo patient). recorded_on is ISO.
 */
export const SAMPLE_VITALS = [
  { vital_key: 'bp',   value: '145', value2: '90', recorded_on: '2025-03-09' },
  { vital_key: 'bp',   value: '130', value2: '80', recorded_on: '2025-03-01' },
  { vital_key: 'bp',   value: '120', value2: '80', recorded_on: '2025-02-24' },
  { vital_key: 'spo2', value: '98', recorded_on: '2025-03-09' },
  { vital_key: 'spo2', value: '95', recorded_on: '2025-03-01', flag: true },
  { vital_key: 'spo2', value: '97', recorded_on: '2025-02-24', flag: true },
  { vital_key: 'rr',   value: '22', recorded_on: '2025-03-09' },
  { vital_key: 'rr',   value: '18', recorded_on: '2025-03-01' },
  { vital_key: 'rr',   value: '20', recorded_on: '2025-02-24' },
  { vital_key: 'ht',   value: '5', value2: '8', recorded_on: '2025-03-09' },
  { vital_key: 'ht',   value: '5', value2: '8', recorded_on: '2025-03-01' },
  { vital_key: 'ht',   value: '5', value2: '8', recorded_on: '2025-02-24' },
  { vital_key: 'wt',   value: '150', recorded_on: '2025-03-09' },
  { vital_key: 'wt',   value: '175', recorded_on: '2025-03-01', flag: true },
  { vital_key: 'wt',   value: '200', recorded_on: '2025-02-24', flag: true },
  { vital_key: 'bmi',  value: '22.5', recorded_on: '2025-03-09' },
  { vital_key: 'bmi',  value: '27.3', recorded_on: '2025-03-01', flag: true },
  { vital_key: 'bmi',  value: '24.1', recorded_on: '2025-02-24', flag: true },
  { vital_key: 'bt',   value: '98.6', recorded_on: '2025-03-09' },
  { vital_key: 'bt',   value: '99.1', recorded_on: '2025-03-01' },
  { vital_key: 'bt',   value: '97.8', recorded_on: '2025-02-24' },
  { vital_key: 'hc',   value: '48', recorded_on: '2025-03-09', flag: true },
  { vital_key: 'hc',   value: '45', recorded_on: '2025-03-01' },
  { vital_key: 'hc',   value: '44', recorded_on: '2025-02-24' },
];

/**
 * Readings per vital, newest first. A vital the patient has real readings of
 * shows only those; one with none falls back to the sample history.
 */
export function vitalsHistory(rows = []) {
  const byKey = {};
  const add = (r) => { (byKey[r.vital_key] ||= []).push(r); };
  rows.forEach(add);
  const recorded = new Set(Object.keys(byKey));
  SAMPLE_VITALS.filter(r => !recorded.has(r.vital_key)).forEach(add);
  for (const k of Object.keys(byKey)) {
    byKey[k].sort((a, b) => (b.recorded_on || '').localeCompare(a.recorded_on || '') || (b.created_at || '').localeCompare(a.created_at || ''));
  }
  return byKey;
}

/**
 * The Vitals/Labs tab's other sections (biomarkers, activity, labs): sample
 * readings, newest first. Shared with the Overview's Vitals widget.
 */
export const TABLE_SECTIONS = [
  {
    id: 'biomarkers', title: 'Biomarkers',
    rows: [
      { id: 'bg',  name: 'Blood Glucose',      unit: 'mg/dL',
        values: [{ v: '85', date: '3/9/25' }, { v: '92', date: '3/1/25' }, { v: '78', date: '2/24/25' }] },
      { id: 'rhr', name: 'Resting Heart Rate', unit: 'bpm',
        values: [{ v: '72', date: '3/9/25' }, { v: '68', date: '3/1/25' }, { v: '75', date: '2/24/25', flag: true }] },
    ],
  },
  {
    id: 'activity', title: 'Activity',
    rows: [
      { id: 'steps', name: 'Steps', unit: 'steps',
        values: [{ v: '5,675', date: '3/9/25' }, { v: '4,321', date: '3/1/25', flag: true }, { v: '7,890', date: '2/24/25' }] },
    ],
  },
  {
    id: 'lab', title: 'Lab Monitoring',
    rows: [
      { id: 'hba1c', name: 'HbA1c',             unit: '%',
        values: [{ v: '6.8', date: '3/9/25' }, { v: '7.2', date: '3/1/25', flag: true }, { v: '6.5', date: '2/24/25' }] },
      { id: 'chol',  name: 'Total Cholesterol',  unit: 'mg/dL',
        values: [{ v: '185', date: '3/9/25' }, { v: '210', date: '3/1/25', flag: true }, { v: '195', date: '2/24/25' }] },
      { id: 'ldl',   name: 'LDL',               unit: 'mg/dL',
        values: [{ v: '112', date: '3/9/25' }, { v: '130', date: '3/1/25', flag: true }, { v: '118', date: '2/24/25' }] },
    ],
  },
];

/**
 * How a care plan prints (Preview & Share > Personalize), saved as presets in
 * care_plan_print_presets. A preset is the organization's (everyone sees it)
 * or private to its creator, like care plan templates.
 */
import { resolvePatientDisplay } from '../../../../../../../lib/patientDisplay';

export const DEMOGRAPHIC_FIELDS = [
  { key: 'dobAgeSex', label: 'DOB, age and sex' },
  { key: 'ids', label: 'Member / Fold ID' },
  { key: 'pcpInsurance', label: 'PCP and insurance' },
];

export const FORMAT_OPTIONS = [
  { value: 'table', label: 'Tables', hint: 'Goals, interventions and barriers as tables with their status, dates and values.' },
  { value: 'summary-compact', label: 'Care Plan Summary', hint: 'A summary page, then each goal with its fields, interventions, barriers and note. Goals run on one after another.' },
  { value: 'summary-detailed', label: 'Care Plan Summary, detailed', hint: 'As above, with each goal on its own page and intervention descriptions printed.' },
];

export const GROUP_BY_OPTIONS = [
  { value: 'type', label: 'Goals, interventions and barriers', hint: 'One section for each, as on the care plan.' },
  { value: 'condition', label: 'Condition', hint: 'A heading for each condition with its goals, interventions and barriers. Anything unrelated goes under Other.' },
];

// headerId / footerId: null is the built-in one; otherwise a Report Header /
// Report Footer component (Settings > Content > Components).
export const DEFAULT_PRINT_SETTINGS = {
  format: 'table',
  groupBy: 'type',
  showCarePlanNote: true,
  demographics: ['dobAgeSex'],
  showHeader: false,
  headerId: null,
  showFooter: true,
  footerId: null,
  showLogo: false,
  customLogo: null, // { dataUrl, name, width, height } replacing the clinic logo
};

/** Saved settings over the defaults, so a preset from before a field existed still loads. */
export function normalizePrintSettings(saved) {
  const s = { ...DEFAULT_PRINT_SETTINGS, ...(saved && typeof saved === 'object' ? saved : {}) };
  if (!GROUP_BY_OPTIONS.some(o => o.value === s.groupBy)) s.groupBy = 'type';
  if (!FORMAT_OPTIONS.some(o => o.value === s.format)) s.format = 'table';
  s.demographics = (Array.isArray(s.demographics) ? s.demographics : [])
    .filter(k => DEMOGRAPHIC_FIELDS.some(f => f.key === k));
  return s;
}

export const samePrintSettings = (a, b) => JSON.stringify(normalizePrintSettings(a)) === JSON.stringify(normalizePrintSettings(b));

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function formatDob(dob) {
  if (!dob) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dob));
  if (m) return `${m[2]}/${m[3]}/${m[1]}`;
  return String(dob);
}

/**
 * The patient box rows for the picked demographics. Missing values print as
 * "Not recorded" in the PDF; nothing is filled in.
 */
export function demographicRows(patient, picked) {
  if (!patient) return [];
  const rows = [];
  if (picked.includes('dobAgeSex')) {
    rows.push({ label: 'Date of birth', value: formatDob(patient.dob) });
    const age = String(patient.age ?? '').trim();
    rows.push({ label: 'Age', value: /^\d+$/.test(age) ? plural(Number(age), 'year') : age });
    rows.push({ label: 'Sex', value: patient.gender || '' });
  }
  if (picked.includes('ids')) {
    rows.push({ label: 'Member / Fold ID', value: patient.memberId ? `#${patient.memberId}` : '' });
  }
  if (picked.includes('pcpInsurance')) {
    rows.push({ label: 'PCP', value: patient.pcp && patient.pcp !== '—' ? patient.pcp : '' });
    rows.push({ label: 'Insurance', value: patient.insurance || '' });
  }
  return rows;
}

/**
 * The open patient's record from whichever slice holds it. Worklists name
 * the same fields differently (g / gender, hp / hpCode), so this reads both.
 */
export function findPatientRecord(state, patientId) {
  const match = m => m && (String(m.id) === String(patientId) || String(m.memberId) === String(patientId));
  const slices = [
    state.patients, state.allPatients, state.hccMembers, state.awvMembers,
    state.ccmWorklistMembers, state.snpWorklistMembers, state.hedisMembers,
  ];
  // Several slices can hold the patient, each with some of the fields.
  const found = slices.flatMap(list => (list || []).filter(match));
  if (!found.length) return null;
  const pick = (...keys) => {
    for (const r of found) for (const k of keys) if (r[k] != null && r[k] !== '' && r[k] !== '—') return r[k];
    return '';
  };
  // DOB, age and sex as the patient banner shows them (P360 profile first).
  const raw = { ...found[0], id: patientId, dob: pick('dob', 'dateOfBirth'), age: pick('age'), gender: pick('gender', 'g') };
  const shown = resolvePatientDisplay(raw, state.p360ProfilesById?.[patientId] || null);
  return {
    name: found[0].name || '',
    dob: shown.dob,
    age: shown.age,
    gender: shown.gender,
    memberId: pick('memberId'),
    pcp: pick('pcp'),
    insurance: pick('insurance', 'healthPlan', 'hp', 'hpCode'),
  };
}

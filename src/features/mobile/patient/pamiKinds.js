import { searchMedications } from '../../../lib/openfda';
import { searchAllergies } from '../../../lib/allergyLookup';
import { searchImmunizations } from '../../../lib/immunizationLookup';
import { formatClinicalDate, toIsoDate, todayIso } from '../../../lib/clinicalDates';

const CONDITIONS_API = 'https://clinicaltables.nlm.nih.gov/api/conditions/v3/search';

/** NLM clinical-tables conditions, as ChronicConditionSelect looks them up. */
async function searchConditions(term, { signal } = {}) {
  const res = await fetch(`${CONDITIONS_API}?terms=${encodeURIComponent(term)}&maxList=10`, { signal });
  if (!res.ok) return [];
  const data = await res.json();
  return [...new Set((data?.[3] || []).map(row => row?.[0]).filter(Boolean))];
}

// problem onset_label is a display string ("11/18/2024 (1 Year)"); read the
// date back out for the date field (AddProblemsDrawer isoFromOnsetLabel).
const isoFromOnsetLabel = (label) => {
  const m = /^(\d{1,2}\/\d{1,2}\/\d{4})/.exec(String(label || '').trim());
  return (m && toIsoDate(m[1])) || '';
};

/**
 * The four PAMI lists the phone can edit, each mapped onto the desktop
 * Add*Drawer's lookup, fields and store actions so a row saved here is the
 * row the desktop would write.
 *
 *   search(term, { signal }) → [{ key, title, detail, concept }]
 *   initial(row)             → form values for editing
 *   payload(values, concept) → what the store's add / update action takes
 */
export const PAMI_KINDS = {
  medication: {
    noun: 'Medication',
    listKey: 'patientMedications',
    fetch: 'fetchPatientMedications',
    add: 'addPatientMedication',
    update: 'updatePatientMedication',
    remove: null,
    searchPlaceholder: 'Search medications',
    search: async (term, opts) => {
      const rows = await searchMedications(term, opts);
      return [...new Set(rows.map(r => r.displayName).filter(Boolean))].map(n => ({ key: n, title: n }));
    },
    titleOf: (r) => r.name,
    initial: (m) => ({
      status: m?.status || 'Active',
      start: toIsoDate(m?.start) || todayIso(),
      stop: toIsoDate(m?.stop) || '',
      stopReason: m?.stopReason || '',
      sig: m?.sig || '',
      lastFilledOn: toIsoDate(m?.lastFilledOn) || '',
      daysSupply: m?.daysSupply ?? '',
      note: m?.note || '',
    }),
    payload: (title, v) => {
      const stopped = v.status === 'Stopped';
      return {
        name: title,
        status: v.status,
        start: v.start,
        sig: v.sig.trim(),
        note: v.note.trim(),
        stop: stopped ? v.stop : '',
        stopReason: stopped ? v.stopReason : '',
        lastFilledOn: stopped ? '' : v.lastFilledOn,
        daysSupply: !stopped && Number(v.daysSupply) > 0 ? Math.round(Number(v.daysSupply)) : null,
      };
    },
  },
  problem: {
    noun: 'Problem',
    listKey: 'patientProblems',
    fetch: 'fetchPatientProblems',
    add: 'addPatientProblem',
    update: 'updatePatientProblem',
    remove: 'removePatientProblem',
    searchPlaceholder: 'Search conditions',
    search: async (term, opts) => (await searchConditions(term, opts)).map(n => ({ key: n, title: n })),
    titleOf: (r) => r.title,
    initial: (p) => ({
      since: isoFromOnsetLabel(p?.onsetLabel) || todayIso(),
      status: p?.status || 'Active',
      severity: p?.severity || 'Mild',
      type: p?.type || 'Chronic',
      note: p?.note || '',
    }),
    payload: (title, v) => ({
      title,
      type: v.type,
      severity: v.severity,
      status: v.status,
      note: v.note.trim(),
      onsetLabel: v.since ? formatClinicalDate(v.since) : undefined,
    }),
  },
  allergy: {
    noun: 'Allergy',
    listKey: 'patientAllergies',
    fetch: 'fetchPatientAllergies',
    add: 'addPatientAllergy',
    update: 'updatePatientAllergy',
    remove: 'removePatientAllergy',
    searchPlaceholder: 'Search allergens',
    search: async (term, opts) => {
      const { results } = await searchAllergies(term, opts);
      return results.map(r => ({ key: `${r.system}|${r.code}`, title: r.display, detail: r.kind === 'drug' ? 'Drug' : null, concept: { code: r.code, codeSystem: r.system } }));
    },
    titleOf: (r) => r.title,
    conceptOf: (r) => ({ code: r.code || '', codeSystem: r.codeSystem || '' }),
    initial: (a) => ({
      since: toIsoDate(a?.sinceDate) || todayIso(),
      reactionType: a?.reactionType || 'Allergy',
      criticality: a?.criticality || 'Low',
      reactions: (a?.reactions || []).filter(r => r && typeof r === 'object' && r.code),
      note: a?.note || '',
    }),
    payload: (title, v, concept, reactionSystem) => ({
      title,
      sinceDate: v.since,
      reactionType: v.reactionType,
      criticality: v.criticality,
      reactions: v.reactions.map(({ code, display, severity }) => ({ system: reactionSystem, code, display, severity })),
      note: v.note.trim(),
      ...(concept || {}),
    }),
  },
  immunization: {
    noun: 'Immunization',
    listKey: 'patientImmunizations',
    fetch: 'fetchPatientImmunizations',
    add: 'addPatientImmunization',
    update: 'updatePatientImmunization',
    remove: 'removePatientImmunization',
    searchPlaceholder: 'Search vaccines',
    search: async (term, opts) => (await searchImmunizations(term, opts))
      .map(r => ({ key: r.code, title: r.display, detail: `CVX ${r.code}`, concept: { code: r.code, codeSystem: r.system } })),
    titleOf: (r) => r.title,
    conceptOf: (r) => ({ code: r.code || '', codeSystem: r.codeSystem || '' }),
    initial: (i) => ({
      administered: toIsoDate(i?.dateAdministered) || todayIso(),
      status: i?.status || 'Active',
      doseQuantity: i?.doseQuantity || '',
      doseUnits: i?.doseUnits || '',
      note: i?.note || '',
    }),
    payload: (title, v, concept) => ({
      title,
      dateAdministered: v.administered,
      status: v.status,
      doseQuantity: v.doseQuantity.trim(),
      doseUnits: v.doseUnits.trim(),
      note: v.note.trim(),
      ...(concept || {}),
    }),
  },
};

const PATIENT_SLICES = [
  'patients',
  'hccMembers',
  'awvMembers',
  'ccmWorklistMembers',
  'snpWorklistMembers',
  'hedisMembers',
  'allPatients',
];

const normMemberId = (v) => String(v || '').replace(/^#/, '').trim();

/**
 * Map a URL member id / selectedPatientId to the canonical store row id
 * (e.g. "10039" → "snpw-001") so Supabase queries use the same key as seed data.
 */
export function resolvePatientStoreId(state, patientId) {
  if (!patientId) return patientId;
  const pid = String(patientId);
  const normPid = normMemberId(pid);
  for (const key of PATIENT_SLICES) {
    const rows = state[key];
    if (!rows?.find) continue;
    const row = rows.find(
      (m) => m?.id === pid || normMemberId(m?.memberId) === normPid,
    );
    if (row?.id) return row.id;
  }
  return patientId;
}

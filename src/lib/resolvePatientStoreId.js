const PATIENT_SLICES = [
  'patients',
  'hccMembers',
  'awvMembers',
  'ccmWorklistMembers',
  'snpWorklistMembers',
  'pharmacyWorklistMembers',
  'hedisMembers',
  'allPatients',
];

const normMemberId = (v) => String(v || '').replace(/^#/, '').trim();

/**
 * Id for a new worklist source-table row. Since PR #372 these ids equal the
 * patient's member id (Fold ID) so P360 tables keyed by member_id find the
 * patient; a minted id (e.g. `snpw-<timestamp>`) splits their identity.
 * Falls back to the source row id only when there is no member id.
 */
export function worklistRowId(src) {
  return normMemberId(src?.memberId) || src?.id || null;
}

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

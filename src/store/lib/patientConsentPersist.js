import { supabase } from '../../lib/supabase';
import { reportPersistFailure } from './reportPersistFailure';

// Supabase I/O for supabase/patient_consents_migration.sql. Consent rows are
// insert-only; artifacts live in the private `patient-consents` bucket and
// are read through short-lived signed URLs.

const MISSING_RE = /patient_consents|patient_preferences|does not exist|schema cache/i;
const BUCKET = 'patient-consents';

export const consentFromRow = (r) => ({
  id: r.id,
  patientId: r.patient_id,
  scopeType: r.scope_type,
  scope: r.scope,
  status: r.status,
  method: r.method,
  capturedBy: r.captured_by,
  capturedByRole: r.captured_by_role,
  capturedAt: r.captured_at,
  effectiveOn: r.effective_on,
  expiresOn: r.expires_on,
  witness: r.witness,
  artifactPath: r.artifact_path,
  artifactKind: r.artifact_kind,
  note: r.note,
  programId: r.program_id,
});

export const consentToRow = (c) => ({
  id: c.id,
  patient_id: String(c.patientId),
  scope_type: c.scopeType,
  scope: c.scope,
  status: c.status,
  method: c.method || null,
  captured_by: c.capturedBy || null,
  captured_by_role: c.capturedByRole || null,
  captured_at: c.capturedAt,
  effective_on: c.effectiveOn || null,
  expires_on: c.expiresOn || null,
  witness: c.witness || null,
  artifact_path: c.artifactPath || null,
  artifact_kind: c.artifactKind || null,
  note: c.note || null,
  program_id: c.programId || null,
});

export const preferencesFromRow = (r) => ({
  channelByProgram: r?.channel_by_program || {},
  preferredLanguage: r?.preferred_language || null,
  needsInterpreter: !!r?.needs_interpreter,
  healthLiteracy: r?.health_literacy || 'unknown',
  contactPoints: Array.isArray(r?.contact_points) ? r.contact_points : [],
  updatedBy: r?.updated_by || null,
  updatedAt: r?.updated_at || null,
});

const isMissing = (error) => MISSING_RE.test(error?.message || '');

/** @returns {Promise<{ rows: object[], missing: boolean }>} newest first */
export async function fetchConsentRows(patientId) {
  const { data, error } = await supabase
    .from('patient_consents')
    .select('*')
    .eq('patient_id', String(patientId))
    .order('captured_at', { ascending: false });
  if (error) {
    if (!isMissing(error)) console.warn('fetchPatientConsents failed:', error.message);
    return { rows: [], missing: isMissing(error) };
  }
  return { rows: (data || []).map(consentFromRow), missing: false };
}

/** Upload a signature PNG or signed scan; returns the object path or null. */
export async function uploadConsentArtifact(patientId, consentId, file) {
  const ext = (/\.([a-z0-9]+)$/i.exec(file?.name || '')?.[1] || (file?.type === 'image/png' ? 'png' : 'bin')).toLowerCase();
  const path = `${patientId}/${consentId}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET)
    .upload(path, file, { contentType: file?.type || 'application/octet-stream', upsert: false });
  if (error) { reportPersistFailure(`uploadConsentArtifact(${consentId})`, error); return null; }
  return path;
}

/** @returns {Promise<{ ok: boolean, missing: boolean }>} */
export async function insertConsentRow(consent) {
  const { error } = await supabase.from('patient_consents').insert(consentToRow(consent));
  if (!error) return { ok: true, missing: false };
  if (isMissing(error)) return { ok: false, missing: true };
  reportPersistFailure(`insertConsent(${consent.id})`, error);
  return { ok: false, missing: false };
}

/** A signed URL for viewing an artifact, valid for `seconds`. */
export async function consentArtifactUrl(path, seconds = 300) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, seconds);
  if (error) { console.warn('consentArtifactUrl failed:', error.message); return null; }
  return data?.signedUrl || null;
}

/** @returns {Promise<{ row: object|null, missing: boolean }>} */
export async function fetchPreferencesRow(patientId) {
  const { data, error } = await supabase
    .from('patient_preferences')
    .select('*')
    .eq('patient_id', String(patientId))
    .maybeSingle();
  if (error) {
    if (!isMissing(error)) console.warn('fetchPatientPreferences failed:', error.message);
    return { row: null, missing: isMissing(error) };
  }
  return { row: data, missing: false };
}

/** @returns {Promise<{ missing: boolean }>} */
export async function persistPreferences(patientId, prefs, updatedBy) {
  const { error } = await supabase.from('patient_preferences').upsert({
    patient_id: String(patientId),
    channel_by_program: prefs.channelByProgram || {},
    preferred_language: prefs.preferredLanguage || null,
    needs_interpreter: !!prefs.needsInterpreter,
    health_literacy: prefs.healthLiteracy || 'unknown',
    contact_points: prefs.contactPoints || [],
    updated_by: updatedBy || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'patient_id' });
  if (!error) return { missing: false };
  if (isMissing(error)) return { missing: true };
  reportPersistFailure(`persistPreferences(${patientId})`, error);
  return { missing: false };
}

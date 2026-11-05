import { serviceClient } from '../_lib/serviceClient.js';
import { requireUser } from '../_lib/requireUser.js';
import { emailConfigured, sendSecurityEmail } from '../_lib/securityEmails.js';

/**
 * Give someone access to a patient's record in the patient app
 * (patients.foldhealth.org). Staff only.
 *
 *   POST { memberId, email, relationship: 'self' | 'dependent' | 'caregiver' }
 *
 * Creates the patient account when the email is new, with
 * app_metadata.role = 'patient' from the start (a client signUp would get the
 * 'staff' default), links it to the member in patient_accounts, and emails a
 * set-password link. The link points straight at the patient app and carries
 * a token hash that the app redeems only when the person submits the form, so
 * mail scanners that open links can't use it up, and no Supabase redirect
 * allow-list entry is needed. An email that belongs to a staff account is
 * refused: one sign-in is either staff or patient.
 */
const RELATIONSHIPS = ['self', 'dependent', 'caregiver'];
const fail = (res, status, message) => res.status(status).json({ error: { message } });

export function patientAppOrigin() {
  if (process.env.PATIENT_APP_URL) return process.env.PATIENT_APP_URL.replace(/\/+$/, '');
  if (process.env.VERCEL_ENV === 'production') return 'https://patients.foldhealth.org';
  return 'http://localhost:5175';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'Method not allowed');
  const caller = await requireUser(req, res);
  if (!caller) return undefined;
  if (!serviceClient) return fail(res, 500, "Patient invites aren't configured on the server (SUPABASE_SERVICE_ROLE_KEY).");
  if (!emailConfigured) return fail(res, 500, "Patient invites aren't configured on the server (RESEND_API_KEY).");

  const memberId = String(req.body?.memberId || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const relationship = req.body?.relationship;
  if (!memberId) return fail(res, 400, 'Choose a patient.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(res, 400, 'Enter a valid email address.');
  if (!RELATIONSHIPS.includes(relationship)) return fail(res, 400, 'Choose who this account belongs to.');

  const admin = serviceClient;
  try {
    const { data: member } = await admin.from('all_patients')
      .select('member_id, name').eq('member_id', memberId).limit(1).maybeSingle();
    if (!member) return fail(res, 404, 'That patient record was not found.');

    const { error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      app_metadata: { role: 'patient' },
      user_metadata: relationship === 'self' && member.name ? { full_name: member.name } : {},
    });
    if (createError && createError.code !== 'email_exists' && createError.status !== 422) throw createError;

    // Also returns the account, new or existing.
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'recovery', email });
    if (linkError) throw linkError;
    const account = link.user;
    if (account?.app_metadata?.role !== 'patient') {
      return fail(res, 409, 'This email belongs to a staff account. Use a different email for the patient app.');
    }

    const { error: upsertError } = await admin.from('patient_accounts').upsert(
      { user_id: account.id, member_id: memberId, relationship, is_primary: relationship === 'self', created_by: caller.id },
      { onConflict: 'user_id,member_id' },
    );
    if (upsertError) throw upsertError;

    const setPasswordLink = `${patientAppOrigin()}/#/set-password?token_hash=${encodeURIComponent(link.properties.hashed_token)}&type=recovery`;
    await sendSecurityEmail(email, 'patient_invite', {
      name: relationship === 'self' ? member.name : '',
      patientName: member.name,
      relationship,
      email,
      link: setPasswordLink,
    });
    return res.status(200).json({ ok: true, userId: account.id, created: !createError });
  } catch (err) {
    console.error('[patient-invite] failed', err?.message || err);
    return fail(res, 500, 'The invite could not be sent. Try again.');
  }
}

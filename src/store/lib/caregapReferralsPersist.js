import { supabase } from '../../lib/supabase';
import { reportPersistFailure } from './reportPersistFailure';

// Supabase I/O for supabase/caregap_referrals_migration.sql.

const MISSING_RE = /referral|does not exist|schema cache/i;

// "Refer to" lists the practice's own system users (profiles). eFax and
// Email use the fax and email on their profile.
const providerFromProfile = (p) => ({
  id: p.id,
  name: (p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email?.split('@')[0] || 'Unknown').trim(),
  // Medical specialty (profiles.specialties, profiles_specialties_migration),
  // not app roles like Coder / QA.
  specialty: (p.specialties || []).filter(Boolean).join(', '),
  specialties: (p.specialties || []).filter(Boolean),
  zip: p.zip_code || '',
  // System users are the practice's own providers.
  network: 'In-Network',
  practice: p.practice_location || '',
  address: [
    [p.address_line1, p.address_line2].filter(Boolean).join(', '),
    p.city,
    [p.state, p.zip_code].filter(Boolean).join(' '),
  ].filter(Boolean).join(', ') || p.practice_location || '',
  fax: p.fax || '',
  email: p.email || '',
  phone: p.mobile || p.phone || '',
});
const senderFromRow = (r) => ({
  id: r.id, channel: r.channel, label: r.label, value: r.value, isDefault: !!r.is_default,
});
export const referralFromRow = (r) => ({
  id: r.id,
  memberId: r.hedis_member_id,
  memberName: r.member_name || '',
  gapCode: r.gap_code || null,
  channel: r.channel,
  senderLineId: r.sender_line_id || null,
  senderValue: r.sender_value || '',
  providerId: r.provider_id || null,
  providerName: r.provider_name,
  providerContact: r.provider_contact || '',
  reason: r.reason || '',
  note: r.note || '',
  emailSubject: r.email_subject || '',
  emailBody: r.email_body || '',
  attachments: Array.isArray(r.attachments) ? r.attachments : [],
  status: r.status || 'Sent',
  sentBy: r.sent_by || '',
  sentById: r.sent_by_id || null,
  recipientReadAt: r.recipient_read_at || null,
  createdAt: r.created_at,
});

/** @returns {Promise<{ providers: object[], senders: object[], missing: boolean }>} */
export async function fetchReferralDirectoryRows() {
  const PROFILE_COLS = 'id, full_name, first_name, last_name, email, mobile, phone, fax, status, practice_location, address_line1, address_line2, city, state, zip_code';
  const [pFirst, s] = await Promise.all([
    supabase.from('profiles').select(`${PROFILE_COLS}, specialties`),
    supabase.from('referral_sender_lines').select('*').order('label'),
  ]);
  // Before profiles_specialties_migration runs the column doesn't exist;
  // load everything else rather than losing the whole directory.
  const p = pFirst.error && /specialties/.test(pFirst.error.message || '')
    ? await supabase.from('profiles').select(PROFILE_COLS)
    : pFirst;
  if (p.error) console.warn('fetchReferralDirectory (profiles) failed:', p.error.message);
  if (s.error && !MISSING_RE.test(s.error.message || '')) console.warn('fetchReferralDirectory (sender lines) failed:', s.error.message);
  const providers = (p.data || [])
    .filter(r => !r.status || r.status === 'Active')
    .map(providerFromProfile)
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    providers,
    senders: s.error ? [] : (s.data || []).map(senderFromRow),
    missing: !!s.error && MISSING_RE.test(s.error.message || ''),
  };
}

/** @returns {Promise<{ rows: object[], missing: boolean }>} */
export async function fetchCaregapReferralRows() {
  const { data, error } = await supabase
    .from('caregap_referrals')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    const missing = MISSING_RE.test(error.message || '');
    if (!missing) console.warn('fetchCaregapReferrals failed:', error.message);
    return { rows: [], missing };
  }
  return { rows: (data || []).map(referralFromRow), missing: false };
}

// Files go to the program-documents bucket under referrals/; the row keeps
// { name, size, type, url, storagePath } for each.
async function uploadAttachments(referral, files) {
  const out = [];
  for (const file of files || []) {
    const path = `referrals/${referral.memberId}/${referral.id}-${file.name}`;
    const { error } = await supabase.storage
      .from('program-documents')
      .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: true });
    if (error) {
      reportPersistFailure(`uploadReferralAttachment(${referral.id})`, error);
      out.push({ name: file.name, size: file.size, type: file.type || '' });
    } else {
      out.push({
        name: file.name, size: file.size, type: file.type || '', storagePath: path,
        url: supabase.storage.from('program-documents').getPublicUrl(path).data.publicUrl,
      });
    }
  }
  return out;
}

// Columns a draft can change (everything except identity / member / sender).
const referralFieldsToRow = (r) => ({
  channel: r.channel,
  sender_line_id: r.senderLineId || null,
  sender_value: r.senderValue || null,
  provider_id: r.providerId || null,
  provider_name: r.providerName || '',
  provider_contact: r.providerContact || null,
  reason: r.reason || '',
  note: r.note || null,
  email_subject: r.emailSubject || null,
  email_body: r.emailBody || null,
  status: r.status || 'Sent',
});

/** @returns {Promise<{ missing: boolean, attachments: object[] }>} */
export async function persistCaregapReferralInsert(referral, files) {
  const attachments = [...await uploadAttachments(referral, files), ...(referral.documentAttachments || [])];
  const { error } = await supabase.from('caregap_referrals').insert({
    id: referral.id,
    hedis_member_id: referral.memberId,
    member_name: referral.memberName || null,
    gap_code: referral.gapCode || null,
    ...referralFieldsToRow(referral),
    attachments,
    sent_by: referral.sentBy || null,
    sent_by_id: referral.sentById || null,
  });
  if (!error) return { missing: false, attachments };
  if (MISSING_RE.test(error.message || '')) return { missing: true, attachments };
  reportPersistFailure(`persistCaregapReferralInsert(${referral.id})`, error);
  return { missing: false, attachments };
}

/** Save a draft again, or sign & refer it. @returns {Promise<{ missing: boolean, attachments: object[] }>} */
export async function persistCaregapReferralUpdate(referral, files) {
  const attachments = [...await uploadAttachments(referral, files), ...(referral.documentAttachments || [])];
  const { error } = await supabase.from('caregap_referrals')
    .update({ ...referralFieldsToRow(referral), attachments })
    .eq('id', referral.id);
  if (!error) return { missing: false, attachments };
  if (MISSING_RE.test(error.message || '')) return { missing: true, attachments };
  reportPersistFailure(`persistCaregapReferralUpdate(${referral.id})`, error);
  return { missing: false, attachments };
}

export function persistCaregapReferralRead(id, readAt) {
  if (!id) return;
  supabase.from('caregap_referrals').update({ recipient_read_at: readAt }).eq('id', id)
    .then(({ error }) => {
      // Before caregap_referrals_email_migration.sql the column isn't there;
      // read state then stays local, which isn't worth an error toast.
      if (error && !MISSING_RE.test(error.message || '')) reportPersistFailure(`persistCaregapReferralRead(${id})`, error);
    });
}

import { supabase } from '../../lib/supabase';

// Same bucket and { name, size, type, url, storagePath } shape as the Care
// Gap referral attachments. A failed upload keeps the file's metadata only.
export async function uploadPatientReferralAttachment(patientId, referralId, file) {
  const meta = { name: file.name, size: file.size, type: file.type || '' };
  const path = `referrals/patients/${patientId}/${referralId}-${file.name}`;
  const { error } = await supabase.storage
    .from('program-documents')
    .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: true });
  if (error) {
    console.warn('uploadPatientReferralAttachment:', error.message);
    return meta;
  }
  return { ...meta, storagePath: path, url: supabase.storage.from('program-documents').getPublicUrl(path).data.publicUrl };
}

// Folders, matching the staff Documents tab (src/features/patient/right-panel/tabs/documents/documentsData.js).
export const CATEGORIES = [
  { key: 'imaging', label: 'Imaging Reports' },
  { key: 'lab', label: 'Lab Reports' },
  { key: 'physical_therapy', label: 'Physical Therapy' },
  { key: 'health_assessment', label: 'Health Assessments' },
  { key: 'referral', label: 'Referrals' },
  { key: 'report', label: 'Reports' },
  { key: 'form', label: 'Forms' },
  { key: 'personal_id', label: 'Personal Ids' },
  { key: 'other', label: 'Others' },
];

export const categoryLabel = (key) => CATEGORIES.find((c) => c.key === key)?.label || 'Others';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const UPLOAD_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic'];

/** Why a file can't be uploaded, or null. */
export function uploadProblem(file) {
  if (!file) return 'Choose a file to upload.';
  if (!UPLOAD_TYPES.includes(file.type)) return 'Upload a PDF, JPG, PNG or HEIC file.';
  if (file.size > MAX_UPLOAD_BYTES) return 'Files can be up to 10 MB.';
  return null;
}

/** Storage key under the patient's own folder; keeps the extension, drops anything unsafe. */
export function uploadPath(memberId, fileName, id) {
  const safe = String(fileName || 'file').replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80);
  return `patient-uploads/${memberId}/${id}-${safe}`;
}

export function fileIcon(ext) {
  const e = String(ext || '').toLowerCase();
  if (['jpg', 'jpeg', 'png', 'heic', 'gif'].includes(e)) return 'solar:gallery-linear';
  if (['mp3', 'm4a', 'wav', 'mp4'].includes(e)) return 'solar:soundwave-linear';
  return 'solar:document-text-linear';
}

export const updatedLabel = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

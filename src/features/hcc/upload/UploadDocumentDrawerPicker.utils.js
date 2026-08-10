export const ACCEPT_EXT = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.tiff,.tif';
export const ACCEPT_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/tiff',
]);

export const EXTRACT_BUCKETS = [
  { key: 'review', label: 'Needs Review', icon: 'solar:danger-circle-linear', tone: 'review' },
  { key: 'unreadable', label: 'Unreadable', icon: 'solar:danger-triangle-linear', tone: 'unreadable' },
  { key: 'added', label: 'Added to Worklist', icon: 'solar:check-circle-linear', tone: 'added' },
];

export function isAcceptedFile(file) {
  if (!file) return false;
  if (ACCEPT_MIME.has(file.type)) return true;
  return /\.(pdf|docx?|jpe?g|png|tiff?)$/i.test(file.name || '');
}

export { shortDate } from './UploadDocumentDrawer.helpers';

/* Restored from 26476f9^ — the split refactor left these referenced but
   undefined, so the drawer threw ReferenceError on render. */
export const CHOOSER_OPTIONS = [
  {
    key: 'single', tone: 'primary',
    icon: 'solar:user-rounded-linear',
    title: 'Add a Single Encounter',
    desc: 'Manually add one encounter for a patient — pick the patient, add ICDs, attach the document.',
    cta: 'Add Encounter',
  },
  {
    key: 'picker', tone: 'secondary',
    icon: 'solar:users-group-rounded-linear',
    title: 'Upload Single Document',
    desc: 'Upload one PDF that contains encounters for one or more patients — AI extracts and groups them for review.',
    cta: 'Upload PDF',
  },
  {
    key: 'sftp', tone: 'neutral',
    icon: 'solar:server-2-linear',
    title: 'Upload Multiple Documents (SFTP)',
    desc: 'Drop multiple documents on the secure SFTP server — they\'ll be ingested automatically and queued for AI review.',
    cta: 'Open SFTP Details',
  },
];

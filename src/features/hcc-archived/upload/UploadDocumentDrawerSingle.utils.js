import { ICDS as ICDS_BY_MEMBER } from '../data/icds';

export { ICDS_BY_MEMBER };

export const ACCEPT_EXT = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.tif,.tiff';

export const ACCEPT_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/tiff',
]);

export function isAcceptedFile(file) {
  if (!file) return false;
  if (ACCEPT_MIME.has(file.type)) return true;
  return /\.(pdf|docx?|jpe?g|png|tiff?)$/i.test(file.name || '');
}

export function filterPatientMatches(hccMembers, patientQuery) {
  const q = patientQuery.trim().toLowerCase();
  if (!q) return hccMembers.slice(0, 6);
  return hccMembers
    .filter(m => (m.name || '').toLowerCase().includes(q))
    .slice(0, 8);
}

export function buildAllIcds() {
  const map = new Map();
  Object.values(ICDS_BY_MEMBER).forEach(list => {
    (list || []).forEach(item => {
      if (!map.has(item.code)) map.set(item.code, item);
    });
  });
  return [...map.values()];
}

export function filterIcdMatches(allIcds, icdQuery) {
  const q = icdQuery.trim().toLowerCase();
  if (!q) return [];
  return allIcds
    .filter(i =>
      (i.code || '').toLowerCase().includes(q) ||
      (i.desc || '').toLowerCase().includes(q),
    )
    .slice(0, 6);
}

/* Restored from 26476f9^ — the split refactor left these referenced but
   undefined, so the drawer threw ReferenceError on render. */

export const WHAT_HAPPENS_NEXT_STEPS = [
  {
    n: 1,
    title: 'We extract key information',
    body: 'patient demographics, date of service, provider, place of service, and ICD codes.',
  },
  {
    n: 2,
    title: 'You review and confirm',
    body: 'Review each record and fix any flagged fields.',
  },
  {
    n: 3,
    title: 'Add or merge',
    body: 'Confirm to add a new worklist entry or merge into an existing one.',
  },
];

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


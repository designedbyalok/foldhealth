// Local fallback for the practice's inboxes until
// supabase/comms_inboxes_migration.sql has run. Mirrors that file's seed rows
// (same ids). Collaborators are matched by name here (the seed looks the ids
// up), so the fallback finds the same people.

export const INBOXES_MOCK = [
  { id: 'inbox-sms-main', channel: 'sms', name: 'Main Line', address: '+1 (775) 555-0100', collaboratorIds: [], collaboratorNames: ['Navin Jethwani', 'Devanshi Sharma'] },
  { id: 'inbox-sms-care', channel: 'sms', name: 'Care Management', address: '+1 (775) 555-0142', collaboratorIds: [], collaboratorNames: ['Abhijit Gupta'] },
  { id: 'inbox-email-care', channel: 'email', name: 'Care Team', address: 'care@foldhealth.org', collaboratorIds: [], collaboratorNames: ['Navin Jethwani'] },
  { id: 'inbox-email-referral', channel: 'email', name: 'Referrals', address: 'referrals@foldhealth.org', collaboratorIds: [], collaboratorNames: ['Abhijit Gupta', 'Devanshi Sharma'] },
];

// Which inbox the demo threads came in on, as the migration tags them; the
// rest take their channel's first inbox.
export const INBOX_TAGS_MOCK = {
  'faecd951-a90b-4093-aa27-15e20957d168': 'inbox-sms-main',
  '204781e4-4476-445a-aa72-b26effd6e888': 'inbox-sms-care',
  '10983bf7-aecf-4889-9f18-6c669921fba9': 'inbox-sms-main',
  'fa4efba3-533b-4296-9b6e-5045663c972a': 'inbox-email-care',
};
export const FIRST_INBOX_MOCK = { sms: 'inbox-sms-main', email: 'inbox-email-care' };

export const INBOX_TYPES = { sms: 'SMS', email: 'Outlook' };

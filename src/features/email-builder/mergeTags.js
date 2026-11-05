// ── Merge-tag (personalization) engine ───────────────────────────────────
// The editor stores tokens as literal text in a block's `props.text`, using
// the canonical `{{key}}` syntax (e.g. "Dear {{first_name}},"). Substitution
// happens once, on the fully-rendered email HTML, right before it is shown in
// a preview or handed to the send endpoint, see renderEmail.js. Keeping the
// tokens raw in the document means the author always sees the template, and a
// single recipient context resolves every token in one pass.

// Each token declares how to resolve itself from a recipient context object
// (camelCase fields, see SAMPLE_CONTEXT / buildRecipientContext), a sample
// value for previews, and an optional fallback used when the recipient has no
// value for that field. `group` drives the section headers in the picker.
export const MERGE_TOKENS = [
  // Patient
  { key: 'first_name',     label: 'First name',     group: 'Patient',   sample: 'Sarah',                    fallback: 'there', resolve: c => c.firstName },
  { key: 'last_name',      label: 'Last name',      group: 'Patient',   sample: 'Johnson',                  resolve: c => c.lastName },
  { key: 'full_name',      label: 'Full name',      group: 'Patient',   sample: 'Sarah Johnson',            fallback: 'there', resolve: c => c.fullName },
  { key: 'preferred_name', label: 'Preferred name', group: 'Patient',   sample: 'Sarah',                    fallback: 'there', resolve: c => c.preferredName || c.firstName },
  { key: 'dob',            label: 'Date of birth',  group: 'Patient',   sample: 'Mar 4, 1979',              resolve: c => c.dob },
  { key: 'age',            label: 'Age',            group: 'Patient',   sample: '47',                       resolve: c => c.age },
  { key: 'city',           label: 'City',           group: 'Patient',   sample: 'San Francisco',            resolve: c => c.city },
  { key: 'state',          label: 'State',          group: 'Patient',   sample: 'CA',                       resolve: c => c.state },
  { key: 'email',          label: 'Email address',  group: 'Patient',   sample: 'sarah.johnson@example.com', resolve: c => c.email },
  { key: 'phone',          label: 'Phone',          group: 'Patient',   sample: '(415) 555-0132',           resolve: c => c.phone },
  // Care team
  { key: 'provider_name',  label: 'Provider name',  group: 'Care team', sample: 'Dr. Patel',                resolve: c => c.providerName },
  { key: 'clinic_name',    label: 'Clinic name',    group: 'Care team', sample: 'Stanford Care Center',     resolve: c => c.clinicName },
  // System
  { key: 'current_date',   label: "Today's date",   group: 'System',    sample: 'September 15, 2026',       resolve: () => new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) },
  { key: 'current_year',   label: 'Current year',   group: 'System',    sample: String(new Date().getFullYear()), resolve: () => String(new Date().getFullYear()) },
  { key: 'unsubscribe_url', label: 'Unsubscribe link', group: 'System', sample: '#',                        resolve: c => c.unsubscribeUrl || '#' },
  // Report: filled in when a component (e.g. a print header) is drawn on a
  // generated report. The logo token is an image URL, for an Image block.
  { key: 'report_title',   label: 'Report title',   group: 'Report',    sample: 'Employer Impact Report',   resolve: c => c.reportTitle },
  { key: 'generated_on',   label: 'Generated on',   group: 'Report',    sample: '09/25/2026 at 5:47 PM',    resolve: c => c.generatedOn },
  { key: 'employer_logo',  label: 'Employer logo',  group: 'Report',    sample: '/brand/employer-logo-sample.svg', resolve: c => c.employerLogo },
  { key: 'page_number',    label: 'Page number',    group: 'Report',    sample: '2',                        resolve: c => c.pageNumber },
  { key: 'page_count',     label: 'Page count',     group: 'Report',    sample: '6',                        resolve: c => c.pageCount },
  // Account: filled by the server when it sends an account email (see
  // accountEmailTemplates.js and api/_lib/securityEmails.js).
  { key: 'user_id',           label: 'User ID',              group: 'Account', sample: 'sarah.johnson@example.com', resolve: c => c.userId },
  { key: 'set_password_link', label: 'Set password link',    group: 'Account', sample: '#',                          resolve: c => c.setPasswordLink },
  { key: 'sign_in_link',      label: 'Sign-in link',         group: 'Account', sample: '#',                          resolve: c => c.signInLink },
  { key: 'event_time',        label: 'Time of the change',   group: 'Account', sample: 'Oct 19, 2026, 3:13 PM PDT',  resolve: c => c.eventTime },
  { key: 'attempts',          label: 'Unsuccessful attempts', group: 'Account', sample: '5',                         resolve: c => c.attempts },
  { key: 'reset_password_link', label: 'Reset password link', group: 'Account', sample: '#',                          resolve: c => c.resetPasswordLink },
  // The patient a care team alert is about (the recipient is the admin).
  { key: 'locked_patient_name',  label: 'Locked patient name',  group: 'Account', sample: 'Michael Brown',            resolve: c => c.lockedPatientName },
  { key: 'locked_patient_id',    label: 'Locked patient ID',    group: 'Account', sample: '11089',                    resolve: c => c.lockedPatientId },
  { key: 'locked_patient_email', label: 'Locked patient email', group: 'Account', sample: 'michael.brown@example.com', resolve: c => c.lockedPatientEmail },
  { key: 'patient_profile_link', label: 'Patient profile link', group: 'Account', sample: '#',                        resolve: c => c.patientProfileLink },
];

const TOKEN_BY_KEY = Object.fromEntries(MERGE_TOKENS.map(t => [t.key, t]));

// Group order + membership for the picker UI.
export const TOKEN_GROUPS = ['Patient', 'Care team', 'System', 'Report', 'Account'].map(group => ({
  group,
  tokens: MERGE_TOKENS.filter(t => t.group === group),
}));

// Human-readable / short token names that map onto canonical keys. Lets the
// engine resolve every convention that shipped in existing templates,
// "{{First Name}}", "{{name}}", "{surname}", "{Patient Name}", without a data
// migration. Keys here are already normalized (lowercased, spaces → "_").
const NAME_ALIASES = {
  patient_name: 'full_name',
  name: 'full_name',
  fullname: 'full_name',
  firstname: 'first_name',
  lastname: 'last_name',
  surname: 'last_name',
  providername: 'provider_name',
  clinicname: 'clinic_name',
};

// Normalize a raw tag name ("First Name", "firstName", "first_name") to a
// canonical key.
function resolveName(rawName, ctx) {
  const norm = rawName.trim().toLowerCase().replace(/[\s-]+/g, '_');
  const key = NAME_ALIASES[norm] || NAME_ALIASES[norm.replace(/_/g, '')] || norm;
  const token = TOKEN_BY_KEY[key];
  return token ? valueFor(token, ctx) : undefined;
}

// Double-brace tokens: {{ First Name }}, {{first_name}}, {{email}}.
const DOUBLE_RE = /\{\{\s*([a-zA-Z0-9_][a-zA-Z0-9_ -]*?)\s*\}\}/g;
// Single-brace tokens: {Patient Name}, {name}. Only replaced when the name
// resolves to a known token, so CSS braces ("{display:block}", has a colon,
// excluded by the char class anyway) are never touched.
const SINGLE_RE = /\{\s*([a-zA-Z][a-zA-Z0-9_ -]*?)\s*\}/g;

function valueFor(token, ctx) {
  if (!token) return null;
  const v = token.resolve(ctx);
  if (v === null || v === undefined || v === '') return token.fallback ?? '';
  return String(v);
}

/**
 * Replace every merge tag in a string with values from `ctx`.
 * Resolves both double-brace ({{First Name}}, {{first_name}}) and single-brace
 * ({Patient Name}) syntaxes, normalizing spaced/camel/snake names and a set of
 * human-readable aliases. Unknown tokens are left untouched so a typo stays
 * visible rather than silently blanking. Safe to run on a full HTML document.
 */
export function applyMergeTags(input, ctx = {}) {
  if (typeof input !== 'string' || input === '') return input;
  let out = input.replace(DOUBLE_RE, (m, name) => {
    const v = resolveName(name, ctx);
    return v === undefined ? m : v;
  });
  out = out.replace(SINGLE_RE, (m, name) => {
    const v = resolveName(name, ctx);
    return v === undefined ? m : v;
  });
  return out;
}

// Realistic values for in-app previews and test sends, so the author sees
// "Dear Sarah," instead of "Dear {{first_name}},".
export const SAMPLE_CONTEXT = {
  firstName: 'Sarah',
  lastName: 'Johnson',
  fullName: 'Sarah Johnson',
  preferredName: 'Sarah',
  dob: 'Mar 4, 1979',
  age: 47,
  city: 'San Francisco',
  state: 'CA',
  email: 'sarah.johnson@example.com',
  phone: '(415) 555-0132',
  providerName: 'Dr. Patel',
  clinicName: 'Stanford Care Center',
  unsubscribeUrl: '#',
  reportTitle: 'Employer Impact Report',
  generatedOn: '09/25/2026 at 5:47 PM',
  employerLogo: '/brand/employer-logo-sample.svg',
  pageNumber: '2',
  pageCount: '6',
  userId: 'sarah.johnson@example.com',
  setPasswordLink: '#',
  signInLink: '#',
  eventTime: 'Oct 19, 2026, 3:13 PM PDT',
  attempts: '5',
  resetPasswordLink: '#',
  lockedPatientName: 'Michael Brown',
  lockedPatientId: '11089',
  lockedPatientEmail: 'michael.brown@example.com',
  patientProfileLink: '#',
};

/**
 * Map an `all_patients` row (store shape) to a recipient context for a real
 * per-recipient render. Used by the campaign send engine (next slice); kept
 * here so the token contract lives in one place.
 */
export function buildRecipientContext(patient = {}, extra = {}) {
  const full = patient.name || [patient.firstName, patient.lastName].filter(Boolean).join(' ');
  const first = patient.firstName || (full ? full.split(' ')[0] : '');
  const last = patient.lastName || (full ? full.split(' ').slice(1).join(' ') : '');
  return {
    firstName: first,
    lastName: last,
    fullName: full,
    preferredName: patient.chosenName || first,
    dob: patient.dob,
    age: patient.age,
    city: patient.city,
    state: patient.state,
    email: patient.email,
    phone: patient.phone,
    providerName: extra.providerName,
    clinicName: extra.clinicName,
    unsubscribeUrl: extra.unsubscribeUrl,
  };
}

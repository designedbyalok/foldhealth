// ── Merge-tag (personalization) engine ───────────────────────────────────
// The editor stores tokens as literal text in a block's `props.text`, using
// the canonical `{{key}}` syntax (e.g. "Dear {{first_name}},"). Substitution
// happens once, on the fully-rendered email HTML, right before it is shown in
// a preview or handed to the send endpoint — see renderEmail.js. Keeping the
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
];

const TOKEN_BY_KEY = Object.fromEntries(MERGE_TOKENS.map(t => [t.key, t]));

// Group order + membership for the picker UI.
export const TOKEN_GROUPS = ['Patient', 'Care team', 'System'].map(group => ({
  group,
  tokens: MERGE_TOKENS.filter(t => t.group === group),
}));

// Human-readable / short token names that map onto canonical keys. Lets the
// engine resolve every convention that shipped in existing templates —
// "{{First Name}}", "{{name}}", "{surname}", "{Patient Name}" — without a data
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
// resolves to a known token, so CSS braces ("{display:block}" — has a colon,
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

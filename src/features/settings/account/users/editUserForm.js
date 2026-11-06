import { PHYSICIAN_ROLE } from '../../../../data/medicalSpecialties';

// The Edit User form's rules, shared by the desktop drawer (EditUserDrawer)
// and the phone's edit screen so both save the same row and audit entry.

export const EHR_SYSTEMS = ['Athena Health', 'Epic', 'Cerner', 'eClinicalWorks', 'Allscripts', 'NextGen', 'Greenway Health', 'DrChrono'];
// US states + DC: licence states are a fixed set, so a multi-select reads
// cleaner than free-typed tags.
export const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware',
  'District of Columbia', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota',
  'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
  'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon',
  'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah',
  'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
];

/** The saved-state baseline of the form for a Users-tab user (with `_raw`). */
export function editUserInitialForm(user) {
  const raw = user._raw || {};
  return {
    first_name: raw.first_name || user.name?.split(' ')[0] || '',
    middle_name: raw.middle_name || '',
    last_name: raw.last_name || user.name?.split(' ').slice(1).join(' ') || '',
    date_of_birth: raw.date_of_birth || '',
    gender: raw.gender || '',
    admin_role: raw.admin_role || 'Business/Practice Owner',
    role: raw.role || user.role || 'Viewer',
    bio: raw.bio || '',
    mobile: raw.mobile || raw.phone || user.phone || '',
    email: raw.email || user.email || '',
    fax: raw.fax || '',
    zip_code: raw.zip_code || '',
    address_line1: raw.address_line1 || '',
    address_line2: raw.address_line2 || '',
    state: raw.state || '',
    city: raw.city || '',
    locations: raw.locations || [],
    languages: raw.languages || [],
    credentials: raw.credentials || [],
    licence_states: raw.licence_states || [],
    clinical_roles: raw.clinical_roles || [],
    specialties: raw.specialties || [],
    ehr_mapping: raw.ehr_mapping || '',
    ehr_user: raw.ehr_user || '',
  };
}

/** The `profiles` update the form saves. */
export function buildEditUserUpdates(form) {
  return {
    full_name: `${form.first_name} ${form.last_name}`.trim(),
    first_name: form.first_name, middle_name: form.middle_name, last_name: form.last_name,
    // `date` column: an empty field has to go up as null, not "".
    date_of_birth: form.date_of_birth || null, gender: form.gender,
    admin_role: form.admin_role, role: form.clinical_roles.length > 0 ? form.clinical_roles[0] : 'Viewer', bio: form.bio,
    mobile: form.mobile, fax: form.fax, zip_code: form.zip_code,
    address_line1: form.address_line1, address_line2: form.address_line2,
    state: form.state, city: form.city,
    locations: form.locations, languages: form.languages,
    credentials: form.credentials, licence_states: form.licence_states,
    clinical_roles: form.clinical_roles, ehr_mapping: form.ehr_mapping, ehr_user: form.ehr_user,
    // Only doctors carry a specialty; dropping the role clears it.
    specialties: form.clinical_roles.includes(PHYSICIAN_ROLE) ? form.specialties : [],
  };
}

/** Field-level changes against the saved row, for the UserProfile audit entry. */
export function editUserChanges(updates, raw) {
  const changes = [];
  for (const [key, val] of Object.entries(updates)) {
    const oldVal = raw[key];
    const newStr = Array.isArray(val) ? val.join(', ') : String(val || '');
    const oldStr = Array.isArray(oldVal) ? (oldVal || []).join(', ') : String(oldVal || '');
    if (newStr !== oldStr) changes.push({ field: key, from: oldStr, to: newStr, type: 'text' });
  }
  return changes;
}

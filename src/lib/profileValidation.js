/**
 * Profile field types + validation for the `profiles` table.
 *
 * JS rules here and CHECK constraints in
 * `supabase/profiles_field_types_migration.sql` must stay in sync — if you
 * change one, change the other.
 */
import { isValidNamePart } from './nameValidation';

/** Allowed gender values — matches `profiles_gender_check` in Postgres. */
export const PROFILE_GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

/** Allowed language values — stored as a JSONB string array on `profiles`. */
export const PROFILE_LANGUAGE_OPTIONS = [
  'English', 'Spanish', 'Cantonese', 'Mandarin', 'Vietnamese', 'Korean',
  'Tagalog', 'Arabic', 'French', 'Hindi',
];

/** Canonical field metadata (type, limits, required). */
export const PROFILE_FIELD_TYPES = {
  first_name:     { type: 'string',  required: true,  maxLength: 100 },
  last_name:      { type: 'string',  required: true,  maxLength: 100 },
  middle_name:    { type: 'string',  required: false, maxLength: 100 },
  gender:         { type: 'enum',    required: false, values: PROFILE_GENDER_OPTIONS },
  date_of_birth:  { type: 'date',    required: false }, // ISO YYYY-MM-DD
  mobile:         { type: 'phone',   required: false, maxLength: 20 },
  email:          { type: 'email',   required: false, readOnly: true },
  languages:      { type: 'string[]', required: false, values: PROFILE_LANGUAGE_OPTIONS },
  bio:            { type: 'text',    required: false, maxLength: 500 },
  address_line1:  { type: 'string',  required: false, maxLength: 200 },
  address_line2:  { type: 'string',  required: false, maxLength: 200 },
  city:           { type: 'string',  required: false, maxLength: 100 },
  state:          { type: 'string',  required: false, maxLength: 100 },
  zip_code:       { type: 'zip',     required: false },
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
// Shape only — allowed characters, not length. The `{7,20}` quantifier used to
// carry the length rule too, but it applies to the characters AFTER the
// optional `+`, so a leading-plus number could reach 21 characters and still
// match. `profiles_mobile_check` caps char_length at 20, so "+" plus 20 digits
// passed here and was then rejected by Postgres — surfacing as a raw DB error
// toast instead of the inline field message. Length is asserted explicitly in
// isValidPhone() against the same bounds as the constraint.
const PHONE_SHAPE = /^[+]?[\d\s().-]+$/;
const PHONE_MIN = 7;    // matches profiles_mobile_check's lower bound
const US_ZIP = /^\d{5}(-\d{4})?$/;

export function isValidIsoDate(str) {
  const v = (str || '').trim();
  if (!v) return true;
  if (!ISO_DATE.test(v)) return false;
  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  return d.toISOString().slice(0, 10) === v;
}

export function isValidPhone(str) {
  const v = (str || '').trim();
  if (!v) return true;
  // Length checked on the whole string, exactly as the DB checks char_length,
  // so the client can never accept a number Postgres will refuse. The upper
  // bound reads from PROFILE_FIELD_TYPES rather than a second local constant —
  // one number to keep in step with the constraint, not two.
  return v.length >= PHONE_MIN
    && v.length <= PROFILE_FIELD_TYPES.mobile.maxLength
    && PHONE_SHAPE.test(v);
}

export function isValidZipCode(str) {
  const v = (str || '').trim();
  if (!v) return true;
  return US_ZIP.test(v);
}

export function isValidGender(str) {
  const v = (str || '').trim();
  if (!v) return true;
  return PROFILE_GENDER_OPTIONS.includes(v);
}

export function isValidLanguages(arr) {
  if (!arr || arr.length === 0) return true;
  if (!Array.isArray(arr)) return false;
  return arr.every(l => PROFILE_LANGUAGE_OPTIONS.includes(l));
}

export function isValidBio(str) {
  return (str || '').length <= PROFILE_FIELD_TYPES.bio.maxLength;
}

function trimOrNull(str) {
  const v = (str || '').trim();
  return v || null;
}

/** Per-field validators — return an error message or null. */
export const PROFILE_FIELD_VALIDATORS = {
  first_name: (v) => {
    if (!isValidNamePart(v)) return 'First name is required and must start with a capital letter';
    if (v.trim().length > PROFILE_FIELD_TYPES.first_name.maxLength) return 'First name is too long';
    return null;
  },
  last_name: (v) => {
    if (!isValidNamePart(v)) return 'Last name is required and must start with a capital letter';
    if (v.trim().length > PROFILE_FIELD_TYPES.last_name.maxLength) return 'Last name is too long';
    return null;
  },
  gender: (v) => (isValidGender(v) ? null : 'Select a valid gender'),
  date_of_birth: (v) => (isValidIsoDate(v) ? null : 'Enter a valid date (MM/DD/YYYY)'),
  mobile: (v) => (isValidPhone(v) ? null : 'Enter a valid phone number'),
  languages: (v) => (isValidLanguages(v) ? null : 'One or more languages are not allowed'),
  bio: (v) => (isValidBio(v) ? null : `Bio must be ${PROFILE_FIELD_TYPES.bio.maxLength} characters or fewer`),
  address_line1: (v) => ((v || '').trim().length <= PROFILE_FIELD_TYPES.address_line1.maxLength ? null : 'Address line 1 is too long'),
  address_line2: (v) => ((v || '').trim().length <= PROFILE_FIELD_TYPES.address_line2.maxLength ? null : 'Address line 2 is too long'),
  city: (v) => ((v || '').trim().length <= PROFILE_FIELD_TYPES.city.maxLength ? null : 'City is too long'),
  state: (v) => ((v || '').trim().length <= PROFILE_FIELD_TYPES.state.maxLength ? null : 'State is too long'),
  zip_code: (v) => (isValidZipCode(v) ? null : 'Enter a valid US zip code (12345 or 12345-6789)'),
};

const FORM_KEYS = [
  'first_name', 'last_name', 'gender', 'date_of_birth', 'mobile',
  'languages', 'bio', 'address_line1', 'address_line2', 'city', 'state', 'zip_code',
];

/** Validate every editable profile field; returns `{ valid, errors }`. */
export function validateProfileForm(form) {
  const errors = {};
  for (const key of FORM_KEYS) {
    const msg = PROFILE_FIELD_VALIDATORS[key]?.(form[key]);
    if (msg) errors[key] = msg;
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

/** Shape a self-update payload for `profiles` — strips read-only / auth columns. */
export function sanitizeProfileForDb(form) {
  return {
    first_name: form.first_name.trim(),
    last_name: form.last_name.trim(),
    full_name: `${form.first_name.trim()} ${form.last_name.trim()}`.trim(),
    gender: trimOrNull(form.gender),
    date_of_birth: trimOrNull(form.date_of_birth),
    mobile: trimOrNull(form.mobile),
    languages: Array.isArray(form.languages) ? form.languages : [],
    bio: trimOrNull(form.bio),
    address_line1: trimOrNull(form.address_line1),
    address_line2: trimOrNull(form.address_line2),
    city: trimOrNull(form.city),
    state: trimOrNull(form.state),
    zip_code: trimOrNull(form.zip_code),
  };
}

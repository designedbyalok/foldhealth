// Patient records store dob as text, 'MM/DD/YYYY' or 'YYYY-MM-DD'. Parsed as a
// local date (never through Date's UTC parsing, which shifts the day).
export function parseDob(dob) {
  const s = String(dob || '').trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(+m[3], +m[1] - 1, +m[2]);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  return null;
}

export function ageFrom(dob, today = new Date()) {
  const d = parseDob(dob);
  if (!d) return null;
  let age = today.getFullYear() - d.getFullYear();
  const beforeBirthday = today.getMonth() < d.getMonth()
    || (today.getMonth() === d.getMonth() && today.getDate() < d.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 ? age : null;
}

const SEX = { M: 'Male', F: 'Female', Male: 'Male', Female: 'Female' };

/** "Male • 72 years", leaving out whatever is unknown. */
export function sexAndAge(profile, today) {
  const age = ageFrom(profile?.dob, today);
  return [SEX[profile?.gender] || profile?.gender, age != null ? `${age} ${age === 1 ? 'year' : 'years'}` : null]
    .filter(Boolean).join(' • ');
}

export const firstName = (profile) => String(profile?.name || '').trim().split(/\s+/)[0] || 'Patient';

/** First name, or the full name when another profile shares the first name. */
export function shortName(profile, profiles = []) {
  const first = firstName(profile);
  const clash = profiles.some((p) => p.member_id !== profile?.member_id && firstName(p) === first);
  return clash ? String(profile?.name || first).trim() : first;
}

export function initialsOf(profile) {
  if (profile?.initials) return profile.initials;
  const parts = String(profile?.name || '').trim().split(/\s+/).filter(Boolean);
  return (parts.slice(0, 2).map((p) => p[0]).join('') || '?').toUpperCase();
}

// Who a whitelisted measure applies to: sex and age as of Dec 31 of the
// measure year (the HEDIS denominator), from the whitelist row.

const SEX_LABEL = { F: 'female', M: 'male' };

// Age on Dec 31 of the measure year, from DOB (MM/DD/YYYY), else the "79y"
// age label. Null when neither can be read.
export function ageAtYearEnd(member, measureYear) {
  const m = String(member?.dob || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return measureYear - Number(m[3]);
  const y = String(member?.age || '').match(/(\d+)\s*y/);
  if (y) return Number(y[1]) + (measureYear - new Date().getFullYear());
  return /^\d+\s*[dmw]/.test(String(member?.age || '')) ? 0 : null;
}

const ageRange = (w) => (w.ageMin != null && w.ageMax != null ? `ages ${w.ageMin}–${w.ageMax}`
  : w.ageMin != null ? `ages ${w.ageMin}+` : w.ageMax != null ? `up to age ${w.ageMax}` : null);

// Who the measure applies to, e.g. "Female, ages 40–74" or "All patients".
export function applicabilityLabel(w) {
  const text = [w.sex ? `${SEX_LABEL[w.sex]} patients` : null, ageRange(w)].filter(Boolean).join(', ');
  return text ? text[0].toUpperCase() + text.slice(1) : 'All patients';
}

// Why the measure doesn't apply to this patient, or null when it does (or
// when the patient's sex / age isn't known, so nothing is hidden on a guess).
export function notApplicableReason(w, member, measureYear) {
  const sex = String(member?.gender || '').toUpperCase().slice(0, 1);
  const wrongSex = w.sex && (sex === 'M' || sex === 'F') && sex !== w.sex;
  const age = ageAtYearEnd(member, measureYear);
  const wrongAge = age != null && ((w.ageMin != null && age < w.ageMin) || (w.ageMax != null && age > w.ageMax));
  if (!wrongSex && !wrongAge) return null;
  return [w.sex ? `${SEX_LABEL[w.sex]} patients` : null, ageRange(w)].filter(Boolean).join(', ');
}

// Patient DOB helpers.
//
// deriveDob(age, seed)     — deterministic mm/dd/yyyy from an "Ny Mm" age
//                            string, walking today back by that delta. Day
//                            comes from a stable hash of `seed` (typically
//                            the patient's name) so the same patient always
//                            gets the same day (1..28).
// formatDobDisplay(input)  — normalize a stored dob to mm/dd/yyyy. Accepts
//                            ISO ("1958-10-22"), mm/dd/yyyy (passthrough),
//                            or Date. Returns '' if the input is unusable.

function nameHash(s) {
  let h = 0;
  const str = String(s || '');
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h);
}

function pad2(n) { return String(n).padStart(2, '0'); }

export function deriveDob(age, seed = '', today = new Date()) {
  const m = /^(\d+)y\s*(\d+)m$/i.exec(String(age || '').trim());
  if (!m) return '';
  const years = Number(m[1]);
  const months = Number(m[2]);
  const born = new Date(today.getFullYear() - years, today.getMonth() - months, 1);
  const day = 1 + (nameHash(seed) % 28);
  return `${pad2(born.getMonth() + 1)}/${pad2(day)}/${born.getFullYear()}`;
}

export function formatDobDisplay(input) {
  if (!input) return '';
  if (input instanceof Date && !isNaN(input)) {
    return `${pad2(input.getMonth() + 1)}/${pad2(input.getDate())}/${input.getFullYear()}`;
  }
  const s = String(input).trim();
  // Already mm/dd/yyyy (or single-digit m/d) — normalize padding.
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (us) return `${pad2(us[1])}/${pad2(us[2])}/${us[3]}`;
  // ISO yyyy-mm-dd → mm/dd/yyyy.
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[2]}/${iso[3]}/${iso[1]}`;
  return '';
}

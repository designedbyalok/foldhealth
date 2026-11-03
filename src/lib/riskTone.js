// LACE readmission risk (High / Medium / Low) as a Badge tone. Shared by the
// worklists that show a LACE column, so the colors agree everywhere.
const LACE_TONE = { high: 'danger', medium: 'warning', low: 'success' };

export function laceTone(level) {
  return LACE_TONE[String(level || '').toLowerCase()] || 'neutral';
}

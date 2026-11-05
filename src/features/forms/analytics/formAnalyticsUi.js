/** Small shared UI helpers for the form Analytics views (icons, colors, formatters). */

// Categorical palette for distributions (donut segments / legend dots).
export const SERIES_COLORS = [
  '#7C9CD6', '#B7C8E8', '#7FD1B0', '#C9A7E0', '#B8C06B', '#E0A7B7', '#86C7D8', '#D6B27C',
];

export const SEV_COLOR = {
  neutral: 'var(--neutral-300)',
  info: 'var(--status-info)',
  warning: 'var(--status-warning)',
  high: 'var(--status-warning)',
  critical: 'var(--status-error)',
};

/** Solar icon for a field, by type/control, used in the question chips. */
export function fieldIcon(field) {
  if (field.type === 'choice') return 'solar:chart-2-linear';
  if (field.type === 'integer' || field.type === 'decimal') return 'solar:hashtag-linear';
  if (field.type === 'text') return 'solar:document-text-linear';
  if (field.control === 'email') return 'solar:letter-linear';
  if (field.type === 'date') return 'solar:calendar-linear';
  if (field.type === 'boolean') return 'solar:check-square-linear';
  return 'solar:text-field-linear';
}

/** Initials from a display name. */
export function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

export function fmtDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** "Mar 16, 2023 – Aug 16, 2023" from the response timestamps, or "All time". */
export function dateRangeLabel(responses) {
  const times = [];
  for (const r of responses) {
    const t = new Date(r.createdAt).getTime();
    if (!Number.isNaN(t)) times.push(t);
  }
  if (!times.length) return 'All time';
  const opt = { month: 'short', day: 'numeric', year: 'numeric' };
  const lo = new Date(Math.min(...times)).toLocaleDateString('en-US', opt);
  const hi = new Date(Math.max(...times)).toLocaleDateString('en-US', opt);
  return lo === hi ? lo : `${lo} – ${hi}`;
}

export function formatAnswerValue(v) {
  if (v == null || v === '') return '-';
  if (Array.isArray(v)) return v.length ? v.join(', ') : '-';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

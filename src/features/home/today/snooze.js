// Snooze rules for the Home Today list (review F-24).

export const SNOOZE_MAX_DAYS = 30;

export const SNOOZE_REASONS = [
  'Patient asked to be contacted later',
  'Waiting on provider',
  'Waiting on results or records',
  'Patient in hospital or facility',
  'Patient unavailable or traveling',
];

const pad = (n) => String(n).padStart(2, '0');

/** `YYYY-MM-DD` plus n days, in local time. */
export function addDaysIso(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

/** Stable key for a row's snooze: the scenario bound to that patient. */
export function snoozeKey(item) {
  return `${item.id}:${item.memberId || item.patientId || ''}`;
}

/** A snooze counts only until its date arrives; the row is back on that day. */
export function activeSnooze(snoozes, item, today) {
  const s = snoozes?.[snoozeKey(item)];
  return s && s.until > today ? s : null;
}

/** Keep the order, but move snoozed rows to the end and tag them. */
export function applySnoozes(rows, snoozes, today) {
  const awake = [];
  const asleep = [];
  for (const r of rows) {
    const s = activeSnooze(snoozes, r, today);
    if (s) asleep.push({ ...r, snooze: s });
    else awake.push(r);
  }
  return [...awake, ...asleep];
}

/** "Mon, Nov 17" for a date-only ISO string, parsed as a local date. */
export function formatSnoozeDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

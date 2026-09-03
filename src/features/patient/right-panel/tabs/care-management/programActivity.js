// Program Activity Log helpers — icon/token mapping + grouping of raw activity
// entries into month → day → (date × program) stacks or single rows.

/** Per activity-kind icon + token-based colors (no raw hex). */
export const ACTIVITY_ICON = {
  letter:    { icon: 'solar:letter-linear',         bg: 'var(--accent-light-cyan)',         color: 'var(--accent-cyan)' },
  document:  { icon: 'solar:document-text-linear',  bg: 'var(--accent-light-amber)',        color: 'var(--accent-amber)' },
  clipboard: { icon: 'solar:clipboard-text-linear', bg: 'var(--accent-light-persian-blue)', color: 'var(--accent-persian-blue)' },
  call:      { icon: 'solar:phone-linear',          bg: 'var(--neutral-50)',                color: 'var(--neutral-300)' },
  sms:       { icon: 'solar:chat-round-linear',     bg: 'var(--accent-light-blue)',         color: 'var(--accent-blue)' },
  email:     { icon: 'solar:letter-linear',         bg: 'var(--accent-light-teal)',         color: 'var(--accent-teal)' },
  status:    { icon: 'solar:refresh-linear',        bg: 'var(--accent-light-light-green)',  color: 'var(--accent-light-green)' },
};
export const activityIcon = (kind) => ACTIVITY_ICON[kind] || ACTIVITY_ICON.document;

/** Inline status-label color by status type. */
export const STATUS_COLOR = {
  success: 'var(--status-success)',
  warning: 'var(--status-warning)',
  error: 'var(--status-error)',
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const monthLabel = (d) => `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
const dateShort = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
const timeLabel = (d) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

function mapEntryItem(e, d) {
  return {
    id: e.id,
    occurredAt: d.getTime(),
    dateLabel: dateShort(d),
    time: timeLabel(d),
    actorName: e.actorName,
    title: e.title,
    statusLabel: e.statusLabel,
    statusType: e.statusType,
    activityKind: e.activityKind,
    programCode: e.programCode,
  };
}

/**
 * Group entries (pre-sorted newest-first) into months → days → per-program
 * stacks. Same calendar day + same program → one stacked group; same day +
 * different programs → separate entries so each program reads on its own.
 */
export function groupProgramActivity(entries) {
  const months = [];
  const monthByKey = new Map();
  const dayByKey = new Map();

  for (const e of entries) {
    const d = new Date(e.occurredAt);
    if (Number.isNaN(d.getTime())) continue;
    const mKey = monthLabel(d);
    let month = monthByKey.get(mKey);
    if (!month) {
      month = { key: mKey, label: mKey, days: [] };
      monthByKey.set(mKey, month);
      months.push(month);
    }

    const dateKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const dayKey = `${mKey}|${dateKey}`;
    let day = dayByKey.get(dayKey);
    if (!day) {
      day = {
        key: dayKey,
        date: dateShort(d),
        day: DAYS[d.getDay()],
        sortKey: d.getTime(),
        entries: [],
      };
      dayByKey.set(dayKey, day);
      month.days.push(day);
    }

    const cKey = `${dayKey}|${e.programCode}`;
    let entry = day.entries.find(x => x.key === cKey);
    if (!entry) {
      entry = {
        key: cKey,
        programCode: e.programCode,
        programName: e.programName,
        items: [],
        userSet: new Set(),
        sortKey: d.getTime(),
      };
      day.entries.push(entry);
    }
    entry.items.push(mapEntryItem(e, d));
    if (e.actorInitials) entry.userSet.add(e.actorInitials);
    if (d.getTime() > entry.sortKey) entry.sortKey = d.getTime();
    if (d.getTime() > day.sortKey) day.sortKey = d.getTime();
  }

  for (const m of months) {
    m.days.sort((a, b) => b.sortKey - a.sortKey);
    for (const day of m.days) {
      day.entries.sort((a, b) => b.sortKey - a.sortKey);
      for (const entry of day.entries) {
        entry.users = [...entry.userSet];
        entry.userCount = entry.users.length;
        entry.count = entry.items.length;
        entry.type = entry.count > 1 ? 'group' : 'single';
        entry.items.sort((a, b) => b.occurredAt - a.occurredAt);
        delete entry.userSet;
        delete entry.sortKey;
      }
      delete day.sortKey;
    }
  }
  return months;
}

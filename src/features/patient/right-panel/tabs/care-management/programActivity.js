// Program Activity Log helpers — icon/token mapping + grouping of raw activity
// entries into month → (date × program) cards.

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
  warning: 'var(--status-warning-dark)',
  error: 'var(--status-error)',
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const monthLabel = (d) => `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
const dateShort = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
const timeLabel = (d) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

/**
 * Group entries (pre-sorted newest-first) into months, and within each month
 * into one card per (date × program). Same date across programs → separate
 * cards, so each program's changes read on their own.
 */
export function groupProgramActivity(entries) {
  const months = [];
  const monthByKey = new Map();
  const cardByKey = new Map();

  for (const e of entries) {
    const d = new Date(e.occurredAt);
    if (Number.isNaN(d.getTime())) continue;
    const mKey = monthLabel(d);
    let month = monthByKey.get(mKey);
    if (!month) { month = { key: mKey, label: mKey, cards: [] }; monthByKey.set(mKey, month); months.push(month); }

    const cKey = `${mKey}|${d.getFullYear()}-${d.getMonth()}-${d.getDate()}|${e.programCode}`;
    let card = cardByKey.get(cKey);
    if (!card) {
      card = {
        key: cKey, date: dateShort(d), day: DAYS[d.getDay()],
        programName: e.programName, programCode: e.programCode,
        items: [], userSet: new Set(),
      };
      cardByKey.set(cKey, card);
      month.cards.push(card);
    }
    card.items.push({
      id: e.id, time: timeLabel(d), actorName: e.actorName, title: e.title,
      statusLabel: e.statusLabel, statusType: e.statusType, activityKind: e.activityKind,
    });
    if (e.actorInitials) card.userSet.add(e.actorInitials);
  }

  for (const m of months) {
    for (const c of m.cards) {
      c.users = [...c.userSet];
      c.userCount = c.users.length;
      c.count = c.items.length;
      delete c.userSet;
    }
  }
  return months;
}

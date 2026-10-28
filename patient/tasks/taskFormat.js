// Time-of-day groups the server assigns from each medicine's sig, in order.
export const SLOTS = [
  { id: 'morning', label: 'Morning meds' },
  { id: 'afternoon', label: 'Afternoon meds' },
  { id: 'evening', label: 'Evening meds' },
  { id: 'night', label: 'Bedtime meds' },
  { id: 'anytime', label: 'Anytime meds' },
  { id: 'as_needed', label: 'As needed' },
];

/** 'YYYY-MM-DD' for the patient's local day (never through UTC). */
export function dayKey(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export function addDays(date, n) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + n);
  return d;
}

export const dayLabel = (date) => date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** "Sent today", "Sent 3 days ago". */
export function sentLabel(sentAt, now = new Date()) {
  const sent = new Date(sentAt);
  if (Number.isNaN(sent.getTime())) return '';
  const days = Math.round((addDays(now, 0) - addDays(sent, 0)) / 86400000);
  if (days <= 0) return 'Sent today';
  if (days === 1) return 'Sent yesterday';
  return `Sent ${days} days ago`;
}

const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** "9:28 PM" today, "Yesterday", "Mon", or "Oct 12" for older. For lists. */
export function listTime(iso, now = new Date()) {
  if (!iso) return '';
  const d = new Date(iso);
  if (sameDay(d, now)) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (sameDay(d, yesterday)) return 'Yesterday';
  const days = (now - d) / 86400000;
  if (days < 7) return d.toLocaleDateString('en-US', { weekday: 'short' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** "Today, 9:28 PM", "Yesterday, 9:28 PM" or "Oct 12, 9:28 PM". Under a bubble. */
export function bubbleTime(iso, now = new Date()) {
  if (!iso) return '';
  const d = new Date(iso);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (sameDay(d, now)) return `Today, ${time}`;
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (sameDay(d, yesterday)) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}`;
}

export const initialsFrom = (name) => String(name || '')
  .replace(/^(dr|nr|nurse)\.?\s+/i, '')
  .split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?';

/** Conversations whose title or member names match the search. */
export function filterConversations(conversations, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return conversations;
  return conversations.filter((c) => [c.title, ...(c.member_names || [])].some((s) => String(s || '').toLowerCase().includes(q)));
}

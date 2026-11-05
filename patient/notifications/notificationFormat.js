const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** "Today", "Yesterday", or "Mon, Oct 12" for a notification's day. */
export function dayLabel(iso, now = new Date()) {
  const d = new Date(iso);
  if (sameDay(d, now)) return 'Today';
  if (sameDay(d, new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Newest first, grouped by day: [{ label, items }]. */
export function groupByDay(items, now = new Date()) {
  const groups = [];
  [...items].sort((a, b) => new Date(b.at) - new Date(a.at)).forEach((item) => {
    const label = dayLabel(item.at, now);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  });
  return groups;
}

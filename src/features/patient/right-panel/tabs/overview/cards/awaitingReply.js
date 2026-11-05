// Threads waiting on the care team: inbound messages nobody has opened yet
// (unread_count > 0), longest wait first, with how long and who should reply.

const HOUR = 3600 * 1000;

/** "45m", "5h", "3d" since `iso`, and a tone: amber past a day, red past two. */
export function waitLabel(iso, now = Date.now()) {
  const ms = Math.max(0, now - new Date(iso).getTime());
  if (Number.isNaN(ms)) return { label: '', tone: 'default' };
  const hours = ms / HOUR;
  const label = hours < 1 ? `${Math.max(1, Math.round(ms / 60000))}m` : hours < 24 ? `${Math.floor(hours)}h` : `${Math.floor(hours / 24)}d`;
  return { label, tone: hours >= 48 ? 'error' : hours >= 24 ? 'warning' : 'default' };
}

/** The patient's threads awaiting a reply, oldest wait first. */
export function awaitingReply(conversations) {
  return (conversations || [])
    .filter(c => !c.archived && Number(c.unread_count) > 0)
    .sort((a, b) => new Date(a.last_message_at) - new Date(b.last_message_at));
}

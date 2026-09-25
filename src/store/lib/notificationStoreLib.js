export function mapNotificationRow(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body || '',
    action: row.action || null,
    taskId: row.task_id ?? null,
    hccMemberId: row.hcc_member_id ?? null,
    referralId: row.referral_id ?? null,
    read: !!row.read,
    ts: row.created_at ? Date.parse(row.created_at) : Date.now(),
    actorName: row.actor_name || null,
    persisted: true,
  };
}

/** Newest-first merge; incoming rows win on id collision. */
export function mergeNotifications(incoming, existing) {
  const byId = new Map();
  for (const n of [...existing, ...incoming]) byId.set(n.id, n);
  return [...byId.values()].sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 50);
}

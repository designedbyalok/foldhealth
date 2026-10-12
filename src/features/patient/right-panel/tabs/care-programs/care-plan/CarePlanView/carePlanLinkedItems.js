/** Linked-items helpers for care plan GBI rows (goals, interventions, barriers). */
export function barrierGoalIds(barrier) {
  if (Array.isArray(barrier.goalIds) && barrier.goalIds.length > 0) return barrier.goalIds;
  return barrier.goalId ? [barrier.goalId] : [];
}

export function linkedForGoal(goal, live, programBadge) {
  const badge = programBadge;
  return {
    programs: badge,
    interventions: (live?.interventions || []).filter(i => i.goalId === goal.id).map(i => ({ id: i.id, icon: i.icon, title: i.title })),
    barriers: (live?.barriers || []).filter(b => barrierGoalIds(b).includes(goal.id)).map(b => ({ id: b.id, title: b.title })),
    automations: (live?.automations || []).filter(a => a.goalId === goal.id).map(a => ({ id: a.id, title: a.title })),
  };
}

export function linkedForChild(item, live, programBadge) {
  const parentGoalIds = Array.isArray(item.goalIds) && item.goalIds.length > 0
    ? item.goalIds
    : (item.goalId ? [item.goalId] : []);
  return {
    programs: programBadge,
    goals: (live?.goals || [])
      .filter(g => parentGoalIds.includes(g.id))
      .map(g => ({ id: g.id, title: g.title, icon: g.icon })),
  };
}

/**
 * `(kind, id) => boolean` — whether a goal / intervention / barrier has a
 * current note. Same rule the Goal, Intervention and Barrier drawers use to
 * show their Note card: the newest `note` entry for the item (logged under its
 * kind or the generic 'note' type) counts unless a `note_deleted` entry is at
 * least as new. The barrier drawer only honours deletes logged under
 * barrier / note, so that difference is kept.
 */
export function currentNoteLookup(auditAll) {
  const latest = new Map(); // `${kind}:${id}` → { note, clear }
  const bump = (key, field, at) => {
    const entry = latest.get(key) || { note: 0, clear: 0 };
    if (at > entry[field]) entry[field] = at;
    latest.set(key, entry);
  };
  for (const a of auditAll || []) {
    if (a.action !== 'note' && a.action !== 'note_deleted') continue;
    const t = new Date(a.createdAt).getTime();
    // The drawers compare Date objects, so an undated note still shows and an
    // undated delete never hides one.
    if (a.action === 'note_deleted' && !Number.isFinite(t)) continue;
    const at = Number.isFinite(t) ? t : Infinity;
    const id = String(a.entityId);
    for (const kind of ['goal', 'intervention', 'barrier']) {
      const typeMatches = a.entityType === kind || a.entityType === 'note';
      if (a.action === 'note' && typeMatches) bump(`${kind}:${id}`, 'note', at);
      if (a.action === 'note_deleted' && typeMatches) bump(`${kind}:${id}`, 'clear', at);
    }
  }
  return (kind, id) => {
    const entry = latest.get(`${kind}:${String(id)}`);
    return !!entry && entry.note > 0 && !(entry.clear && entry.clear >= entry.note);
  };
}

/**
 * Each item's notes for the table's note button: how many notes it has since
 * the last delete, and whether any of them is new to this user (added by
 * someone else after they last opened the item's notes). Null when it has
 * no notes. `reads`: `${kind}:${id}` → ms last opened; `me`: the user's name.
 */
export function noteSummaryLookup(auditAll, reads = {}, me = '') {
  const byKey = new Map(); // `${kind}:${id}` → { notes: [{ at, actor }], clear }
  const entry = (key) => {
    if (!byKey.has(key)) byKey.set(key, { notes: [], clear: 0 });
    return byKey.get(key);
  };
  for (const a of auditAll || []) {
    if (a.action !== 'note' && a.action !== 'note_deleted') continue;
    const t = new Date(a.createdAt).getTime();
    if (a.action === 'note_deleted' && !Number.isFinite(t)) continue;
    const at = Number.isFinite(t) ? t : Infinity;
    const id = String(a.entityId);
    for (const kind of ['goal', 'intervention', 'barrier']) {
      const typeMatches = a.entityType === kind || a.entityType === 'note';
      if (a.action === 'note' && typeMatches) entry(`${kind}:${id}`).notes.push({ at, actor: a.actor || '' });
      if (a.action === 'note_deleted' && typeMatches) {
        const e = entry(`${kind}:${id}`);
        if (at > e.clear) e.clear = at;
      }
    }
  }
  return (kind, id) => {
    const key = `${kind}:${String(id)}`;
    const e = byKey.get(key);
    if (!e) return null;
    const current = e.notes.filter(n => n.at > e.clear);
    if (!current.length) return null;
    const seen = reads[key] || 0;
    const isNew = current.some(n => n.at > seen && (!me || n.actor !== me));
    return { count: current.length, isNew };
  };
}

export function interventionActivityEntries(auditAll, intervention) {
  if (!intervention?.id) return [];
  return auditAll
    .filter(a => a.entityType === 'intervention' && String(a.entityId) === String(intervention.id))
    .sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt))
    .map(a => {
      const created = a.createdAt ? new Date(a.createdAt) : null;
      return {
        id: a.id,
        t: 'status_change',
        date: created ? created.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null,
        time: created ? created.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null,
        by: a.actor || null,
        title: a.summary || 'Intervention updated',
      };
    });
}

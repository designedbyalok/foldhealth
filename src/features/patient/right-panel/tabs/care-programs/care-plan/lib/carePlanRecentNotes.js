const KIND_LABEL = { goal: 'Goal', intervention: 'Intervention', barrier: 'Barrier' };
const time = iso => {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
};

/**
 * The latest notes on a plan and its goals, interventions and barriers, newest
 * first, for the overview's Recent Notes. Read from the plan audit the way the
 * note views read it:
 *
 * - A plan note is a `note` row on the plan; `note_cleared` hides every plan
 *   note before it (useCarePlanViewData).
 * - An item note is a `note` row on the item (legacy rows say `note`);
 *   `note_deleted` hides that item's notes before it (noteSummaryLookup).
 * - A note on an item no longer in the plan is left out.
 *
 * `excludeId` skips the plan note already shown in the note box, and
 * `includePlan: false` leaves plan notes out altogether (editing the note box
 * saves a new plan note, so earlier ones are often its previous versions).
 * Each entry: { id, kind: 'plan'|'goal'|'intervention'|'barrier', item?, source, text, actor, createdAt }.
 */
export function recentCarePlanNotes(audit = [], plan = null, { excludeId = null, includePlan = true, limit = 3 } = {}) {
  const items = new Map();
  for (const kind of ['goal', 'intervention', 'barrier']) {
    const list = kind === 'goal' ? plan?.goals : kind === 'intervention' ? plan?.interventions : plan?.barriers;
    for (const item of list || []) items.set(`${kind}:${item.id}`, { kind, item });
  }

  let planClear = 0;
  const itemClear = new Map();
  for (const a of audit) {
    if (a.action === 'note_cleared') planClear = Math.max(planClear, time(a.createdAt));
    if (a.action === 'note_deleted') {
      const id = String(a.entityId);
      itemClear.set(id, Math.max(itemClear.get(id) || 0, time(a.createdAt)));
    }
  }

  const out = [];
  for (const a of audit) {
    if (a.action !== 'note' || a.id === excludeId) continue;
    const at = time(a.createdAt);
    const text = (a.detail || '').trim();
    if (!text) continue;
    const base = { id: a.id, text, actor: a.actor || 'Unknown', createdAt: a.createdAt };
    if (!a.entityType || a.entityType === 'plan') {
      if (includePlan && at > planClear) out.push({ ...base, kind: 'plan', source: 'Plan note' });
      continue;
    }
    if (at <= (itemClear.get(String(a.entityId)) || 0)) continue;
    const kinds = a.entityType === 'note' ? ['goal', 'intervention', 'barrier'] : [a.entityType];
    const hit = kinds.map(k => items.get(`${k}:${a.entityId}`)).find(Boolean);
    if (hit) out.push({ ...base, kind: hit.kind, item: hit.item, source: `${KIND_LABEL[hit.kind]}: ${hit.item.title}` });
  }

  return out.sort((x, y) => time(y.createdAt) - time(x.createdAt)).slice(0, limit);
}

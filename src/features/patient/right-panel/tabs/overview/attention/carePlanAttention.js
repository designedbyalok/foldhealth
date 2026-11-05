import { parseLocalDate } from '../../../../../../lib/localDate';
import { formatGoalTarget } from '../../../../../settings/care-plan-library/lib/goalFormat';

/**
 * Which care plan goals, interventions and barriers need attention now, and
 * why, so the Overview's Care Plan card can show those instead of every
 * item. Each rule reads only recorded fields; nothing is inferred.
 *
 *  Goals          Not met; past the target date; trending the wrong way
 *  Interventions  Past due; low adherence; high priority with no owner, or
 *                 not started two weeks after it was added
 *
 * The same item planned under more than one program counts once.
 *  Barriers       On hold; high priority and added in the last 30 days
 *
 * When fewer than `limit` items need attention, the most recently updated
 * open items fill the rest, marked as recent rather than as problems.
 *
 * Returns { items: [{ kind, item, reason, tone }], attention, open, total }
 * sorted by tone (error, warning, then recent), priority, then recency.
 */

const DAY = 24 * 3600 * 1000;
const CLOSED = /^(met|achieved|resolved|closed|completed|discontinued|not applicable)$/i;
const TONE_RANK = { error: 0, warning: 1, grey: 2, info: 3 };
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

const isOpen = item => !CLOSED.test(item.status || '');
const ms = (iso) => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
};
const dateMs = (s) => {
  const d = parseLocalDate(s);
  return d ? d.getTime() : null;
};
const ownerName = a => (typeof a === 'string' ? a : a?.name) || '';
const fmtDate = t => new Date(t).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
const days = n => `${n} ${n === 1 ? 'day' : 'days'}`;
const current = g => g.currentValue && `${g.currentValue}${g.customUnit ? ` ${g.customUnit}` : ''}`;
// "Current 8.2 %, target < 7 %", or whichever half is on record.
const versus = (g) => {
  const goal = formatGoalTarget(g);
  if (current(g)) return goal ? `Current ${current(g)}, target ${goal}` : `Current ${current(g)}`;
  return goal ? `Target ${goal}` : '';
};

// Each reason carries `detail`: the line the Overview shows under the item,
// built from the same recorded fields.
function goalReason(g, now) {
  if (/^not met$/i.test(g.status || '')) return { reason: 'Not met', tone: 'error', detail: versus(g) ? `Not met. ${versus(g)}.` : 'Marked not met.' };
  if (!isOpen(g)) return null;
  const due = dateMs(g.targetDate);
  if (due != null && due < now) return { reason: 'Past target date', tone: 'error', detail: `Target date ${fmtDate(due)} has passed${current(g) ? `; current ${current(g)}` : ''}.` };
  if (g.trend === '↓') return { reason: 'Trending down', tone: 'warning', detail: `Trending the wrong way${current(g) ? `, now ${current(g)}` : ''}.` };
  return null;
}

function interventionReason(i, now) {
  if (!isOpen(i)) return null;
  const due = dateMs(i.config?.dueDateOverride);
  if (due != null && due < now) return { reason: 'Past due', tone: 'error', detail: `Was due ${fmtDate(due)}, ${days(Math.floor((now - due) / DAY))} ago.` };
  const adherence = Number(i.adherence);
  if (i.adherence != null && i.adherence !== '' && Number.isFinite(adherence) && adherence < 50) {
    return { reason: `Adherence ${Math.round(adherence)}%`, tone: 'warning', detail: `Adherence is ${Math.round(adherence)}%, under half of what was planned.` };
  }
  if (i.priority === 'high' && (!ownerName(i.assignee) || ownerName(i.assignee) === 'Unassigned')) {
    return { reason: 'No owner', tone: 'warning', detail: 'High priority with no one assigned.' };
  }
  const created = ms(i.createdAt);
  if (i.priority === 'high' && /^not started$/i.test(i.status || '') && created != null && now - created > 14 * DAY) {
    return { reason: 'Not started', tone: 'warning', detail: `High priority, still not started ${days(Math.floor((now - created) / DAY))} after it was added.` };
  }
  return null;
}

function barrierReason(b, now) {
  if (!isOpen(b)) return null;
  if (/^on hold$/i.test(b.status || '')) return { reason: 'On hold', tone: 'warning', detail: 'On hold, so the goals it blocks are not moving.' };
  const created = ms(b.createdAt);
  if (b.priority === 'high' && created != null && now - created <= 30 * DAY) {
    return { reason: 'New, high priority', tone: 'warning', detail: `High-priority barrier added ${fmtDate(created)}.` };
  }
  return null;
}

// One entry per kind and title: templates applied under several programs
// repeat the same goal or intervention. Of the copies, keep the one that
// needs the most attention.
function unique(entries) {
  const best = new Map();
  for (const e of entries) {
    const key = `${e.kind}:${String(e.item.title || '').trim().toLowerCase()}`;
    const prev = best.get(key);
    const rank = e.why ? TONE_RANK[e.why.tone] : 9;
    const prevRank = prev?.why ? TONE_RANK[prev.why.tone] : 9;
    if (!prev || rank < prevRank) best.set(key, e);
  }
  return [...best.values()];
}

export function carePlanAttention({ goals = [], interventions = [], barriers = [], now = Date.now(), limit = 5 } = {}) {
  const all = unique([
    ...goals.map(item => ({ kind: 'goal', item, why: goalReason(item, now) })),
    ...interventions.map(item => ({ kind: 'intervention', item, why: interventionReason(item, now) })),
    ...barriers.map(item => ({ kind: 'barrier', item, why: barrierReason(item, now) })),
  ]);
  const updated = e => ms(e.item.updatedAt) ?? ms(e.item.createdAt) ?? 0;
  const sort = (a, b) => (TONE_RANK[a.tone] - TONE_RANK[b.tone])
    || ((PRIORITY_RANK[a.item.priority] ?? 3) - (PRIORITY_RANK[b.item.priority] ?? 3))
    || (updated(b) - updated(a));

  const flagged = all.filter(e => e.why).map(e => ({ kind: e.kind, item: e.item, reason: e.why.reason, tone: e.why.tone }));
  flagged.sort(sort);
  const open = all.filter(e => isOpen(e.item));

  const recent = flagged.length >= limit ? [] : open
    .filter(e => !e.why && now - updated(e) <= 14 * DAY)
    .sort((a, b) => updated(b) - updated(a))
    .slice(0, limit - flagged.length)
    .map(e => ({ kind: e.kind, item: e.item, reason: 'Updated recently', tone: 'info' }));

  return {
    items: [...flagged, ...recent],
    attention: flagged.length,
    open: open.length,
    total: all.length,
  };
}

/**
 * The open items of each kind (plus goals marked not met), each with its
 * attention reason and detail when it has one. Items needing attention lead,
 * then priority, then the most recently updated.
 *
 * Returns { goal: [...], intervention: [...], barrier: [...] }, entries
 * { kind, item, reason, tone, detail } (reason/tone/detail null when fine).
 */
export function carePlanByKind({ goals = [], interventions = [], barriers = [], now = Date.now() } = {}) {
  const all = unique([
    ...goals.map(item => ({ kind: 'goal', item, why: goalReason(item, now) })),
    ...interventions.map(item => ({ kind: 'intervention', item, why: interventionReason(item, now) })),
    ...barriers.map(item => ({ kind: 'barrier', item, why: barrierReason(item, now) })),
  ]);
  const updated = e => ms(e.item.updatedAt) ?? ms(e.item.createdAt) ?? 0;
  const rank = e => (e.why ? TONE_RANK[e.why.tone] : 9);
  const out = { goal: [], intervention: [], barrier: [] };
  all
    .filter(e => e.why || isOpen(e.item))
    .sort((a, b) => (rank(a) - rank(b))
      || ((PRIORITY_RANK[a.item.priority] ?? 3) - (PRIORITY_RANK[b.item.priority] ?? 3))
      || (updated(b) - updated(a)))
    .forEach(e => out[e.kind].push({
      kind: e.kind, item: e.item, reason: e.why?.reason ?? null, tone: e.why?.tone ?? null, detail: e.why?.detail ?? null,
    }));
  return out;
}

/* Aggregations over run records for the automation list, quick view,
   Analytics (Global and Node Level), the drilldown drawers and History.
   Every number is derived from the same rows, so totals agree everywhere:
   completed + in progress + failed = executions, delivered + failed = sent,
   clicked ≤ opened ≤ delivered. */

import { nodeDef } from './catalog';
import { getNode } from './graph';

const DAY = 86400000;

export function graphCounts(graph) {
  const nodes = (graph?.nodes || []).filter(n => n.id !== 'trigger');
  return {
    conditions: nodes.filter(n => nodeDef(n.type)?.kind === 'condition').length,
    actions: nodes.filter(n => nodeDef(n.type)?.kind === 'action' && n.type !== 'microAutomation').length,
  };
}

/** "2:15 hrs" / "45 mins" / "-". */
export function formatDurationMinutes(mins) {
  if (mins == null || Number.isNaN(mins)) return '-';
  const m = Math.round(mins);
  if (m < 60) return `${m} min${m === 1 ? '' : 's'}`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h >= 48) return `${Math.round(h / 24)} days`;
  return `${h}:${String(r).padStart(2, '0')} hrs`;
}

/** Average start-to-finish of members who finished. */
export function avgExecutionMinutes(members) {
  const done = (members || []).filter(m => m.finishedAt && m.startedAt);
  if (!done.length) return null;
  const total = done.reduce((s, m) => s + (new Date(m.finishedAt) - new Date(m.startedAt)), 0);
  return total / done.length / 60000;
}

export function inRange(iso, range) {
  if (!range) return true;
  const t = new Date(iso).getTime();
  return t >= range.from.getTime() && t <= range.to.getTime();
}

/** Date range presets for the Duration filter. */
export const DURATIONS = [
  { value: 'lastWeek', label: 'Last week', days: 7 },
  { value: 'last30', label: 'Last 30 days', days: 30 },
  { value: 'last90', label: 'Last 90 days', days: 90 },
];
export function rangeFor(duration, now = new Date()) {
  const d = DURATIONS.find(x => x.value === duration) || DURATIONS[0];
  const to = new Date(now);
  const from = new Date(now.getTime() - (d.days - 1) * DAY);
  from.setHours(0, 0, 0, 0);
  return { from, to, days: d.days };
}
export const formatRange = (r) => `${r.from.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })} – ${r.to.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}`;

/** Overview KPIs and the Completed / In-progress / Failed split. */
export function overview(members) {
  const total = members.length;
  const completed = members.filter(m => m.status === 'completed').length;
  const inProgress = members.filter(m => m.status === 'in_progress').length;
  const failed = members.filter(m => m.status === 'failed').length;
  const finished = completed + failed;
  return {
    total,
    completed,
    inProgress,
    failed,
    // Success ratio is over members who finished; in-progress ones haven't
    // succeeded or failed yet.
    successRatio: finished ? Math.round((completed / finished) * 100) : null,
    minutesSaved: members.reduce((s, m) => s + (m.minutesSaved || 0), 0),
  };
}

/** Email or SMS funnel. Opens/clicks are unique members; totals count repeats. */
export function channelFunnel(messages, channel) {
  const rows = messages.filter(m => m.channel === channel);
  const failed = rows.filter(m => m.status === 'failed').length;
  const delivered = rows.length - failed;
  const opened = rows.filter(m => m.status === 'opened' || m.status === 'clicked').length;
  const clicked = rows.filter(m => m.status === 'clicked').length;
  const totalOpens = rows.reduce((s, m) => s + (m.opens || 0), 0);
  const totalClicks = rows.reduce((s, m) => s + (m.clicks || 0), 0);
  return {
    sent: rows.length,
    delivered,
    failed,
    opened,
    clicked,
    totalOpens,
    multiOpens: rows.filter(m => (m.opens || 0) > 1).length,
    totalClicks,
    multiClicks: rows.filter(m => (m.clicks || 0) > 1).length,
  };
}

/** One row per day in the range: { key, label, sent, delivered, opened, clicked, failed }. */
// Day buckets use the viewer's local calendar day (the range starts at local
// midnight); a UTC key would shift every bucket by the timezone offset.
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function dailySeries(messages, channel, range) {
  const days = [];
  for (let t = new Date(range.from); t <= range.to; t = new Date(t.getTime() + DAY)) {
    const key = dayKey(t);
    days.push({ key, label: t.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }), sent: 0, delivered: 0, opened: 0, clicked: 0, failed: 0 });
  }
  const byKey = new Map(days.map(d => [d.key, d]));
  messages.filter(m => m.channel === channel).forEach(m => {
    const d = byKey.get(dayKey(new Date(m.sentAt)));
    if (!d) return;
    d.sent += 1;
    if (m.status === 'failed') { d.failed += 1; return; }
    d.delivered += 1;
    if (m.status === 'opened' || m.status === 'clicked') d.opened += 1;
    if (m.status === 'clicked') d.clicked += 1;
  });
  return days;
}

/**
 * Per node: members who reached it and how it went, plus per-branch counts.
 * { nodes: { [id]: { members, success, error, inProgress, minutes } },
 *   branches: { [`${id}::${branch}`]: count } }
 */
export function nodeStats(members, graph) {
  const nodes = {};
  const branches = {};
  for (const m of members) {
    for (const [id, step] of Object.entries(m.path || {})) {
      const s = (nodes[id] ||= { members: 0, success: 0, error: 0, inProgress: 0, minutes: 0 });
      s.members += 1;
      if (step.status === 'success') s.success += 1;
      else if (step.status === 'error') s.error += 1;
      else if (step.status === 'in_progress') s.inProgress += 1;
      if (step.status === 'success') s.minutes += nodeDef(getNode(graph, id)?.type)?.minutes || 0;
      if (step.outcome && step.outcome !== 'next' && step.outcome !== 'notMatched') {
        const k = `${id}::${step.outcome}`;
        branches[k] = (branches[k] || 0) + 1;
      }
    }
  }
  return { nodes, branches };
}

/** A node's status on the trace / node-level canvas, by majority of its members. */
export function nodeStatusOf(stat) {
  if (!stat || !stat.members) return 'not_run';
  if (stat.error) return 'error';
  if (stat.inProgress) return 'in_progress';
  return 'success';
}

/** History Log entries, newest first: edits and runs, grouped by day by the caller. */
export function historyEntries(runs, editLog) {
  const out = [
    ...(editLog || []).map(e => ({ kind: 'edit', id: `e:${e.id}`, at: e.createdAt, actor: e.actor, summary: e.summary })),
    ...(runs || []).map(r => ({
      kind: 'run',
      id: `r:${r.id}`,
      runId: r.id,
      at: r.startedAt,
      actor: r.triggeredBy,
      runKind: r.kind,
      targetLabel: r.targetLabel,
      success: r.completedCount,
      inProgress: r.inProgressCount,
      failed: r.failedCount,
      total: r.memberCount,
    })),
  ];
  return out.sort((a, b) => new Date(b.at) - new Date(a.at));
}

/** The latest run's outcome for list badges: 'ok' | 'errors' | null. */
export function lastRunHealth(runs) {
  const last = [...(runs || [])].sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))[0];
  if (!last) return null;
  return last.failedCount > 0 ? 'errors' : 'ok';
}

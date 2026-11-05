/* Shared, non-React helpers for the analytics screens, drawers and trace. */

import { nodeDef, triggerDef } from '../lib/catalog';
import { branchesOf, getNode, orderedSteps } from '../lib/graph';

export const SERIES = {
  sent: { label: 'Sent', color: 'var(--chart-2)' },
  delivered: { label: 'Delivered', color: 'var(--chart-1)' },
  opened: { label: 'Opened', color: 'var(--chart-3)' },
  clicked: { label: 'Clicked', color: 'var(--chart-4)' },
  failed: { label: 'Failed', color: 'var(--chart-6)' },
};

export const CHANNEL_TILES = {
  email: ['sent', 'delivered', 'opened', 'clicked', 'failed'],
  sms: ['sent', 'delivered', 'failed'],
};

export const CHANNEL_TITLE = { email: 'Email Execution', sms: 'SMS Execution' };

export const MEMBER_STATUSES = [
  { key: 'completed', label: 'Completed', tone: 'success', color: 'var(--chart-3)' },
  { key: 'in_progress', label: 'In progress', tone: 'warning', color: 'var(--chart-1)' },
  { key: 'failed', label: 'Failed', tone: 'error', color: 'var(--chart-6)' },
];
export const memberStatusDef = (key) => MEMBER_STATUSES.find(s => s.key === key) || MEMBER_STATUSES[0];

// Node / step status on the canvas legend and the trace timeline.
export const STEP_STATUSES = [
  { key: 'success', label: 'Success', tone: 'success', icon: 'solar:check-circle-linear', color: 'var(--status-success)' },
  { key: 'error', label: 'Error', tone: 'error', icon: 'solar:danger-triangle-linear', color: 'var(--status-error)' },
  { key: 'in_progress', label: 'In progress', tone: 'warning', icon: 'solar:clock-circle-linear', color: 'var(--status-warning)' },
  { key: 'not_run', label: 'Not run yet', tone: 'grey', icon: 'solar:minus-circle-linear', color: 'var(--neutral-200)' },
];
export const stepStatusDef = (key) => STEP_STATUSES.find(s => s.key === key) || STEP_STATUSES[3];

export const RETRY_HINT = 'Resumes the automation for this member from the step that stopped. Fix what caused the error first.';

export const initialsOf = (name) => String(name || '?').trim().split(/\s+/).filter(Boolean)
  .map(w => w[0]).slice(0, 2).join('').toUpperCase();

export const fmtDateTime = (iso) => (iso
  ? new Date(iso).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  : '');
export const fmtDate = (iso) => (iso
  ? new Date(iso).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
  : '');

/** Staff time saved: "45 mins", "7:54 hrs", "1,204 hrs" (same style as Avg. exe. time). */
export function formatSaved(mins) {
  const m = Math.round(mins || 0);
  if (m < 60) return `${m} min${m === 1 ? '' : 's'}`;
  const h = Math.floor(m / 60);
  if (h >= 100) return `${h.toLocaleString('en-US')} hrs`;
  return `${h}:${String(m % 60).padStart(2, '0')} hrs`;
}

export const num = (n) => (n ?? 0).toLocaleString('en-US');

/** Step title as the canvas cards show it. */
export function stepLabel(node) {
  if (!node) return 'Removed step';
  if (node.id === 'trigger') return triggerDef(node.type)?.label || 'Trigger';
  return nodeDef(node.type)?.nodeLabel || nodeDef(node.type)?.label || 'Step';
}

/** Human outcome of a step ("Opened", "Did not match", "Repeated 3x"). */
export function outcomeLabel(node, outcome) {
  if (!outcome || outcome === 'next') return null;
  if (outcome === 'notMatched') return 'Did not match';
  if (node?.type === 'repeat') return `Repeated ${outcome}`;
  return branchesOf(node).find(b => b.key === outcome)?.label || outcome;
}

/** The step a member is waiting on or failed at: { node, step } or null. */
export function stoppedStep(member, graph) {
  const path = member?.path || {};
  const node = orderedSteps(graph, { includeLogic: true })
    .find(n => ['error', 'in_progress'].includes(path[n.id]?.status));
  if (node) return { node, step: path[node.id] };
  const id = Object.keys(path).find(k => ['error', 'in_progress'].includes(path[k]?.status));
  return id ? { node: getNode(graph, id), step: path[id] } : null;
}

/** Day buckets up to two weeks; longer ranges roll up by week so the bars stay readable. */
export function bucketSeries(days) {
  if (days.length <= 14) return days;
  const out = [];
  for (let i = 0; i < days.length; i += 7) {
    const week = days.slice(i, i + 7);
    const b = { key: week[0].key, label: week[0].label, rangeLabel: `${week[0].label} – ${week.at(-1).label}`, sent: 0, delivered: 0, opened: 0, clicked: 0, failed: 0 };
    week.forEach(d => { ['sent', 'delivered', 'opened', 'clicked', 'failed'].forEach(k => { b[k] += d[k]; }); });
    out.push(b);
  }
  return out;
}

/** Message rows for one channel tile, in the drawer's table. */
export function messagesForTile(messages, channel, tile) {
  const rows = messages.filter(m => m.channel === channel);
  switch (tile) {
    case 'delivered': return rows.filter(m => m.status !== 'failed');
    case 'opened': return rows.filter(m => m.status === 'opened' || m.status === 'clicked');
    case 'clicked': return rows.filter(m => m.status === 'clicked');
    case 'failed': return rows.filter(m => m.status === 'failed');
    default: return rows;
  }
}

/** KPI tiles for a channel funnel (Email: 5, SMS: 3); `info` rows feed the tile's tooltip. */
export function channelTiles(channel, funnel) {
  const info = (key) => {
    if (channel !== 'email') return null;
    if (key === 'opened') return [['Unique opens', funnel.opened], ['Multi-time opens', funnel.multiOpens], ['Total opens', funnel.totalOpens]];
    if (key === 'clicked') return [['Unique clicks', funnel.clicked], ['Multi-time clicks', funnel.multiClicks], ['Total clicks', funnel.totalClicks]];
    return null;
  };
  return CHANNEL_TILES[channel].map(key => ({
    key, label: SERIES[key].label, color: SERIES[key].color, value: num(funnel[key]), info: info(key),
  }));
}

// Opening a member trace from a drawer remembers the drawer, so closing the
// trace brings it back (the hash router resets automationsView.drawer).
let returnDrawer = null;
export const rememberDrawer = (id, drawer) => { returnDrawer = drawer ? { id, drawer } : null; };
export const peekReturnDrawer = (id) => (returnDrawer?.id === id ? returnDrawer.drawer : null);

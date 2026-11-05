/* Derived figures for the Automations list (cards, table, tabs). Everything
   comes from the automation records and their recent runs (last 90 days). */

const DAY = 86400000;

/** "03-13-2024" */
export const fmtDate = (iso) => (iso
  ? new Date(iso).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).replace(/\//g, '-')
  : '-');

/** "03-13-2024, 11:20 AM" */
export const fmtDateTime = (iso) => (iso
  ? `${fmtDate(iso)}, ${new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
  : '-');

export const plural = (n, one, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

/** Map automationId → runs, newest first. */
export function runsByAutomation(runs) {
  const map = new Map();
  for (const r of runs || []) {
    if (!map.has(r.automationId)) map.set(r.automationId, []);
    map.get(r.automationId).push(r);
  }
  for (const list of map.values()) list.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  return map;
}

/** Average start-to-finish of finished runs, in minutes (null when none finished). */
export function avgRunMinutes(runs) {
  const done = (runs || []).filter(r => r.startedAt && r.finishedAt);
  if (!done.length) return null;
  return done.reduce((s, r) => s + (new Date(r.finishedAt) - new Date(r.startedAt)), 0) / done.length / 60000;
}

/** Members who failed in the latest run (the red error count on a card or row). */
export function latestFailures(automation, runs) {
  if (automation.lastRunStatus !== 'errors') return 0;
  return runs?.[0]?.failedCount || 0;
}

export const executionsIn90Days = (runs) => (runs || []).reduce((s, r) => s + (r.memberCount || 0), 0);

export const STATUS_TABS = [
  { key: 'active', label: 'Active', empty: 'No active automations', hint: 'Turn on an automation to see it here.' },
  { key: 'inactive', label: 'Inactive', empty: 'No inactive automations', hint: 'Automations you turn off show up here.' },
  { key: 'draft', label: 'Draft', empty: 'No drafts', hint: 'Automations you have not published yet show up here.' },
  { key: 'recent', label: 'Recently executed', empty: 'Nothing ran in the last 7 days', hint: 'Automations that ran in the last 7 days show up here.' },
  { key: 'errors', label: 'Executed with errors', empty: 'No errors', hint: 'Automations whose latest run had failures show up here.' },
];

export function inStatusTab(automation, tab, now = Date.now()) {
  switch (tab) {
    case 'active': return automation.status === 'active';
    case 'inactive': return automation.status === 'inactive';
    case 'draft': return automation.status === 'draft';
    case 'recent': return !!automation.lastExecutedAt && now - new Date(automation.lastExecutedAt).getTime() <= 7 * DAY;
    case 'errors': return automation.lastRunStatus === 'errors';
    default: return true;
  }
}

export const matchesSearch = (item, q) => {
  if (!q) return true;
  const s = q.trim().toLowerCase();
  return [item.name, item.description, item.createdBy, item.populationGroupName]
    .some(v => (v || '').toLowerCase().includes(s));
};

/** "Use Template": open the builder on a new automation seeded from it. */
export const startFromTemplate = (openNewAutomation, t) => openNewAutomation({
  name: t.name, description: t.description, graph: t.graph, templateId: t.id, schedule: t.schedule,
});

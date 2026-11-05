import { parseLocalDate } from '../../../../../../../lib/localDate';
// Shared helpers for the comprehensive (cross-program) care plan snapshot,
// used by CarePlanSummaryView to render and by the Care Management Download
// CTA to export the same data.

const norm = (s) => (s || '').trim().toLowerCase();

/**
 * Flatten every program's plan into goals + interventions tagged with their
 * program, union the conditions, and flag goals whose title appears on more
 * than one program.
 */
export function buildCarePlanSnapshot(programs, patientCarePlans, patientId) {
  const conditionSet = new Map();
  const goals = [];
  const interventions = [];
  const barriers = [];
  const goalTitleCounts = new Map();

  for (const program of programs) {
    const plan = patientCarePlans[`${patientId}::${program.id}`];
    if (!plan) continue;
    for (const c of (plan.plan?.conditions || [])) {
      if (!conditionSet.has(norm(c.label))) conditionSet.set(norm(c.label), c.label);
    }
    // Every row inherits its owning plan's applied templates so a
    // Care Plan Template filter can narrow across all three tables
    // without having to look the plan up again.
    const planTemplateIds = plan.plan?.appliedTemplateIds || [];
    for (const g of plan.goals) {
      goalTitleCounts.set(norm(g.title), (goalTitleCounts.get(norm(g.title)) || 0) + 1);
      goals.push({ ...g, program, programCode: program.code, templateIds: planTemplateIds });
    }
    for (const i of plan.interventions) interventions.push({ ...i, program, programCode: program.code, templateIds: planTemplateIds });
    for (const b of (plan.barriers || [])) barriers.push({ ...b, program, programCode: program.code, templateIds: planTemplateIds });
  }
  for (const g of goals) g.duplicate = goalTitleCounts.get(norm(g.title)) > 1;

  return { conditions: [...conditionSet.values()], goals, interventions, barriers };
}

// Date presets shared with the toolbar's Due Date / Create Date chips.
// Same semantics as the DiagPanel timeline presets so the whole care-plan
// surface reads one language: relative windows anchored to today's start.
export const CARE_PLAN_DATE_PRESETS = ['Today', 'Last 7 days', 'Last 30 days', 'This month'];

function startOfDay(x) { return new Date(x.getFullYear(), x.getMonth(), x.getDate()); }
function matchesDatePreset(d, preset) {
  if (!d || Number.isNaN(d.getTime())) return false;
  const now = new Date();
  const today = startOfDay(now);
  const that = startOfDay(d);
  if (preset === 'Today')        return that.getTime() === today.getTime();
  if (preset === 'Last 7 days')  return today - that >= 0 && today - that <= 7  * 86400000;
  if (preset === 'Last 30 days') return today - that >= 0 && today - that <= 30 * 86400000;
  if (preset === 'This month')   return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  return true;
}

// Row-agnostic date extractors. Goals have targetDate (Figma "Due Date"
// on the goal form); interventions don't carry an ISO due date, so their
// due chip filter is a no-op there, leaving them visible avoids
// mysterious disappearances. All three types carry createdAt.
function dueDateOf(row) {
  return parseLocalDate(row?.targetDate);
}
function createdDateOf(row) {
  if (!row?.createdAt) return null;
  const d = new Date(row.createdAt);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Apply the toolbar filters to a snapshot's rows. Every filter is an
 * array: empty array means "inactive" (the same shape FilterChip
 * emits).
 */
export function filterCarePlanSnapshot(snapshot, {
  searchText = '',
  programFilter = [],
  templateFilter = [],
  statusFilter = [],
  priorityFilter = [],
  dueDateFilter = [],
  createdDateFilter = [],
} = {}) {
  const q = norm(searchText);
  const progSet     = programFilter.length     ? new Set(programFilter)                       : null;
  const tmplSet     = templateFilter.length    ? new Set(templateFilter)                      : null;
  const statusSet   = statusFilter.length      ? new Set(statusFilter.map(v => norm(v)))      : null;
  const priSet      = priorityFilter.length    ? new Set(priorityFilter.map(v => norm(v)))    : null;
  const dueSet      = dueDateFilter.length     ? new Set(dueDateFilter)                       : null;
  const createdSet  = createdDateFilter.length ? new Set(createdDateFilter)                   : null;

  const match = (row) => {
    if (q && !norm(row.title).includes(q)) return false;
    if (progSet && !progSet.has(row.programCode)) return false;
    if (tmplSet) {
      const ids = Array.isArray(row.templateIds) ? row.templateIds : [];
      if (!ids.some(id => tmplSet.has(id))) return false;
    }
    if (statusSet && !statusSet.has(norm(row.status))) return false;
    if (priSet && !priSet.has(norm(row.priority))) return false;
    if (dueSet) {
      const d = dueDateOf(row);
      if (!d || ![...dueSet].some(p => matchesDatePreset(d, p))) return false;
    }
    if (createdSet) {
      const d = createdDateOf(row);
      if (!d || ![...createdSet].some(p => matchesDatePreset(d, p))) return false;
    }
    return true;
  };
  return {
    conditions: snapshot.conditions,
    goals: snapshot.goals.filter(match),
    interventions: snapshot.interventions.filter(match),
    barriers: (snapshot.barriers || []).filter(match),
  };
}

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Render a snapshot as a two-section CSV (Goals, then Interventions). */
export function carePlanSnapshotToCsv({ conditions, goals, interventions }) {
  const lines = ['Care Plan: All programs'];
  if (conditions.length) lines.push(['Conditions', conditions.join('; ')].map(csvCell).join(','));
  lines.push('');
  lines.push('Goals');
  lines.push('Priority,Goal Title,Program,Status');
  for (const g of goals) lines.push([g.priority, g.title, g.programCode, g.status].map(csvCell).join(','));
  lines.push('');
  lines.push('Interventions');
  lines.push('Priority,Name,Assigned To,Program,Status');
  for (const i of interventions) {
    lines.push([i.priority, i.title, i.assignee?.name || '', i.programCode, i.status].map(csvCell).join(','));
  }
  return lines.join('\n');
}

/** Build the CSV and trigger a browser download. */
export function downloadCarePlanCsv(snapshot, filenameBase = 'care-plan') {
  const blob = new Blob([carePlanSnapshotToCsv(snapshot)], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenameBase}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

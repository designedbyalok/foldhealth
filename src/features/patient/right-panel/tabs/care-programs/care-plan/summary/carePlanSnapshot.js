// Shared helpers for the comprehensive (cross-program) care plan snapshot —
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
  const goalTitleCounts = new Map();

  for (const program of programs) {
    const plan = patientCarePlans[`${patientId}::${program.id}`];
    if (!plan) continue;
    for (const c of (plan.plan?.conditions || [])) {
      if (!conditionSet.has(norm(c.label))) conditionSet.set(norm(c.label), c.label);
    }
    for (const g of plan.goals) {
      goalTitleCounts.set(norm(g.title), (goalTitleCounts.get(norm(g.title)) || 0) + 1);
      goals.push({ ...g, program, programCode: program.code });
    }
    for (const i of plan.interventions) interventions.push({ ...i, program, programCode: program.code });
  }
  for (const g of goals) g.duplicate = goalTitleCounts.get(norm(g.title)) > 1;

  return { conditions: [...conditionSet.values()], goals, interventions };
}

/** Apply the toolbar's search + program filter to a snapshot's rows. */
export function filterCarePlanSnapshot(snapshot, { searchText = '', programFilter = [] } = {}) {
  const q = norm(searchText);
  const set = programFilter.length ? new Set(programFilter) : null;
  const match = (row) => (!q || norm(row.title).includes(q)) && (!set || set.has(row.programCode));
  return {
    conditions: snapshot.conditions,
    goals: snapshot.goals.filter(match),
    interventions: snapshot.interventions.filter(match),
  };
}

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Render a snapshot as a two-section CSV (Goals, then Interventions). */
export function carePlanSnapshotToCsv({ conditions, goals, interventions }) {
  const lines = ['Care Plan — All programs'];
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

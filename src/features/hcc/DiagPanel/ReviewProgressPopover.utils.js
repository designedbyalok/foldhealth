import { ROLE_LABEL, staffById } from '../assignment/astranaStaff';

const TERMINAL_STATUSES = new Set(['Completed', 'Billing Ready']);
const REJECTED_STATUSES = new Set(['Reject', 'Rejected', 'Insufficient']);

// Map a role's engine status string → the timeline node's visual state.
// Exported so any surface that overrides a stage's status (e.g. the Chart
// Review drawer feeding its LIVE derived Support status into the popover)
// derives the node state the exact same way — no drift between surfaces.
export function stageStateForStatus(status) {
  if (status === 'Skipped') return 'skipped';
  if (status && REJECTED_STATUSES.has(status)) return 'rejected';
  if (status && TERMINAL_STATUSES.has(status)) return 'done';
  if (status && status !== 'Assign') return 'active';
  return 'pending';
}

export function buildReviewStages(member, dosState) {
  const visibleRoles = ['support', 'coder', 'reviewer', 'reviewer2'];
  return visibleRoles.map((role) => {
    const rs = dosState?.[role];
    const legacyMap = {
      support:   { name: member?.sup, status: member?.supS },
      coder:     { name: member?.cdr, status: member?.cdrS },
      reviewer:  { name: member?.r1,  status: member?.r1s },
      reviewer2: { name: member?.r2,  status: member?.r2s },
    };
    const assigneeId = rs?.assignee || null;
    const staff = assigneeId ? staffById(assigneeId) : null;
    const name = staff?.name || legacyMap[role].name || null;
    const status = rs?.status || legacyMap[role].status || null;

    const state = stageStateForStatus(status);

    const at = rs?.history?.[rs.history.length - 1]?.at;
    const date = at ? new Date(at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : null;

    return { role, label: ROLE_LABEL[role], name, status, date, state };
  });
}

export function computeReviewProgress(stages) {
  if (!stages?.length) return 0;
  const N = stages.length;
  const done = stages.filter(s => s.state === 'done' || s.state === 'skipped').length;
  const active = stages.filter(s => s.state === 'active').length;
  return Math.min(1, (done + active * 0.5) / N);
}

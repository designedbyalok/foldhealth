export const STATUS_OPTIONS = [
  { key: 'in-progress', label: 'In Progress' },
  { key: 'insufficient', label: 'Insufficient' },
  { key: 'completed', label: 'Completed' },
  { key: 'rejected', label: 'Rejected', textColor: 'var(--status-error)' },
];

export const STATUS_BADGE = {
  'action-needed': { color: 'var(--neutral-300)', bg: 'var(--neutral-50)', border: 'rgba(111, 122, 144, 0.1)' },
  'in-progress': { color: 'var(--status-warning)', bg: 'var(--status-warning-light)', border: 'rgba(240, 160, 0, 0.2)' },
  'insufficient': { color: 'var(--status-warning)', bg: 'var(--status-warning-light)', border: 'rgba(240, 160, 0, 0.2)' },
  'completed': { color: 'var(--status-success)', bg: 'var(--status-success-light)', border: 'rgba(0, 155, 83, 0.2)' },
  'rejected': { color: 'var(--status-error)', bg: 'var(--status-error-light)', border: 'rgba(215, 40, 37, 0.2)' },
  // Rendered when Support is under a records-request cycle (Coder / QA /
  // Compliance asked for docs and Support's engine status is `Returned`).
  // Read-only: Support can't manually pick this; it appears only when the
  // engine flags it, and marking Completed sends the DOS back to the
  // requester automatically. Warning tone, matching statusSpec.Returned.
  'returned': { color: 'var(--status-warning)', bg: 'var(--status-warning-light)', border: 'rgba(240, 160, 0, 0.2)' },
};

export function deriveStatus(docs, actions) {
  const passCount = docs.filter(d => actions[d.id] === 'pass').length;
  const failCount = docs.filter(d => actions[d.id] === 'fail').length;
  if (docs.length > 0 && failCount === docs.length) return 'insufficient';
  if (failCount > 1) return 'insufficient';
  if (docs.length > 0 && passCount === docs.length) return 'completed';
  if (passCount + failCount > 0) return 'in-progress';
  return 'action-needed';
}

export function nameToInitials(name) {
  if (!name) return '';
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const isAddressed = (doc) => doc?.status === 'Passed' || doc?.status === 'Failed';

export const actionForStatus = (doc) =>
  doc?.status === 'Passed' ? 'pass' : doc?.status === 'Failed' ? 'fail' : null;

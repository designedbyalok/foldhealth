import { Badge } from '../../../components/Badge/Badge';
import styles from '../tocColumns.module.css';
import { formatAiOutcomeInvokedAt, outreachStatusLabel } from '../tocOutcome';

const OUTREACH_STATUS = {
  Completed: { tone: 'success', icon: 'solar:check-circle-linear' },
  'Needs Review': { tone: 'error', icon: 'solar:danger-triangle-linear' },
  Queued: { tone: 'warning', icon: 'solar:clock-circle-linear' },
  Aborted: { tone: 'grey', icon: 'solar:close-circle-linear' },
};

export function AiOutcomeCell({ patient, onOpen }) {
  const label = outreachStatusLabel(patient);
  if (!label) return <span className={styles.dash}>-</span>;
  const cfg = OUTREACH_STATUS[label];
  const invokedAt = formatAiOutcomeInvokedAt(patient.aiOutcomeInvokedAt);
  return (
    <button
      type="button"
      className={styles.assessmentBtn}
      onClick={(e) => { e.stopPropagation(); onOpen(); }}
      aria-label={`Open outreach status for ${patient.name}`}
    >
      <Badge size="md" tone={cfg.tone} label={label} icon={cfg.icon} />
      {invokedAt && <span className={styles.aiOutcomeInvokedAt}>{invokedAt}</span>}
    </button>
  );
}

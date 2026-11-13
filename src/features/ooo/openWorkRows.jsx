import { Badge } from '../../components/Badge/Badge';
import { Link } from '../../components/Link/Link';
import { PriorityIcon } from '../../components/PriorityIcon/PriorityIcon';
import styles from './ooo.module.css';

/**
 * How a task and a care program read in a row: the module reassign drawers
 * (Reassign Open Work) and the Out of Office Reassignment Summary.
 */
const usDate = (d) => String(d || '').replace(/-/g, '/');
const openPatient = (id) => window.open(`#/population/patient/${encodeURIComponent(id)}`, '_blank', 'noopener');

// Rows in a module's drawer (Figma Eventus 17818:123335). Every module
// groups by department (`location`).
export const TASK_SHAPE = {
  titleOf: t => t.name || 'Task',
  // Priority, the task, then "Due on" (red, with "(Missed)", when past due).
  renderMain: t => (
    <span className={styles.itemMain}>
      <PriorityIcon priority={String(t.priority || 'none').toLowerCase()} size={16} title={`${t.priority || 'No'} priority`} />
      <span className={styles.itemText}>
        <span className={styles.itemTitle}>{t.name || 'Task'}</span>
        <span className={t.status === 'missed' ? `${styles.itemSub} ${styles.itemSubMissed}` : styles.itemSub}>
          {t.due_date ? `Due on: ${usDate(t.due_date)}` : 'No due date'}
          {t.status === 'missed' && ' (Missed)'}
        </span>
      </span>
    </span>
  ),
};
// Status badge tone, as on the patient's care programs.
const PROGRAM_TONE = { 'In Progress': 'warning', Enrolled: 'primary', Paused: 'neutral', 'On Hold': 'neutral' };
export const PROGRAM_SHAPE = {
  titleOf: p => p.name || 'Care Program',
  // Code and status, then patient, start date and PCP.
  renderMain: p => (
    <span className={styles.itemMain}>
      <span className={styles.itemText}>
        <span className={styles.itemHead}>
          <span className={styles.itemTitle}>{p.code || p.name}</span>
          {p.status && <Badge tone={PROGRAM_TONE[p.status] || 'primary'} size="sm" label={p.status} />}
        </span>
        <span className={styles.itemSubSm}>
          {/* The patient opens their profile in a new tab, so the drawer keeps its place. */}
          {p.patientName && (p.patientId ? (
            <Link
              variant="subtle"
              role="link"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); openPatient(p.patientId); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); openPatient(p.patientId); } }}
            >
              {p.patientName}
            </Link>
          ) : p.patientName)}
          {p.patientName && (p.startDate || p.pcp) && ' • '}
          {[p.startDate && `Start Date: ${usDate(p.startDate)}`, p.pcp && `PCP: ${p.pcp}`].filter(Boolean).join(' • ')}
        </span>
      </span>
    </span>
  ),
};

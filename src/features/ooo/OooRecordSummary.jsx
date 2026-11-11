import { Avatar } from '../../components/Avatar/Avatar';
import { describeRange, initialsOf } from './oooUtils';
import styles from './ooo.module.css';

/**
 * The Out of Office record being worked on, read-only (Figma Eventus
 * 17834:123336): the user's initials, their name, then "Out of Office:
 * {first day} → {last day}". Shown on top of Reassign Open Work and each
 * module's Reassign drawer.
 *
 * @param {object} props
 * @param {string} props.name
 * @param {string} props.startAt
 * @param {string} props.endAt
 */
export function OooRecordSummary({ name, startAt, endAt }) {
  const { span } = describeRange(startAt, endAt);
  return (
    <div className={styles.recordSummary} aria-label="Out of office record">
      <Avatar variant="staff" size="M" initials={initialsOf(name)} ooo={null} />
      <span className={styles.recordSummaryText}>
        <span className={styles.recordSummaryMain}>{name}</span>
        <span className={styles.recordSummarySub}>Out of Office: {span.replace(' – ', ' → ')}</span>
      </span>
    </div>
  );
}

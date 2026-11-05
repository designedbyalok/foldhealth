import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Avatar } from '../../../components/Avatar/Avatar';
import { initialsOf } from '../../ooo/oooUtils';
import { dateLabel, timeRangeLabel } from './appointmentList';
import { windowFor, windowLabel } from './typeWindows';
import styles from './AppointmentListView.module.css';

const COPY = {
  cancel: { title: 'Inside Cancellation Window', verb: 'cancel' },
  reschedule: { title: 'Inside Reschedule Window', verb: 'reschedule' },
};

/**
 * Review before a bulk cancel or reschedule: the appointments inside their
 * type's window, the time before the appointment when patients can no longer
 * cancel or reschedule it themselves. Staff can still go ahead; ✕ leaves one
 * out instead.
 *
 * @param {object[]} props.items   – the appointments inside their window
 * @param {'cancel'|'reschedule'} props.kind
 * @param {object[]} props.types   – appointment types, for each one's window
 * @param {(appt) => void} [props.onRemove] – none for a single appointment
 */
export function WindowReview({ items, kind, types, onRemove }) {
  if (!items.length) return null;
  const { title, verb } = COPY[kind];
  return (
    <div className={styles.windowReview}>
      <span className={styles.conflictsTitle}>
        {title}
        <span className={styles.countBadge}>{items.length}</span>
      </span>
      <span className={styles.windowReviewNote}>
        Patients can no longer {verb} {items.length === 1 ? 'this appointment' : 'these appointments'} themselves. You still can{onRemove ? `, or remove any you want to leave as ${items.length === 1 ? 'it is' : 'they are'}` : ''}.
      </span>
      <div className={`${styles.conflictCard} ${styles.applyList}`}>
        {items.map((a) => {
          const when = [`${dateLabel(a.date)}, ${timeRangeLabel(a)}`, a.appointment_type_name].filter(Boolean).join(' • ');
          return (
            <div key={a.id} className={styles.applyRow}>
              <span className={styles.member}>
                <Avatar variant="patient" size="M" initials={initialsOf(a.patient_name)} />
                <span className={styles.memberText}>
                  <span className={styles.memberName}>{a.patient_name || 'Member'}</span>
                  <span className={styles.memberSub} title={when}>{when}</span>
                </span>
              </span>
              <span className={styles.windowReviewTrail}>
                <span className={styles.windowReviewLimit}>{windowLabel(windowFor(types, a, kind))} limit</span>
                {onRemove && <ActionButton icon="solar:close-linear" size="sm" tooltip={`Don't ${verb}`} tooltipLeft onClick={() => onRemove(a)} />}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

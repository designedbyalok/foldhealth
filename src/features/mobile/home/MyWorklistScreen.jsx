import { Avatar } from '../../../components/Avatar/Avatar';
import { Badge } from '../../../components/Badge/Badge';
import { formatPatientMeta, useMyWorklistPatients } from '../../home/useMyWorklistPatients';
import { MobileSubHeader } from '../MobileHeader';
import { initialsOf } from '../mobileFormat';
import { MobileEmpty, MobileListSkeleton } from '../MobileParts';
import { useMobileNav } from '../MobileNavContext';
import styles from '../mobile.module.css';

/** Everyone assigned to me across worklists (Home "My Worklist" → See all). */
export function MyWorklistScreen() {
  const { openMember } = useMobileNav();
  const { rows, loading } = useMyWorklistPatients();
  return (
    <div className={styles.screen}>
      <MobileSubHeader title="My Worklist" />
      <div className={styles.body}>
        {loading && !rows.length ? <MobileListSkeleton /> : rows.length === 0 ? (
          <MobileEmpty icon="solar:users-group-rounded-linear" title="No patients are assigned to you" />
        ) : (
          <div className={styles.list}>
            {rows.map(row => (
              <button key={row.key} type="button" className={styles.card} onClick={() => openMember({ id: row.patientId, memberId: row.memberId, name: row.name })}>
                <Avatar variant="patient" size="L" initials={row.initials && row.initials !== '??' ? row.initials : initialsOf(row.name)} />
                <span className={styles.cardText}>
                  <span className={styles.primaryText}>{row.name}</span>
                  <span className={styles.secondaryText}>{formatPatientMeta(row)}</span>
                </span>
                {row.myTaskCount > 0 && <Badge tone="neutral" variant="soft" size="sm" label={`${row.myTaskCount} ${row.myTaskCount === 1 ? 'Task' : 'Tasks'}`} />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

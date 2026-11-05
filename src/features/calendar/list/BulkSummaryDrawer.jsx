import { useEffect, useMemo, useState } from 'react';
import { Drawer } from '../../../components/Drawer/Drawer';
import { Avatar } from '../../../components/Avatar/Avatar';
import { Icon } from '../../../components/Icon/Icon';
import { SegmentedControl } from '../../../components/SegmentedControl/SegmentedControl';
import { EmptyState } from '../../../components/EmptyState/EmptyState';
import { useAppStore } from '../../../store/useAppStore';
import { formatDate, initialsOf } from '../../ooo/oooUtils';
import { ApptRow } from '../../ooo/ReassignParts';
import { apptLine } from '../../ooo/reassignUtils';
import { BULK_JOB_COPY } from './bulkJobs';
import styles from '../../ooo/reassign.module.css';

/**
 * Appointment Rescheduling / Cancellation Summary: what a bulk job did, laid
 * out as the Appointment Reassignment Summary is. When it ran and who ran it
 * under the title; whose appointments they were; then the done ones and the
 * failed ones (with why), one card each. Opens from the "summary is ready"
 * notification.
 *
 * @param {object}   props
 * @param {string}   props.jobId
 * @param {function} props.onClose
 */
export function BulkSummaryDrawer({ jobId, onClose }) {
  const jobs = useAppStore(s => s.bulkJobs);
  const fetchJobs = useAppStore(s => s.fetchBulkJobs);
  useEffect(() => { fetchJobs(); }, [fetchJobs]);
  const job = jobs.find(j => j.id === jobId);
  const copy = BULK_JOB_COPY[job?.kind] || BULK_JOB_COPY.reschedule;
  const tabs = [
    { key: 'done', label: copy.done, empty: `No ${copy.done} Entries` },
    { key: 'failed', label: 'Failed', empty: 'No Failed Entries' },
  ];
  const [tab, setTab] = useState('done');
  const shown = useMemo(() => (job ? job.results.filter(r => r.outcome === tab) : []), [job, tab]);
  // A cancel can span providers; then the card says how many.
  const providers = job ? [...new Set(job.results.map(r => r.appointment?.provider).filter(Boolean))] : [];
  // The provider's role, from the job or (a cancel records none) their profile.
  const people = useAppStore(s => (s.platformPeople?.length ? s.platformPeople : s.platformUsers));
  const providerName = job?.provider || providers[0];
  const person = (people || []).find(u => u.name === providerName);
  const role = job?.providerRole || person?.role || person?.clinicalRoles?.[0] || null;

  return (
    <Drawer
      title={(
        <span className={styles.drawerTitle}>
          {copy.title}
          {job && (
            <span className={styles.drawerSubtitle}>
              {[
                `${copy.done} on ${formatDate(job.createdAt)}, ${new Date(job.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
                job.createdBy ? `by ${job.createdBy}` : null,
              ].filter(Boolean).join(' ')}
            </span>
          )}
        </span>
      )}
      // Two-line title: let the header grow, with 8px above and below.
      headerStyle={{ height: 'auto', paddingTop: 'var(--space-2)', paddingBottom: 'var(--space-2)' }}
      width={640}
      onClose={onClose}
    >
      {!job ? (
        <EmptyState icon="solar:history-linear" title={`This ${copy.title.toLowerCase()} isn't available`} />
      ) : (
        <div className={styles.summary}>
          <div className={styles.summaryField}>
            <span className={styles.summaryLabel}>{copy.done} For</span>
            <div className={styles.summaryCard}>
              {job.provider || providers.length === 1 ? (
                <>
                  <Avatar variant="staff" initials={initialsOf(job.provider || providers[0])} size="M" />
                  <span className={styles.summaryCardText}>
                    <span className={styles.summaryCardMain}>{job.provider || providers[0]}</span>
                    {role && <span className={styles.summaryCardSub}>{role}</span>}
                  </span>
                </>
              ) : (
                <>
                  <Avatar type="icon" variant="others" iconName="solar:users-group-rounded-linear" size="M" />
                  <span className={styles.summaryCardText}>
                    <span className={styles.summaryCardMain}>{providers.length} Providers</span>
                    <span className={styles.summaryCardSub}>{providers.join(', ')}</span>
                  </span>
                </>
              )}
            </div>
          </div>
          <div className={`${styles.summaryField} ${styles.summaryTabs}`}>
            <span className={styles.summaryLabel}>Appointments Summary</span>
            {/* A segmented switch, as the Reassignment Summary's in Figma (Eventus 17057:156013). */}
            <SegmentedControl
              items={tabs.map(t => ({ key: t.key, label: `${t.label} (${job.results.filter(r => r.outcome === t.key).length})` }))}
              value={tab}
              onValueChange={setTab}
              size="md"
              className={styles.summarySwitch}
            />
            {/* A cancel's one reason, with the appointments it cancelled. */}
            {job.kind === 'cancel' && job.reason && tab === 'done' && <span className={styles.summaryNote}>Reason: <span className={styles.summaryNoteValue}>{job.reason}</span></span>}
          </div>
          {shown.length === 0 ? (
            <div className={styles.summaryEmpty}>
              <EmptyState icon="solar:calendar-mark-linear" title={tabs.find(t => t.key === tab).empty} />
            </div>
          ) : (
            // One card per appointment, in the order they were changed.
            <div className={styles.cardList}>
              {shown.map(r => <SummaryRow key={r.appointmentId} result={r} kind={job.kind} />)}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}

// The appointment, then what happened to it (or why it didn't).
function SummaryRow({ result, kind }) {
  const appt = result.appointment || {};
  const to = result.to || {};
  // Same format as the card's own time line ("11/18/2026, 9:00-9:30 AM").
  const newTime = to.date ? apptLine({ date: to.date, time_start: to.timeStart, time_end: to.timeEnd }) : '';
  if (result.outcome === 'failed') {
    return (
      <ApptRow appt={appt} tone="failed">
        <span className={styles.failReason}>
          <Icon name="solar:info-circle-linear" size={14} color="var(--status-error)" />
          Reason: {result.reason || 'Unknown'}
        </span>
      </ApptRow>
    );
  }
  // The tab already says they were cancelled.
  if (kind === 'cancel') return <ApptRow appt={appt} />;
  return (
    // Its old time, labelled, so the two times don't read as one.
    <ApptRow appt={appt} subPrefix="Was">
      <span className={styles.movedTo}>Rescheduled to {newTime}</span>
    </ApptRow>
  );
}

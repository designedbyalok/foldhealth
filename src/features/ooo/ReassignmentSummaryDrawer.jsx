import { useEffect, useMemo, useState } from 'react';
import { Drawer } from '../../components/Drawer/Drawer';
import { Avatar } from '../../components/Avatar/Avatar';
import { Icon } from '../../components/Icon/Icon';
import { Tabs } from '../../components/Tabs/Tabs';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { useAppStore } from '../../store/useAppStore';
import { formatDate, initialsOf } from './oooUtils';
import { TYPE_LABELS } from './reassignJobs';
import { ApptRow, DeptGroup } from './ReassignParts';
import styles from './reassign.module.css';

const TABS = [
  { key: 'reassigned', label: 'Reassigned', pick: r => r.outcome === 'reassigned' },
  { key: 'cancelled', label: 'Cancelled', pick: r => r.outcome === 'cancelled' },
  { key: 'conflicting', label: 'Conflicting', pick: r => r.outcome === 'reassigned' && r.conflict },
  { key: 'failed', label: 'Failed Reassignment', pick: r => r.outcome === 'failed' },
];

const byDept = (results) => {
  const map = new Map();
  results.forEach((r) => {
    const d = r.appointment?.location || 'No Department';
    if (!map.has(d)) map.set(d, []);
    map.get(d).push(r);
  });
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
};

/**
 * Appointment Reassignment Summary (Figma Eventus 17626:122415): what a
 * reassignment job did. Who and what type it was for, then the outcome by
 * tab, each grouped by department: Reassigned (with the covering provider),
 * Cancelled, Conflicting (reassigned but clashing with an appointment the
 * covering provider already had, shown under it) and Failed (with why).
 * Opens from the "summary is ready" notification and from History.
 *
 * @param {object}   props
 * @param {string}   props.jobId
 * @param {function} props.onClose
 */
export function ReassignmentSummaryDrawer({ jobId, onClose }) {
  const jobs = useAppStore(s => s.reassignmentJobs);
  const fetchJobs = useAppStore(s => s.fetchReassignmentJobs);
  useEffect(() => { fetchJobs(); }, [fetchJobs]);
  const job = jobs.find(j => j.id === jobId);
  const [tab, setTab] = useState('reassigned');
  const groups = useMemo(() => {
    const t = TABS.find(x => x.key === tab);
    return job ? byDept(job.results.filter(t.pick)) : [];
  }, [job, tab]);

  const range = job && (job.windowEnd
    ? `${formatDate(job.windowStart)} → ${formatDate(job.windowEnd)}`
    : job?.windowStart ? `From ${formatDate(job.windowStart)}` : '');

  return (
    <Drawer title="Appointment Reassignment Summary" width={640} onClose={onClose}>
      {!job ? (
        <EmptyState icon="solar:history-linear" title="This reassignment summary isn't available" />
      ) : (
        <div className={styles.summary}>
          <div className={styles.summaryField}>
            <span className={styles.summaryLabel}>Reassigned From:</span>
            <div className={styles.summaryCard}>
              <Avatar variant="staff" initials={initialsOf(job.fromUser)} size="M" />
              <span className={styles.summaryCardText}>
                <span className={styles.summaryCardMain}>{job.fromUser}</span>
                {job.fromUserRole && <span className={styles.summaryCardSub}>{job.fromUserRole}</span>}
              </span>
            </div>
          </div>
          <div className={styles.summaryField}>
            <span className={styles.summaryLabel}>Reassignment Type:</span>
            <div className={styles.summaryCard}>
              <Avatar type="icon" variant="others" iconName="solar:calendar-linear" size="M" />
              <span className={styles.summaryCardText}>
                <span className={styles.summaryCardMain}>{TYPE_LABELS[job.type] || 'Reassignment'}</span>
                {range && <span className={styles.summaryCardSub}>{range}</span>}
              </span>
            </div>
          </div>
          <div className={styles.summaryField}>
            <span className={styles.summaryLabel}>Appointments Summary</span>
            <Tabs
              items={TABS.map(t => ({ key: t.key, label: `${t.label} (${job.results.filter(t.pick).length})` }))}
              value={tab}
              onValueChange={setTab}
              fullWidth={false}
            />
          </div>
          {groups.length === 0 ? (
            <span className={styles.empty}>Nothing here for this reassignment.</span>
          ) : (
            <div className={styles.list}>
              {groups.map(([dept, results]) => (
                <DeptGroup
                  key={`${tab}-${dept}`}
                  title={dept}
                  count={results.length}
                  defaultOpen={groups.length === 1 || tab !== 'reassigned'}
                  controls={tab === 'reassigned' ? <CoveringAvatars results={results} /> : null}
                  items={results}
                  renderItem={(r) => <SummaryRow key={r.appointmentId} result={r} tab={tab} />}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}

function CoveringAvatars({ results }) {
  const names = [...new Set(results.map(r => r.to).filter(Boolean))];
  return (
    <span className={styles.controls}>
      {names.slice(0, 3).map(n => <Avatar key={n} variant="staff" initials={initialsOf(n)} size="S" />)}
    </span>
  );
}

function SummaryRow({ result, tab }) {
  const appt = result.appointment || {};
  if (tab === 'conflicting') {
    return (
      <ApptRow appt={appt} tone="conflict" trail={<span className={styles.tagMuted}>Reassigned</span>}>
        <span className={styles.conflictNote}>Conflicts with the below pre-existing appointment in provider&apos;s schedule:</span>
        <div className={styles.conflictWith}><ApptRow appt={result.conflict.appointment} /></div>
      </ApptRow>
    );
  }
  if (tab === 'failed') {
    return (
      <ApptRow appt={appt} tone="failed">
        <span className={styles.failReason}>
          <Icon name="solar:info-circle-linear" size={14} color="var(--status-error)" />
          Failure Reason: {result.reason || 'Unknown'}
        </span>
      </ApptRow>
    );
  }
  return (
    <ApptRow
      appt={appt}
      trail={tab === 'reassigned' && result.to ? <Avatar variant="staff" initials={initialsOf(result.to)} size="S" /> : null}
    />
  );
}

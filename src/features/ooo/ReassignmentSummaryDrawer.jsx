import { useEffect, useState } from 'react';
import { Drawer } from '../../components/Drawer/Drawer';
import { Avatar } from '../../components/Avatar/Avatar';
import { Icon } from '../../components/Icon/Icon';
import { Tabs } from '../../components/Tabs/Tabs';
import { SegmentedControl } from '../../components/SegmentedControl/SegmentedControl';
import { Badge } from '../../components/Badge/Badge';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { useAppStore } from '../../store/useAppStore';
import { formatDate, initialsOf } from './oooUtils';
import { kindOf, TYPE_LABELS } from './reassignJobs';
import { PROGRAM_SHAPE, TASK_SHAPE } from './openWorkRows';
import { ApptRow, DeptGroup } from './ReassignParts';
import styles from './reassign.module.css';

const TABS = [
  { key: 'reassigned', label: 'Reassigned', pick: r => r.outcome === 'reassigned' },
  { key: 'cancelled', label: 'Cancelled', pick: r => r.outcome === 'cancelled' },
  { key: 'conflicting', label: 'Conflicting', pick: r => r.outcome === 'reassigned' && r.conflict },
  { key: 'failed', label: 'Failed Reassignment', pick: r => r.outcome === 'failed' },
];

// Tasks and care programs (Out of Office Reassign Open Work) have no
// Cancelled or Conflicting.
const ITEM_TABS = TABS.filter(t => t.key === 'reassigned' || t.key === 'failed');
// What a job moved, by kind: each kind is a tab when the job has it.
const KINDS = [
  { key: 'appointment', label: 'Appointments', tabs: TABS },
  { key: 'task', label: 'Tasks', tabs: ITEM_TABS },
  { key: 'program', label: 'Care Programs', tabs: ITEM_TABS },
];
const snapshotOf = (r) => r.appointment || r.task || r.program || {};

const byDept = (results) => {
  const map = new Map();
  results.forEach((r) => {
    const d = snapshotOf(r).location || 'No Department';
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
  // Kinds this job has (an appointments-only job shows no kind tabs).
  const kinds = job ? KINDS.filter(k => job.results.some(r => kindOf(r) === k.key)) : [];
  const [kindKey, setKindKey] = useState(null);
  const kind = kinds.find(k => k.key === kindKey) || kinds[0] || KINDS[0];
  const ofKind = job ? job.results.filter(r => kindOf(r) === kind.key) : [];
  const [tab, setTab] = useState('reassigned');
  const activeTab = kind.tabs.find(x => x.key === tab) || kind.tabs[0];
  const groups = byDept(ofKind.filter(activeTab.pick));
  const mixed = kinds.length > 1 || (kinds[0] && kinds[0].key !== 'appointment');

  const range = job && (job.windowEnd
    ? `${formatDate(job.windowStart)} → ${formatDate(job.windowEnd)}`
    : job?.windowStart ? `From ${formatDate(job.windowStart)}` : '');

  return (
    <Drawer title={mixed ? 'Out of Office Reassignment Summary' : 'Appointment Reassignment Summary'} width={640} onClose={onClose}>
      {!job ? (
        <EmptyState icon="solar:history-linear" title="This reassignment summary isn't available" />
      ) : (
        <div className={styles.summary}>
          <div className={styles.summaryField}>
            <span className={styles.summaryLabel}>Reassigned From</span>
            <div className={styles.summaryCard}>
              <Avatar variant="staff" initials={initialsOf(job.fromUser)} size="M" />
              <span className={styles.summaryCardText}>
                <span className={styles.summaryCardMain}>{job.fromUser}</span>
                {job.fromUserRole && <span className={styles.summaryCardSub}>{job.fromUserRole}</span>}
              </span>
            </div>
          </div>
          <div className={styles.summaryField}>
            <span className={styles.summaryLabel}>Reassignment Type</span>
            <div className={styles.summaryCard}>
              <Avatar type="icon" variant="others" iconName="solar:calendar-linear" size="M" />
              <span className={styles.summaryCardText}>
                <span className={styles.summaryCardMain}>{TYPE_LABELS[job.type] || 'Reassignment'}</span>
                {range && <span className={styles.summaryCardSub}>{range}</span>}
              </span>
            </div>
          </div>
          <div className={styles.summaryField}>
            <span className={styles.summaryLabel}>{mixed ? 'Summary' : 'Appointments Summary'}</span>
            {/* Modules as underline tabs, flush with the content's left edge;
                the outcome as a toggle under them. */}
            {mixed && (
              <Tabs
                items={kinds.map(k => ({ key: k.key, label: `${k.label} (${job.results.filter(r => kindOf(r) === k.key).length})` }))}
                value={kind.key}
                onValueChange={(k) => { setKindKey(k); setTab('reassigned'); }}
                fullWidth={false}
                className={styles.summaryTabsFlush}
              />
            )}
            <SegmentedControl
              // The count as a grey count badge after each label.
              items={kind.tabs.map(t => ({
                key: t.key,
                ariaLabel: `${t.label} (${ofKind.filter(t.pick).length})`,
                label: <span className={styles.segLabel}>{t.label}<Badge tone="neutral" size="xs" label={String(ofKind.filter(t.pick).length)} /></span>,
              }))}
              value={activeTab.key}
              onValueChange={setTab}
              size="md"
              className={mixed ? `${styles.summarySwitch} ${styles.summarySwitchUnderTabs}` : styles.summarySwitch}
            />
          </div>
          {groups.length === 0 ? (
            <span className={styles.empty}>Nothing here for this reassignment.</span>
          ) : (
            <div className={styles.list}>
              {groups.map(([dept, results]) => (
                <DeptGroup
                  key={`${kind.key}-${tab}-${dept}`}
                  title={dept}
                  count={results.length}
                  noun={kind.key === 'task' ? 'Task' : kind.key === 'program' ? 'Program' : 'Appointment'}
                  defaultOpen={groups.length === 1 || tab !== 'reassigned'}
                  controls={tab === 'reassigned' ? <CoveringAvatars results={results} /> : null}
                  items={results}
                  renderItem={(r) => (kindOf(r) === 'appointment'
                    ? <SummaryRow key={r.appointmentId} result={r} tab={tab} />
                    : <ItemSummaryRow key={r.taskId || r.programId} result={r} />)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}

/** A task or care program in the summary: its row, then who it went to or why it failed. */
function ItemSummaryRow({ result }) {
  const isTask = kindOf(result) === 'task';
  const item = isTask ? result.task : result.program;
  const main = (isTask ? TASK_SHAPE : PROGRAM_SHAPE).renderMain(item || {});
  return (
    <div className={[styles.apptRow, result.outcome === 'failed' ? styles.tone_failed : ''].filter(Boolean).join(' ')}>
      <div className={styles.apptMain}>
        {main}
        {result.outcome === 'reassigned' && result.to && (
          <span className={styles.apptTrail}><Avatar variant="staff" initials={initialsOf(result.to)} size="S" /></span>
        )}
      </div>
      {result.outcome === 'failed' && (
        <span className={styles.failReason}>
          <Icon name="solar:info-circle-linear" size={16} color="var(--neutral-300)" />
          Failure Reason: {result.reason || 'Unknown'}
        </span>
      )}
    </div>
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
          <Icon name="solar:info-circle-linear" size={16} color="var(--neutral-300)" />
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

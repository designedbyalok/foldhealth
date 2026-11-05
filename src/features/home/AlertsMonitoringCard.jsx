import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../components/Icon/Icon';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Avatar } from '../../components/Avatar/Avatar';
import { useAppStore } from '../../store/useAppStore';
import { formatDobDisplay, deriveDob } from '../../lib/patientDob';
import { TaskDetailDrawer } from '../tasks/TaskDetailDrawer';
import { HomeWidgetEmpty } from './HomeWidgetEmpty';
import styles from './HomeView.module.css';

function normName(name) {
  return (name || '').trim().toLowerCase();
}

function matchTaskAssignee(task, meId, meName) {
  return (!!meId && task.assigned_to_id && String(task.assigned_to_id) === String(meId))
    || (!!meName && normName(task.assigned_to) === normName(meName));
}

function collectAssigneeNames(record) {
  return [record.assignee, record.assigneeName, record.sup, record.cdr, record.r1, record.r2]
    .filter(Boolean);
}

function isAssignedToMe(record, meId, meName) {
  if (meId && record.assigneeId && String(record.assigneeId) === String(meId)) return true;
  if (meId && record.assignee_id && String(record.assignee_id) === String(meId)) return true;
  if (!meName) return false;
  const me = normName(meName);
  const names = record.assigneeNames?.length ? record.assigneeNames : collectAssigneeNames(record);
  return names.some(n => normName(n) === me);
}

function mergeWorklistRows(existing, incoming) {
  return {
    ...existing,
    patientId: existing.patientId || incoming.patientId,
    memberId: existing.memberId || incoming.memberId,
    dob: existing.dob || incoming.dob,
    age: existing.age || incoming.age,
    initials: existing.initials !== '??' ? existing.initials : incoming.initials,
    // SNP/HCC assignee updates must survive dedupe, the old merge kept
    // only demographics, so a TOC row without an assignee clobbered the
    // SNP row the user just assigned to themselves.
    assigneeId: existing.assigneeId || incoming.assigneeId,
    assigneeNames: [...new Set([...(existing.assigneeNames || []), ...(incoming.assigneeNames || [])])],
  };
}

function formatPatientMeta(p) {
  const genderLabel = p.gender === 'M' ? 'Male' : p.gender === 'F' ? 'Female' : p.gender || '';
  const dob = formatDobDisplay(p.dob) || deriveDob(p.age, p.name) || '';
  const agePart = p.age ? `(${p.age})` : '';
  const dobAge = [dob, agePart].filter(Boolean).join(' ');
  return [genderLabel, dobAge].filter(Boolean).join(' • ');
}

function toWorklistRow(source, kind) {
  const gender = source.gender || source.g;
  return {
    key: `${kind}:${source.memberId || source.id || source.name}`,
    id: source.id,
    patientId: source.patientId || (kind === 'patients' ? source.id : null),
    memberId: source.memberId,
    name: source.name,
    initials: source.initials || source.in || '??',
    gender,
    age: source.age,
    dob: source.dob,
    assigneeId: source.assigneeId || source.assignee_id || null,
    assigneeNames: collectAssigneeNames(source),
    kind,
  };
}

function resolvePatientId(row, patients, allPatients) {
  if (row.patientId) return row.patientId;
  const byName = patients.find(p => normName(p.name) === normName(row.name))
    || allPatients.find(p => normName(p.name) === normName(row.name));
  return byName?.id || null;
}

function countMyTasksForPatient(patientName, tasks, meId, meName) {
  const target = normName(patientName);
  if (!target) return 0;
  return tasks.filter(t =>
    t.status !== 'completed'
    && matchTaskAssignee(t, meId, meName)
    && normName(t.member) === target,
  ).length;
}

export function AlertsMonitoringCard({ dragHandleClassName }) {
  const patients = useAppStore(s => s.patients);
  const patientsLoading = useAppStore(s => s.patientsLoading);
  const patientsError = useAppStore(s => s.patientsError);
  const fetchPatients = useAppStore(s => s.fetchPatients);
  const tasks = useAppStore(s => s.tasks);
  const tasksLoading = useAppStore(s => s.tasksLoading);
  const fetchTasks = useAppStore(s => s.fetchTasks);
  const fetchTaskProfiles = useAppStore(s => s.fetchTaskProfiles);
  const currentUserProfile = useAppStore(s => s.currentUserProfile);
  const hccMembers = useAppStore(s => s.hccMembers);
  const snpWorklistMembers = useAppStore(s => s.snpWorklistMembers);
  const hedisMembers = useAppStore(s => s.hedisMembers);
  const awvMembers = useAppStore(s => s.awvMembers) || [];
  const ccmWorklistMembers = useAppStore(s => s.ccmWorklistMembers) || [];
  const allPatients = useAppStore(s => s.allPatients) || [];
  const fetchHccMembers = useAppStore(s => s.fetchHccMembers);
  const fetchSnpWorklistMembers = useAppStore(s => s.fetchSnpWorklistMembers);
  const fetchHedisMembers = useAppStore(s => s.fetchHedisMembers);
  const fetchAwvMembers = useAppStore(s => s.fetchAwvMembers);
  const fetchCcmWorklistMembers = useAppStore(s => s.fetchCcmWorklistMembers);
  const fetchAllPatients = useAppStore(s => s.fetchAllPatients);
  const openQuickView = useAppStore(s => s.openQuickView);
  const [selectedTask, setSelectedTask] = useState(null);

  useEffect(() => {
    fetchPatients();
    fetchTasks();
    fetchTaskProfiles();
    fetchHccMembers();
    fetchSnpWorklistMembers();
    fetchHedisMembers();
    fetchAwvMembers?.();
    fetchCcmWorklistMembers?.();
    // all_patients is ~100 KB and is only used to resolve a row click
    // onto a profile id. Load it then, not on every Home visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const meId = currentUserProfile?.id || null;
  const meName = currentUserProfile?.name || null;

  const worklistRows = useMemo(() => {
    const merged = new Map();

    const add = (row) => {
      if (!row.name) return;
      const existing = merged.get(normName(row.name));
      if (!existing) {
        merged.set(normName(row.name), row);
        return;
      }
      merged.set(normName(row.name), mergeWorklistRows(existing, row));
    };

    patients.forEach(p => add(toWorklistRow(p, 'patients')));
    hccMembers.forEach(m => add(toWorklistRow(m, 'hcc')));
    snpWorklistMembers.forEach(m => add(toWorklistRow(m, 'snp')));
    hedisMembers.forEach(m => add(toWorklistRow({ ...m, initials: m.in, gender: m.gender }, 'hedis')));
    awvMembers.forEach(m => add(toWorklistRow({ ...m, initials: m.in, gender: m.g, assignee: m.sup }, 'awv')));
    ccmWorklistMembers.forEach(m => add(toWorklistRow(m, 'ccm')));

    let rows = [...merged.values()].filter(r => isAssignedToMe(r, meId, meName));

    // If nothing is explicitly assigned, fall back to patients that carry
    // open tasks for me: still real platform rows, just task-derived.
    if (rows.length === 0 && meName) {
      const taskNames = new Set();
      for (const t of tasks) {
        if (t.status !== 'completed' && matchTaskAssignee(t, meId, meName) && t.member) {
          taskNames.add(normName(t.member));
        }
      }
      rows = [...merged.values()].filter(r => taskNames.has(normName(r.name)));
    }

    return rows
      .map(row => ({
        ...row,
        myTaskCount: countMyTasksForPatient(row.name, tasks, meId, meName),
      }))
      .sort((a, b) => {
        if (b.myTaskCount !== a.myTaskCount) return b.myTaskCount - a.myTaskCount;
        return a.name.localeCompare(b.name);
      });
  }, [patients, hccMembers, snpWorklistMembers, hedisMembers, awvMembers, ccmWorklistMembers, tasks, meId, meName]);

  const loading = patientsLoading || tasksLoading;

  const handleRowClick = async (row) => {
    let patientId = resolvePatientId(row, patients, allPatients);
    if (!patientId) {
      await fetchAllPatients?.();
      const st = useAppStore.getState();
      patientId = resolvePatientId(row, st.patients, st.allPatients || []);
    }
    openQuickView({
      id: patientId || row.id || row.key,
      name: row.name,
      initials: row.initials,
      gender: row.gender,
      age: row.age,
      dob: row.dob,
      memberId: row.memberId,
    });
  };

  const handleTaskBadgeClick = (e, row) => {
    e.stopPropagation();
    const match = tasks.find(t =>
      t.status !== 'completed'
      && matchTaskAssignee(t, meId, meName)
      && normName(t.member) === normName(row.name),
    );
    if (match) setSelectedTask(match);
  };

  return (
    <>
      <div className={styles.card}>
        <div className={[styles.cardHeader, dragHandleClassName].filter(Boolean).join(' ')}>
          <div className={styles.cardTitle}>
            <Icon name="solar:clipboard-list-linear" size={14} color="var(--primary-300)" />
            My Worklist
          </div>
          <div className={styles.cardActions}>
            <ActionButton icon="solar:user-linear" size="sm" tooltip="Assigned to me" />
            <ActionButton icon="solar:hamburger-menu-linear" size="sm" tooltip="List view" />
            <ActionButton icon="custom:filter" size="sm" tooltip="Filter" />
          </div>
        </div>
        <div className={styles.cardBody}>
          {loading && <div className={styles.loading}>Loading worklist…</div>}
          {patientsError && !loading && <div className={styles.errorState}>Failed to load patients</div>}
          {!loading && !patientsError && worklistRows.length === 0 && (
            <HomeWidgetEmpty
              icon="solar:clipboard-list-linear"
              title="Your worklist is clear"
              description="Patients assigned to you from SNP, HCC, and other worklists will appear here."
            />
          )}
          {!loading && worklistRows.map(row => (
            <div
              key={row.key}
              className={styles.patientRowBtn}
            >
              <button type="button" className={styles.patientRowMain} onClick={() => handleRowClick(row)}>
                <span className={styles.checkbox} aria-hidden="true" />
                <Avatar variant="patient" initials={row.initials} />
                <div className={styles.patientInfo}>
                  <div className={styles.patientName}>
                    {row.name} <span className={styles.chevron}>›</span>
                  </div>
                  <div className={styles.patientMeta}>{formatPatientMeta(row)}</div>
                </div>
              </button>
              {row.myTaskCount > 0 && (
                <button
                  type="button"
                  className={[styles.badge, styles.task, styles.taskBadgeBtn].filter(Boolean).join(' ')}
                  onClick={(e) => handleTaskBadgeClick(e, row)}
                >
                  <Icon name="solar:checklist-minimalistic-linear" size={10} />
                  {row.myTaskCount} {row.myTaskCount === 1 ? 'Task' : 'Tasks'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {selectedTask && (
        <TaskDetailDrawer
          task={tasks.find(t => t.id === selectedTask.id) || selectedTask}
          onClose={() => setSelectedTask(null)}
          onSelectTask={setSelectedTask}
        />
      )}
    </>
  );
}

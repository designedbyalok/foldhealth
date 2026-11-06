import { useState } from 'react';
import { Icon } from '../../components/Icon/Icon';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Avatar } from '../../components/Avatar/Avatar';
import { useAppStore } from '../../store/useAppStore';
import {
  formatPatientMeta, matchTaskAssignee, normName, resolvePatientId, useMyWorklistPatients,
} from './useMyWorklistPatients';
import { TaskDetailDrawer } from '../tasks/TaskDetailDrawer';
import { HomeWidgetEmpty } from './HomeWidgetEmpty';
import styles from './HomeView.module.css';

export function AlertsMonitoringCard({ dragHandleClassName }) {
  const patients = useAppStore(s => s.patients);
  const tasks = useAppStore(s => s.tasks);
  const allPatients = useAppStore(s => s.allPatients) || [];
  const fetchAllPatients = useAppStore(s => s.fetchAllPatients);
  const openQuickView = useAppStore(s => s.openQuickView);
  const patientsError = useAppStore(s => s.patientsError);
  const [selectedTask, setSelectedTask] = useState(null);
  // all_patients is ~100 KB and is only used to resolve a row click onto a
  // profile id, so it loads on click, not on every Home visit.
  const { rows: worklistRows, loading, meId, meName } = useMyWorklistPatients();

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

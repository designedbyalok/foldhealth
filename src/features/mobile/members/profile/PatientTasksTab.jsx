import { useEffect, useMemo } from 'react';
import { Button } from '../../../../components/Button/Button';
import { useAppStore } from '../../../../store/useAppStore';
import { useMobileNav } from '../../MobileNavContext';
import { taskBucket } from '../../tasks/myTasks';
import { TaskRow } from '../../tasks/TaskRow';
import { ProfileEmpty, ProfileSection } from './ProfileSection';
import styles from '../MemberProfileScreen.module.css';

const ORDER = { overdue: 0, today: 1, upcoming: 2, none: 3, done: 4 };

/**
 * This patient's tasks (Figma P360 Task tab): open first by due date, then
 * done. Linked by store id, member id, or (older rows) name, the same way
 * the desktop PatientTasksTab matches them. Subtasks stay with their parent
 * on desktop, so they're left out here.
 */
export function PatientTasksTab({ patient }) {
  const { push } = useMobileNav();
  const tasks = useAppStore(s => s.tasks);
  const fetchTasks = useAppStore(s => s.fetchTasks);
  useEffect(() => { fetchTasks?.(); }, [fetchTasks]);

  const { open, done } = useMemo(() => {
    const ids = new Set([patient.id, patient.memberId].filter(v => v != null).map(String));
    const mine = (tasks || [])
      .filter(t => !t.is_subtask && (ids.has(String(t.patient_id)) || (patient.name && t.member === patient.name)))
      .map(t => ({ ...t, bucket: taskBucket(t) }))
      .sort((a, b) => ORDER[a.bucket] - ORDER[b.bucket]);
    return { open: mine.filter(t => t.bucket !== 'done'), done: mine.filter(t => t.bucket === 'done') };
  }, [tasks, patient]);

  const addTask = () => push('addTask', { patientId: patient.id, patientName: patient.name });

  return (
    <>
      <div className={styles.tabAction}>
        <Button variant="soft" leadingIcon="solar:add-circle-linear" onClick={addTask} fullWidth>Add Task</Button>
      </div>
      <ProfileSection title="Open Tasks" count={open.length || null}>
        {open.length === 0 ? <ProfileEmpty>No open tasks for this patient</ProfileEmpty> : open.map(t => <TaskRow key={t.id} task={t} />)}
      </ProfileSection>
      {done.length > 0 && (
        <ProfileSection title="Completed" count={done.length} defaultOpen={false}>
          {done.map(t => <TaskRow key={t.id} task={t} />)}
        </ProfileSection>
      )}
    </>
  );
}

import { useMemo, useState } from 'react';
import { TaskListSection, TaskDetailDrawer } from '../../../../../../../tasks/TasksView';
import { useAppStore } from '../../../../../../../../store/useAppStore';
import styles from './ProgramRelatedTasks.module.css';

const STATUS_LABEL = { pending: 'Pending', missed: 'Missed', completed: 'Completed' };
const cap = (s = '') => s.charAt(0).toUpperCase() + s.slice(1);
// completed_at is an ISO timestamp; show it as MM/DD/YYYY to match due dates.
const fmtCompleted = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
};

const EMPTY_FILTERS = { status: [], priority: [], dueDate: [], completedDate: [] };

/**
 * Program Related Tasks: Open / Completed sections built from the shared Tasks
 * module row (TaskRow), with the Member column hidden since we're already in a
 * member's care program. Tasks are created via the Add Task drawer and live in
 * the shared task store, so status toggles/edits stay live.
 *
 * `filters` (Status / Priority / Due Date / Completed Date) come from the
 * section-header filter bar in ProgramDetailView.
 */
export function ProgramRelatedTasks({ programCode, patientId, onAddTask, filters = EMPTY_FILTERS, search = '' }) {
  const added = useAppStore(s => s.programAddedTasks[programCode]);
  const globalTasks = useAppStore(s => s.tasks);
  // Program tasks + their subtasks. The task↔program link is persisted via the
  // `program_code` / `patient_id` columns (tasks_program_link_migration), so a
  // program's tasks survive reload. The session `programAddedTasks` list is
  // kept as a fallback (covers the moment before the migration is run, when
  // those columns are stripped on insert). Subtasks are separate store rows
  // (parent_task_id → parent); include them so they render as rows with the
  // "Parent Task : …" label, exactly like the Tasks module.
  const tasks = useMemo(() => {
    const persisted = globalTasks.filter(g =>
      !g.is_subtask
      && g.program_code === programCode
      && (patientId == null || String(g.patient_id) === String(patientId)));
    const sessionAdded = (added || []).map(a => globalTasks.find(g => g.id === a.id) || a);
    const seen = new Set();
    const result = [];
    const push = (t) => { if (t && !seen.has(t.id)) { seen.add(t.id); result.push(t); } };
    for (const p of [...persisted, ...sessionAdded]) {
      push(p);
      for (const g of globalTasks) {
        if (g.parent_task_id === p.id || (g.is_subtask && g.parent_task === p.name)) {
          push(g);
        }
      }
    }
    return result;
  }, [added, globalTasks, programCode, patientId]);

  const q = search.trim().toLowerCase();
  const shownTasks = useMemo(() => {
    const statusSet = filters.status.length ? new Set(filters.status) : null;
    const prioritySet = filters.priority.length ? new Set(filters.priority) : null;
    const dueDateSet = filters.dueDate.length ? new Set(filters.dueDate) : null;
    const completedDateSet = filters.completedDate.length ? new Set(filters.completedDate) : null;
    return tasks.filter(t =>
      (!q || (t.name || '').toLowerCase().includes(q))
      && (!statusSet || statusSet.has(STATUS_LABEL[t.status]))
      && (!prioritySet || prioritySet.has(cap(t.priority)))
      && (!dueDateSet || dueDateSet.has(t.due_date))
      && (!completedDateSet || completedDateSet.has(fmtCompleted(t.completed_at)))
    );
  }, [tasks, filters, q]);

  // Clicking a task row opens the shared Task Details drawer. Re-resolve from
  // the live store so edits made in the drawer stay reflected.
  const [selectedTask, setSelectedTask] = useState(null);
  const liveSelected = selectedTask && (globalTasks.find(t => t.id === selectedTask.id) || selectedTask);

  return (
    <div className={styles.wrap}>
      <TaskListSection tasks={shownTasks} hideMember onAddTask={onAddTask} onTaskClick={setSelectedTask} />
      {liveSelected && (
        <TaskDetailDrawer
          task={liveSelected}
          onClose={() => setSelectedTask(null)}
          onSelectTask={setSelectedTask}
        />
      )}
    </div>
  );
}

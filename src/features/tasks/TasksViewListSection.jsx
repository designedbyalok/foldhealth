import { useState, useCallback } from 'react';
import { Badge } from '../../components/Badge/Badge';
import { SectionPagination } from '../../components/SectionPagination/SectionPagination';
import { useAppStore } from '../../store/useAppStore';
import { PROG_TASKS_PER_PAGE, isOverdue } from './TasksView.utils';
import { TaskTableRow } from './TasksViewRows';
import { RingEmptyState } from '../../components/RingEmptyState/RingEmptyState';
import { WorklistShell } from '../../components/WorklistShell/WorklistShell';
import styles from './TasksView.module.css';

// Column widths carried over from the grid this table replaced (.colCheck 48,
// .colTask min 260, .colP 60, .colStatus 110, .colDue 130, .colAssigned 200,
// .colMember 210, Labels 160 in this embedded context, .colActions 48).
// Task Title (+ its check) pins left and Actions pins right, matching the old
// pinLeft0 / pinLeftCheck / pinRight0 behaviour.
const progTaskColumns = ({ hideAssignedTo, hideMember, countInTitle }) => [
  { key: 'check', label: '', width: 48, sticky: 'left', left: 0 },
  { key: 'task', label: countInTitle ? 'Task Title' : 'Tasks', width: 300, sticky: 'left', left: 48 },
  { key: 'p', label: 'P', width: 60, align: 'center' },
  { key: 'status', label: 'Status', width: 110 },
  { key: 'due', label: 'Due Date', width: 130 },
  ...(hideAssignedTo ? [] : [{ key: 'assigned', label: 'Assigned To', width: 200 }]),
  ...(hideMember ? [] : [{ key: 'member', label: 'Member', width: 210 }]),
  { key: 'labels', label: 'Labels', width: 160 },
  { key: 'actions', label: '', width: 48, sticky: 'right' },
];

/**
 * ProgramTaskSection: one "Open"/"Completed" section: a title, then the shared
 * Tasks table in a WorklistShell, with the Task Title (+ check) pinned left and
 * the action column pinned right. Reuses TaskTableRow so rows look exactly like
 * the Tasks module. When the section has no tasks it shows the ring empty state
 * instead of the table.
 */
// `countInTitle` is the P360 Tasks tab heading (Figma P360 Revamp 2223:310922):
// "Pending (4)" with no count badge, and a "Task Title" column.
export function ProgramTaskSection({ title, tasks, onToggle, onTaskClick, hideAssignedTo, hideMember, emptyLabel, countInTitle }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(tasks.length / PROG_TASKS_PER_PAGE));
  // Clamp if the list shrank (e.g. a task moved sections) so we never land on
  // an empty page.
  const safePage = Math.min(page, totalPages);
  const pageTasks = tasks.slice((safePage - 1) * PROG_TASKS_PER_PAGE, safePage * PROG_TASKS_PER_PAGE);

  return (
    <div className={styles.progSection}>
      {countInTitle ? (
        <div className={styles.progSectionHeadPlain}>{title} ({tasks.length})</div>
      ) : (
        <div className={styles.progSectionHead}>
          <span className={styles.progSectionTitle}>{title}</span>
          <Badge variant="overflow" label={`${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}`} />
        </div>
      )}
      {tasks.length === 0 ? (
        <div className={styles.progEmpty}>
          <RingEmptyState icon="solar:checklist-minimalistic-linear" label={emptyLabel || 'No Tasks Added'} />
        </div>
      ) : (
        <>
          <WorklistShell
            embedded
            header={null}
            columns={progTaskColumns({ hideAssignedTo, hideMember, countInTitle })}
            rows={pageTasks}
            minTableWidth={hideMember ? 1032 : 1242}
            renderRow={t => (
              <TaskTableRow
                key={t.id}
                task={t}
                onToggle={onToggle}
                onTaskClick={onTaskClick}
                hideAssignedTo={hideAssignedTo}
                hideMember={hideMember}
              />
            )}
          />
          {tasks.length > PROG_TASKS_PER_PAGE && (
            <SectionPagination
              page={safePage}
              perPage={PROG_TASKS_PER_PAGE}
              total={tasks.length}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
}

/**
 * TaskListSection: Open / Completed sections built from the shared Tasks
 * TaskRow, for embedding outside the full Tasks page (e.g. a care program).
 * "Open" = anything not completed. Both sections always render (each shows its
 * own empty state when it has no tasks).
 * Toggling completion updates the shared task store. Pass `hideMember` when
 * already in a member context.
 */
export function TaskListSection({ tasks = [], onTaskClick, hideAssignedTo = false, hideMember = false, byDueStatus = false }) {
  const updateTask = useAppStore(s => s.updateTask);
  const handleToggle = useCallback((task) => {
    updateTask(task.id, { status: task.status === 'completed' ? 'pending' : 'completed' });
  }, [updateTask]);

  const open = tasks.filter(t => t.status !== 'completed');
  const completed = tasks.filter(t => t.status === 'completed');

  // P360 Tasks tab: Pending / Overdue / Completed, showing only the sections
  // that have tasks.
  if (byDueStatus) {
    const overdue = open.filter(isOverdue);
    const sections = [
      { title: 'Pending', tasks: open.filter(t => !isOverdue(t)) },
      { title: 'Overdue', tasks: overdue },
      { title: 'Completed', tasks: completed },
    ].filter(sec => sec.tasks.length > 0);
    if (!sections.length) {
      return (
        <div className={styles.progEmpty}>
          <RingEmptyState icon="solar:checklist-minimalistic-linear" label="No Tasks Added" />
        </div>
      );
    }
    return sections.map(sec => (
      <ProgramTaskSection
        key={sec.title}
        title={sec.title}
        tasks={sec.tasks}
        onToggle={handleToggle}
        onTaskClick={onTaskClick}
        hideAssignedTo={hideAssignedTo}
        hideMember={hideMember}
        countInTitle
      />
    ));
  }

  return (
    <>
      <ProgramTaskSection
        title="Open"
        tasks={open}
        onToggle={handleToggle}
        onTaskClick={onTaskClick}
        hideAssignedTo={hideAssignedTo}
        hideMember={hideMember}
        emptyLabel="No Open Tasks"
      />
      <ProgramTaskSection
        title="Completed"
        tasks={completed}
        onToggle={handleToggle}
        onTaskClick={onTaskClick}
        hideAssignedTo={hideAssignedTo}
        hideMember={hideMember}
        emptyLabel="No Completed Tasks"
      />
    </>
  );
}



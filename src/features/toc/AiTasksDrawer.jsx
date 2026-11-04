import { useEffect, useMemo, useState } from 'react';
import { Drawer } from '../../components/Drawer/Drawer';
import { PatientBanner } from '../../components/PatientBanner/PatientBanner';
import { SectionTitleBar } from '../../components/SectionTitleBar/SectionTitleBar';
import { FilterBar } from '../worklists/FilterBar';
import { useAppStore } from '../../store/useAppStore';
import { TasksTab } from '../patient/left-panel/tabs/tasks/TasksTab/TasksTab';
import { AddTaskDrawer } from '../patient/left-panel/tabs/outreach/AddTaskDrawer/AddTaskDrawer';
import { TaskDetailDrawer } from '../tasks/TaskDetailDrawer';
import { buildAiTocTasks, toTaskPreview } from './aiTocTasks';
import styles from './AiTasksDrawer.module.css';

const EMPTY_FILTERS = { status: [], priority: [], dueDate: [] };
const EMPTY_GROUPS = { pending: [], overdue: [], completed: [] };
const PRIORITY_LABEL = { high: 'High', medium: 'Medium', low: 'Low' };

function capPriority(p) {
  return PRIORITY_LABEL[p] || p;
}

function matchesFilters(task, section, filters, query) {
  if (query && !(task.title || '').toLowerCase().includes(query)) return false;
  if (filters.status.length && !filters.status.includes(section)) return false;
  if (filters.priority.length && !filters.priority.includes(capPriority(task.priority))) return false;
  if (filters.dueDate.length && !filters.dueDate.includes(task.due)) return false;
  return true;
}

/**
 * TOC worklist AI Tasks drawer: PatientBanner + a flush SectionTitleBar,
 * then the profile Tasks tab list. Tasks persist to Supabase per patient.
 */
export function AiTasksDrawer() {
  const patientId = useAppStore(s => s.aiTasksDrawerPatientId);
  const close = useAppStore(s => s.closeAiTasksDrawer);
  const patients = useAppStore(s => s.patients);
  const ensureAiTocTasksForPatient = useAppStore(s => s.ensureAiTocTasksForPatient);
  const updateTask = useAppStore(s => s.updateTask);
  const patient = useMemo(
    () => patients.find(p => p.id === patientId) || null,
    [patients, patientId],
  );

  const [taskGroups, setTaskGroups] = useState(EMPTY_GROUPS);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [added, setAdded] = useState([]);
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const storeTasks = useAppStore(s => s.tasks);
  const stored = selectedTask
    ? storeTasks.find(t => String(t.id) === String(selectedTask.id))
    : null;
  const liveSelected = selectedTask
    ? { ...selectedTask, ...(stored || {}), created_by: selectedTask.created_by || stored?.created_by }
    : null;

  useEffect(() => {
    if (!patient) {
      setTaskGroups(EMPTY_GROUPS);
      return undefined;
    }
    let active = true;
    setTasksLoading(true);
    ensureAiTocTasksForPatient(patient)
      .then((groups) => { if (active) setTaskGroups(groups); })
      .catch(() => { if (active) setTaskGroups(buildAiTocTasks(patient)); })
      .finally(() => { if (active) setTasksLoading(false); });
    return () => { active = false; };
  }, [patient, ensureAiTocTasksForPatient]);

  const allTasks = useMemo(() => ({
    pending: [...taskGroups.pending, ...added],
    overdue: taskGroups.overdue,
    completed: taskGroups.completed,
  }), [taskGroups, added]);

  const query = search.trim().toLowerCase();
  const shown = useMemo(() => {
    const pending = allTasks.pending.filter(t =>
      t.status !== 'completed' && matchesFilters(t, 'Pending', filters, query));
    const overdue = allTasks.overdue.filter(t =>
      t.status !== 'completed' && matchesFilters(t, 'Overdue', filters, query));
    const completed = allTasks.completed.filter(t =>
      matchesFilters(t, 'Completed', filters, query));
    return { pending, overdue, completed };
  }, [allTasks, filters, query]);

  const dueOptions = useMemo(() => {
    const dates = [...allTasks.pending, ...allTasks.overdue, ...allTasks.completed]
      .map(t => t.due)
      .filter(Boolean);
    return [...new Set(dates)];
  }, [allTasks]);

  const filterDefs = useMemo(() => [
    { key: 'status', label: 'Status', options: ['Pending', 'Overdue', 'Completed'], primary: true },
    { key: 'priority', label: 'Priority', options: ['High', 'Medium', 'Low'], primary: true },
    { key: 'dueDate', label: 'Due Date', options: dueOptions, primary: true },
  ], [dueOptions]);

  const filterBadgeCount = Object.values(filters).filter(v => v.length).length;

  const refreshTasks = async () => {
    if (!patient) return;
    const groups = await ensureAiTocTasksForPatient(patient);
    setTaskGroups(groups);
  };

  const toggleComplete = async (id) => {
    const row = [...allTasks.pending, ...allTasks.overdue, ...allTasks.completed].find(t => t.id === id);
    const nextStatus = row?.status === 'completed' ? 'pending' : 'completed';
    await updateTask(id, { status: nextStatus });
    await refreshTasks();
  };

  if (!patient) return null;

  return (
    <>
      <Drawer
        title="AI Tasks"
        onClose={close}
        titleStyle={{ color: 'var(--neutral-500)' }}
        bodyClassName={styles.drawerBody}
        banner={
          <PatientBanner
            initials={patient.initials}
            name={patient.name}
            gender={patient.gender}
            age={patient.age}
            memberId={patient.memberId}
          />
        }
      >
        <SectionTitleBar
          variant="titleOnly"
          title="Internal Tasks"
          actions={['search', 'filter']}
          searchPlaceholder="Search tasks"
          searchValue={search}
          onSearchChange={setSearch}
          filterActive={filtersOpen}
          filterBadgeCount={filterBadgeCount}
          onFilter={() => setFiltersOpen(v => !v)}
          primaryActionLabel="Add Task"
          onPrimaryAction={() => setAddOpen(true)}
        />
        {filtersOpen && (
          <FilterBar
            leading={null}
            filterDefs={filterDefs}
            filters={filters}
            onFilterChange={(key, next) => setFilters(f => ({ ...f, [key]: next || [] }))}
            onClearAll={() => setFilters(EMPTY_FILTERS)}
            getOptions={(def) => def.options || []}
            multiSelect
            showMoreFilters={false}
            showSaveFilter={false}
          />
        )}
        <div className={styles.list}>
          {tasksLoading ? (
            <div className={styles.loading}>Loading tasks…</div>
          ) : (
            <TasksTab
              data={shown}
              hideToolbar
              completedIds={new Set()}
              onToggle={toggleComplete}
              onTaskClick={(task, flags) => {
                setSelectedTask(toTaskPreview(task, patient, flags));
              }}
            />
          )}
        </div>
      </Drawer>
      {addOpen && (
        <AddTaskDrawer
          onClose={() => setAddOpen(false)}
          onSave={(task) => setAdded(prev => [...prev, task])}
        />
      )}
      {liveSelected && (
        <TaskDetailDrawer
          task={liveSelected}
          onClose={() => setSelectedTask(null)}
          onSelectTask={setSelectedTask}
        />
      )}
    </>
  );
}

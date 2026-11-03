import { useEffect, useMemo, useState } from 'react';
import { ActionButton } from '../../../../../../components/ActionButton/ActionButton';
import { Button } from '../../../../../../components/Button/Button';
import { SearchBar } from '../../../../../../components/SearchBar/SearchBar';
import { FilterChip } from '../../../../../../components/FilterChip/FilterChip';
import { Link } from '../../../../../../components/Link/Link';
import { AddIconMinimalist } from '../../../../../../components/Icon/AddIconMinimalist';
import { TaskListSection, TaskDetailDrawer, AddTaskDrawer } from '../../../../../tasks/TasksView';
import { useAppStore } from '../../../../../../store/useAppStore';
import styles from './PatientTasksTab.module.css';

const SCOPES = ['My Tasks', "Patient's Task"];
const STATUS_LABEL = { pending: 'Pending', missed: 'Missed', completed: 'Completed' };
const EMPTY_FILTERS = { status: [], priority: [], dueDate: [], completedDate: [] };
const cap = (s = '') => s.charAt(0).toUpperCase() + s.slice(1);
const fmtCompleted = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
};

/**
 * The patient's Tasks tab, built like Care Management's Program Related
 * Tasks: the shared task rows (Open / Completed) read live from the task
 * store, with search, Add Task, filter chips and the Task Details drawer.
 * "My Tasks" narrows it to tasks assigned to the signed-in user.
 */
export function PatientTasksTab({ patient }) {
  const globalTasks = useAppStore(s => s.tasks);
  const fetchTasks = useAppStore(s => s.fetchTasks);
  const me = useAppStore(s => s.currentUserProfile);
  useEffect(() => { fetchTasks?.(); }, [fetchTasks]);

  const [scope, setScope] = useState(SCOPES[0]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  // Tasks are linked to a patient by store id, member id, or (older rows) name.
  const patientTasks = useMemo(() => {
    if (!patient) return [];
    const ids = new Set([patient.id, patient.memberId].filter(v => v != null).map(String));
    const parents = (globalTasks || []).filter(t => !t.is_subtask
      && (ids.has(String(t.patient_id)) || (patient.name && t.member === patient.name)));
    const parentIds = new Set(parents.map(t => t.id));
    const subtasks = (globalTasks || []).filter(t => t.is_subtask && parentIds.has(t.parent_task_id));
    return [...parents, ...subtasks];
  }, [globalTasks, patient]);

  const scoped = useMemo(() => (scope === 'My Tasks'
    ? patientTasks.filter(t => (me?.id && String(t.assigned_to_id) === String(me.id)) || (me?.name && t.assigned_to === me.name))
    : patientTasks), [patientTasks, scope, me]);

  const filterMeta = useMemo(() => ([
    { key: 'status', label: 'Status', options: [...new Set(scoped.flatMap(t => STATUS_LABEL[t.status] ? [STATUS_LABEL[t.status]] : []))] },
    { key: 'priority', label: 'Priority', options: [...new Set(scoped.flatMap(t => { const v = cap(t.priority); return v ? [v] : []; }))] },
    { key: 'dueDate', label: 'Due Date', options: [...new Set(scoped.flatMap(t => t.due_date ? [t.due_date] : []))] },
    { key: 'completedDate', label: 'Completed Date', options: [...new Set(scoped.flatMap(t => { const v = fmtCompleted(t.completed_at); return v ? [v] : []; }))] },
  ]), [scoped]);
  const filtersActive = Object.values(filters).some(v => v.length > 0);

  const q = search.trim().toLowerCase();
  const shown = useMemo(() => {
    const sets = Object.fromEntries(Object.entries(filters).map(([k, v]) => [k, v.length ? new Set(v) : null]));
    return scoped.filter(t =>
      (!q || (t.name || '').toLowerCase().includes(q))
      && (!sets.status || sets.status.has(STATUS_LABEL[t.status]))
      && (!sets.priority || sets.priority.has(cap(t.priority)))
      && (!sets.dueDate || sets.dueDate.has(t.due_date))
      && (!sets.completedDate || sets.completedDate.has(fmtCompleted(t.completed_at))));
  }, [scoped, filters, q]);

  const liveSelected = selectedTask && ((globalTasks || []).find(t => t.id === selectedTask.id) || selectedTask);

  return (
    <div className={styles.tab}>
      <div className={styles.toolbar}>
        <div className={styles.scopeTabs}>
          {SCOPES.map(s => (
            <button
              key={s}
              type="button"
              className={`${styles.scopeTab} ${scope === s ? styles.scopeTabActive : ''}`}
              onClick={() => setScope(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <div className={styles.toolbarActions}>
          {searchOpen ? (
            <SearchBar
              className={styles.search}
              placeholder="Search tasks"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onClose={() => { setSearchOpen(false); setSearch(''); }}
            />
          ) : (
            <ActionButton icon="solar:magnifer-linear" size="sm" tooltip="Search" onClick={() => setSearchOpen(true)} />
          )}
          <span className={styles.divider} />
          <Button variant="soft" leadingIconElement={<AddIconMinimalist size={16} />} onClick={() => setAddOpen(true)}>Add Task</Button>
          <span className={styles.divider} />
          <ActionButton
            icon="solar:filter-linear"
            size="sm"
            tooltip="Filter"
            active={filtersOpen}
            iconColor={filtersOpen ? 'var(--primary-300)' : undefined}
            onClick={() => setFiltersOpen(v => !v)}
          />
        </div>
      </div>

      {filtersOpen && (
        <div className={styles.filterBar}>
          {filterMeta.map(f => (
            <FilterChip
              key={f.key}
              label={f.label}
              options={f.options}
              selected={filters[f.key]}
              onChange={vals => setFilters(prev => ({ ...prev, [f.key]: vals }))}
            />
          ))}
          {filtersActive && <Link onClick={() => setFilters(EMPTY_FILTERS)}>Clear All</Link>}
        </div>
      )}

      <div className={styles.list}>
        <TaskListSection tasks={shown} hideMember byDueStatus onTaskClick={setSelectedTask} />
      </div>

      {liveSelected && (
        <TaskDetailDrawer task={liveSelected} onClose={() => setSelectedTask(null)} onSelectTask={setSelectedTask} />
      )}
      {addOpen && (
        <AddTaskDrawer
          onClose={() => setAddOpen(false)}
          initialMember={patient?.name}
          extraFields={{ patient_id: patient?.id != null ? String(patient.id) : null }}
          onTaskCreated={() => setAddOpen(false)}
        />
      )}
    </div>
  );
}

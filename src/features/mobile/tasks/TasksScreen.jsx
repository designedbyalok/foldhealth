import { useState } from 'react';
import { SegmentedControl } from '../../../components/SegmentedControl/SegmentedControl';
import { Icon } from '../../../components/Icon/Icon';
import { MobileSubHeader } from '../MobileHeader';
import { MobileEmpty, MobileListSkeleton, CountBadge } from '../MobileParts';
import { useMobileNav } from '../MobileNavContext';
import { useMyTasks } from './myTasks';
import { TaskRow } from './TaskRow';
import styles from '../mobile.module.css';

const FILTERS = [
  { key: 'overdue', label: 'Overdue', match: t => t.bucket === 'overdue' },
  { key: 'today', label: 'Today', match: t => t.bucket === 'today' },
  { key: 'upcoming', label: 'Upcoming', match: t => t.bucket === 'upcoming' || t.bucket === 'none' },
  { key: 'done', label: 'Done', match: t => t.bucket === 'done' },
];

/** My tasks by when they're due (Figma Tasks 759:22072). */
export function TasksScreen({ filter: initial = 'overdue' }) {
  const { openMember, push } = useMobileNav();
  const { tasks, loading } = useMyTasks();
  const [filter, setFilter] = useState(initial);
  const current = FILTERS.find(f => f.key === filter) || FILTERS[0];
  const shown = tasks.filter(current.match);

  return (
    <div className={styles.screen}>
      <MobileSubHeader title="My Tasks" />
      <div className={`${styles.toolbar} ${styles.toolbarTop}`}>
        <SegmentedControl
          size="lg"
          aria-label="Which tasks"
          value={filter}
          onValueChange={setFilter}
          items={FILTERS.map(f => {
            const n = f.key === 'done' ? 0 : tasks.filter(f.match).length;
            return { key: f.key, label: <>{f.label} <CountBadge value={f.key === 'overdue' ? n : 0} /></> };
          })}
        />
      </div>
      <div className={styles.bodyWrap}>
        <div className={styles.body}>
          {loading && !tasks.length ? <MobileListSkeleton height={96} /> : shown.length === 0 ? (
            <MobileEmpty icon="solar:checklist-minimalistic-linear" title={`No ${current.label.toLowerCase()} tasks`} />
          ) : (
            <div className={styles.list}>
              {shown.map(t => <TaskRow key={t.id} task={t} onOpenMember={(task) => openMember({ name: task.member })} />)}
            </div>
          )}
        </div>
        <button type="button" className={styles.fab} aria-label="Add task" onClick={() => push('addTask')}>
          <Icon name="solar:add-circle-linear" size={32} color="currentColor" />
        </button>
      </div>
    </div>
  );
}

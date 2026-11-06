import { useState } from 'react';
import { BottomSheet } from '../../../components/BottomSheet/BottomSheet';
import { SegmentedControl } from '../../../components/SegmentedControl/SegmentedControl';
import { Icon } from '../../../components/Icon/Icon';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import { MobileSubHeader } from '../MobileHeader';
import { MobileEmpty, MobileListSkeleton, CountBadge } from '../MobileParts';
import { useMobileNav } from '../MobileNavContext';
import { TASK_SCOPES, useMyTasks } from './myTasks';
import { ChoiceList } from './ChoiceList';
import { TaskRow } from './TaskRow';
import common from '../mobile.module.css';
import styles from './TasksScreen.module.css';

const FILTERS = [
  { key: 'overdue', label: 'Overdue', match: t => t.bucket === 'overdue' },
  { key: 'today', label: 'Today', match: t => t.bucket === 'today' },
  { key: 'upcoming', label: 'Upcoming', match: t => t.bucket === 'upcoming' || t.bucket === 'none' },
  { key: 'done', label: 'Done', match: t => t.bucket === 'done' },
];

const EMPTY = {
  assigned: 'tasks',
  pool: 'pool tasks to claim',
  mentions: 'tasks mentioning you',
  created: 'tasks you created',
};

/**
 * Tasks by when they're due (Figma Tasks 759:22072), in the desktop tabs:
 * My Tasks, Task Pool, Mentions, Created by Me (picked from the title).
 * Pool tasks carry a Claim button (claimTask, as the desktop drawer).
 */
export function TasksScreen({ filter: initial = 'overdue', scope: initialScope = 'assigned' }) {
  const { openMember, push } = useMobileNav();
  const [scope, setScope] = useState(initialScope);
  const [picking, setPicking] = useState(false);
  const { tasks, loading, counts } = useMyTasks(scope);
  const claimTask = useAppStore(s => s.claimTask);
  const [filter, setFilter] = useState(initial);
  const current = FILTERS.find(f => f.key === filter) || FILTERS[0];
  const currentScope = TASK_SCOPES.find(s => s.key === scope) || TASK_SCOPES[0];
  const shown = tasks.filter(current.match);

  const claim = async (task) => {
    const ok = await claimTask(task.id);
    if (ok) toast.success('Task claimed');
    else toast.error('Could not claim the task.');
  };

  return (
    <div className={common.screen}>
      <MobileSubHeader>
        <h1 className={common.subTitle}>
          <button type="button" className={styles.scopeBtn} aria-haspopup="dialog" onClick={() => setPicking(true)}>
            <span className={styles.scopeLabel}>{currentScope.label}</span>
            <Icon name="solar:alt-arrow-down-linear" size={24} color="currentColor" />
          </button>
        </h1>
      </MobileSubHeader>
      <div className={`${common.toolbar} ${common.toolbarTop}`}>
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
      <div className={common.bodyWrap}>
        <div className={common.body}>
          {loading && !tasks.length ? <MobileListSkeleton height={96} /> : shown.length === 0 ? (
            <MobileEmpty icon="solar:checklist-minimalistic-linear" title={`No ${current.label.toLowerCase()} ${EMPTY[scope]}`} />
          ) : (
            <div className={common.list}>
              {shown.map(t => (
                <TaskRow
                  key={t.id}
                  task={t}
                  onOpenMember={(task) => openMember({ name: task.member })}
                  onClaim={scope === 'pool' ? claim : undefined}
                />
              ))}
            </div>
          )}
        </div>
        <button type="button" className={common.fab} aria-label="Add task" onClick={() => push('addTask')}>
          <Icon name="solar:add-circle-linear" size={32} color="currentColor" />
        </button>
      </div>

      {picking && (
        <BottomSheet title="Show" onClose={() => setPicking(false)}>
          <ChoiceList
            label="Show"
            options={TASK_SCOPES.map(s => ({ key: s.key, label: s.label, detail: counts[s.key] || null }))}
            value={scope}
            onPick={(key) => { setScope(key); setPicking(false); }}
          />
        </BottomSheet>
      )}
    </div>
  );
}

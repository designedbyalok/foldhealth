import { useState, useEffect } from 'react';
import { Icon } from '../../components/Icon/Icon';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Badge } from '../../components/Badge/Badge';
import { STATUS_LABELS, PAGE_SIZE } from './TasksView.utils';
import { TaskRow } from './TasksViewRows';
import styles from './TasksView.module.css';

export function StatusGroup({ status, label: labelProp, tasks, onToggle, onTaskClick, hideAssignedTo, hideMember, onAddTask }) {
  const [collapsed, setCollapsed] = useState(false);
  const [page, setPage] = useState(0);
  const label = labelProp || STATUS_LABELS[status];
  const totalPages = Math.max(1, Math.ceil(tasks.length / PAGE_SIZE));
  // Reset to a valid page when the task list shrinks/grows past current page
  useEffect(() => {
    if (page >= totalPages) setPage(Math.max(0, totalPages - 1));
  }, [totalPages, page]);
  const paginated = tasks.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className={styles.statusGroup}>
      <div className={styles.groupHeader} onClick={() => setCollapsed(v => !v)}>
        <div className={styles.groupHeaderLeft}>
          <span className={styles.groupTitle}>{label}</span>
          <Badge variant="overflow" label={`${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}`} />
        </div>
        {/* tooltipLeft: these sit at the scroll container's right edge —
            a right-opening tooltip bubble extends scrollWidth past the
            container and produces a phantom horizontal scrollbar. */}
        <div className={styles.groupActions}>
          <ActionButton
            icon="solar:add-circle-linear"
            size="S"
            tooltip="Add task"
            tooltipLeft
            onClick={e => { e.stopPropagation(); onAddTask?.(status); }}
          />
          <div style={{ width: 0.5, height: 16, background: 'var(--neutral-150)' }} />
          <ActionButton
            icon={collapsed ? 'solar:alt-arrow-down-linear' : 'solar:alt-arrow-up-linear'}
            size="S"
            tooltip={collapsed ? 'Expand' : 'Collapse'}
            tooltipLeft
            onClick={e => { e.stopPropagation(); setCollapsed(v => !v); }}
          />
        </div>
      </div>
      {!collapsed && (
        <>
          {paginated.map(t => <TaskRow key={t.id} task={t} onToggle={onToggle} onTaskClick={onTaskClick} hideAssignedTo={hideAssignedTo} hideMember={hideMember} />)}
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button className={styles.pageBtn} disabled={page === 0} onClick={() => setPage(p => p - 1)} aria-label="Previous page">
                <Icon name="solar:alt-arrow-left-linear" size={14} />
              </button>
              <span className={styles.pageInfo}>{page + 1} / {totalPages}</span>
              <button className={styles.pageBtn} disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} aria-label="Next page">
                <Icon name="solar:alt-arrow-right-linear" size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}


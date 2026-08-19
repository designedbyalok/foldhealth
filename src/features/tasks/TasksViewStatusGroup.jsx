import { useState, Fragment } from 'react';
import { Icon } from '../../components/Icon/Icon';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Badge } from '../../components/Badge/Badge';
import { STATUS_LABELS, PAGE_SIZE } from './TasksView.utils';
import { TaskRow, TaskTableRow } from './TasksViewRows';
import styles from './TasksView.module.css';

export function StatusGroup({ status, label: labelProp, tasks, onToggle, onTaskClick, hideAssignedTo, hideMember, onAddTask }) {
  const [collapsed, setCollapsed] = useState(false);
  const [page, setPage] = useState(0);
  const label = labelProp || STATUS_LABELS[status];
  const totalPages = Math.max(1, Math.ceil(tasks.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paginated = tasks.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  return (
    <div className={styles.statusGroup}>
      <div className={styles.groupHeader} onClick={() => setCollapsed(v => !v)}>
        <div className={styles.groupHeaderLeft}>
          <span className={styles.groupTitle}>{label}</span>
          <Badge variant="overflow" label={`${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}`} />
        </div>
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
              <button className={styles.pageBtn} disabled={safePage === 0} onClick={() => setPage(safePage - 1)} aria-label="Previous page">
                <Icon name="solar:alt-arrow-left-linear" size={14} />
              </button>
              <span className={styles.pageInfo}>{safePage + 1} / {totalPages}</span>
              <button className={styles.pageBtn} disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)} aria-label="Next page">
                <Icon name="solar:alt-arrow-right-linear" size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function StatusGroupRows({ group, colCount, onToggle, onTaskClick, hideAssignedTo, onAddTask }) {
  const [collapsed, setCollapsed] = useState(false);
  const [page, setPage] = useState(0);
  const { status, tasks } = group;
  const label = group.label || STATUS_LABELS[status];
  const totalPages = Math.max(1, Math.ceil(tasks.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paginated = tasks.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  return (
    <Fragment>
      <tr className={styles.groupHeaderTr} onClick={() => setCollapsed(v => !v)}>
        <td className={styles.groupHeaderTd} colSpan={colCount}>
          <div className={styles.groupHeaderInner}>
            <div className={styles.groupHeaderLeft}>
              <span className={styles.groupTitle}>{label}</span>
              <Badge variant="overflow" label={`${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}`} />
            </div>
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
        </td>
      </tr>
      {!collapsed && (
        <>
          {paginated.map(t => (
            <TaskTableRow key={t.id} task={t} onToggle={onToggle} onTaskClick={onTaskClick} hideAssignedTo={hideAssignedTo} />
          ))}
          {totalPages > 1 && (
            <tr>
              <td className={styles.groupPaginationTd} colSpan={colCount}>
                <div className={styles.pagination}>
                  <button className={styles.pageBtn} disabled={safePage === 0} onClick={() => setPage(safePage - 1)} aria-label="Previous page">
                    <Icon name="solar:alt-arrow-left-linear" size={14} />
                  </button>
                  <span className={styles.pageInfo}>{safePage + 1} / {totalPages}</span>
                  <button className={styles.pageBtn} disabled={safePage >= totalPages - 1} onClick={() => setPage(safePage + 1)} aria-label="Next page">
                    <Icon name="solar:alt-arrow-right-linear" size={14} />
                  </button>
                </div>
              </td>
            </tr>
          )}
        </>
      )}
    </Fragment>
  );
}


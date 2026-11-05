import { useState } from 'react';
import { Avatar } from '../../../components/Avatar/Avatar';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { HeaderCell } from '../../../components/HeaderCell/HeaderCell';
import { MenuPopover } from '../../../components/MenuPopover/MenuPopover';
import { Pagination } from '../../../components/Pagination/Pagination';
import { EmptyState } from '../../../components/EmptyState/EmptyState';
import { useAppStore } from '../../../store/useAppStore';
import { initialsOf, fmtDateTime, memberStatusDef, RETRY_HINT } from './analyticsUi';
import styles from './Analytics.module.css';

/** Avatar initials, name and when the member ran. */
export function MemberCell({ name, at }) {
  return (
    <span className={styles.memberCell}>
      <Avatar variant="patient" size="M" initials={initialsOf(name)} />
      <span className={styles.memberText}>
        <span className={styles.memberName}>{name || 'Unknown member'}</span>
        {at && <span className={styles.memberMeta}>{fmtDateTime(at)}</span>}
      </span>
    </span>
  );
}

/**
 * Row kebab: View patient profile, Create task and, for members who failed
 * or are still waiting, Retry automation.
 */
export function MemberRowMenu({ member, patientId, patientName }) {
  const [rect, setRect] = useState(null);
  const navigateToPatient = useAppStore(s => s.navigateToPatient);
  const requestAddTask = useAppStore(s => s.requestAddTask);
  const retryAutomationMember = useAppStore(s => s.retryAutomationMember);
  const showToast = useAppStore(s => s.showToast);
  const canRetry = member && member.status !== 'completed';
  const items = [
    { key: 'profile', icon: 'solar:user-id-linear', label: 'View patient profile' },
    { key: 'task', icon: 'solar:checklist-minimalistic-linear', label: 'Create task' },
    ...(canRetry ? [{ key: 'retry', icon: 'solar:restart-linear', label: 'Retry automation', hint: RETRY_HINT }] : []),
  ];
  const onSelect = async (key) => {
    if (key === 'profile') navigateToPatient(patientId);
    else if (key === 'task') requestAddTask({ member: patientName, source: 'automations' });
    else if (key === 'retry') {
      const next = await retryAutomationMember(member, 'retry');
      if (next) showToast?.(`Retried for ${patientName}: ${memberStatusDef(next.status).label.toLowerCase()}`);
      else showToast?.('Could not retry the automation');
    }
  };
  return (
    <span className={styles.rowActions} onClick={e => e.stopPropagation()}>
      <ActionButton
        icon="solar:menu-dots-linear"
        size="sm"
        tooltip="More"
        aria-label={`Actions for ${patientName}`}
        onClick={e => setRect(e.currentTarget.getBoundingClientRect())}
      />
      {rect && (
        <MenuPopover
          anchorRect={rect}
          align="right"
          width={200}
          ariaLabel={`Actions for ${patientName}`}
          items={items}
          onSelect={onSelect}
          onClose={() => setRect(null)}
        />
      )}
    </span>
  );
}

/**
 * The drawers' member table: sortable headers, clickable rows (open the
 * member trace), a kebab per row and 10-per-page pagination.
 * columns: [{ key, label, sortField?, sortType?, render(row), className? }]
 */
export function MemberTable({ columns, rows, sortKey, sortDir, onSort, onRowClick, renderMenu, emptyLabel, page, perPage, onPage, onPerPage }) {
  if (!rows.length) {
    return (
      <div className={styles.tableEmpty}>
        <EmptyState icon="solar:users-group-rounded-linear" title={emptyLabel} size="sm" />
      </div>
    );
  }
  const start = (page - 1) * perPage;
  const visible = rows.slice(start, start + perPage);
  return (
    <>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map(c => (
              <HeaderCell key={c.key} label={c.label} sortField={c.sortField} sortType={c.sortType} activeKey={sortKey} activeDir={sortDir} onSort={onSort} className={c.className} />
            ))}
            <th className={styles.actionsHead} aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {visible.map(r => (
            <tr key={r.id} className={styles.row} onClick={() => onRowClick(r)}>
              {columns.map(c => <td key={c.key} className={c.className}>{c.render(r)}</td>)}
              <td className={styles.actionsCell}>{renderMenu(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > perPage && (
        <div className={styles.pagination}>
          <Pagination totalItems={rows.length} currentPage={page} perPage={perPage} onPageChange={onPage} onPerPageChange={onPerPage} />
        </div>
      )}
    </>
  );
}

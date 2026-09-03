import { useEffect } from 'react';
import { DownChevronIcon } from '../../../../../../components/Icon/DownChevronIcon';
import { ActionButton } from '../../../../../../components/ActionButton/ActionButton';
import { Checkbox } from '../../../../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { WorklistShell } from '../../../../../../components/WorklistShell/WorklistShell';
import { AssigneeChange } from '../../../../../../components/AssigneeChange/AssigneeChange';
import { useAppStore } from '../../../../../../store/useAppStore';
import { ProgramStatusRing } from '../program-detail/shared/ProgramStatusRing/ProgramStatusRing.jsx';
import { stepProgress } from './CareProgramsTab.utils';
import styles from './CareProgramsTab.module.css';

const initialsOf = (name) => (name || '').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

// Column widths carried over from the hand-rolled <table> this replaced.
const PROGRAM_COLUMNS = [
  { key: 'select', label: '', showCheckbox: true, width: 28 },
  { key: 'name', label: 'Program Name', width: 280 },
  { key: 'status', label: 'Status', width: 150 },
  { key: 'startDate', label: 'Start Date', width: 130 },
  { key: 'endDate', label: 'End Date', width: 130 },
  { key: 'lastUpdated', label: 'Last Updated', width: 130 },
  { key: 'assignee', label: 'Assignee', width: 170 },
  { key: 'pcp', label: 'PCP', width: 180 },
  { key: 'actions', label: '', width: 40 },
];

export function CareProgramsTabTable({
  visible,
  selectedIdSet,
  toggleAll,
  toggleOne,
  openProgram,
  setStatusMenu,
  assignOwner,
  setRowMenu,
  rowMenuId,
}) {
  const platformUsers = useAppStore(s => s.platformUsers);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  useEffect(() => { fetchPlatformUsers?.(); }, [fetchPlatformUsers]);
  return (
    <WorklistShell
      header={null}
      columns={PROGRAM_COLUMNS}
      rows={visible}
      selectedIds={[...selectedIdSet]}
      onSelectAll={toggleAll}
      onClearSelection={() => toggleAll(false)}
      minTableWidth={900}
      renderRow={p => (
            <tr key={p.id} className={styles.clickableRow} onClick={() => openProgram(p)}>
              <td className={styles.checkCell} onClick={e => e.stopPropagation()}>
                <Checkbox
                  checked={selectedIdSet.has(p.id)}
                  onCheckedChange={() => toggleOne(p.id)}
                  aria-label={`Select ${p.name}`}
                />
              </td>
              <td className={styles.programCell}>
                <div className={styles.programName}>
                  <ProgramStatusRing progress={stepProgress(p.code)} size={16} />
                  <div className={styles.nameBlock}>
                    <span className={styles.nameText}>{p.name}</span>
                    {p.acuity && <span className={styles.acuityText}>Acuity : {p.acuity}</span>}
                  </div>
                </div>
              </td>
              <td className={styles.statusCell} onClick={e => e.stopPropagation()}>
                <button
                  className={styles.statusBtn}
                  style={{ color: p.statusColor }}
                  onClick={e => setStatusMenu({ id: p.id, rect: e.currentTarget.getBoundingClientRect() })}
                >
                  {p.status}
                  <DownChevronIcon size={16} color={p.statusColor} />
                </button>
              </td>
              <td className={styles.dateCell}>{p.startDate}</td>
              <td className={styles.dateCell}>{p.endDate}</td>
              <td className={styles.dateCell}>{p.lastUpdated}</td>
              <td className={styles.assigneeCell} data-assign-row={p.id} onClick={e => e.stopPropagation()}>
                <AssigneeChange
                  avatarOnly
                  size="M"
                  name={p.assignee && p.assignee !== 'Unassigned' ? p.assignee : undefined}
                  initials={p.assignee && p.assignee !== 'Unassigned' ? initialsOf(p.assignee) : ''}
                  unassigned={!p.assignee || p.assignee === 'Unassigned'}
                  showRole={false}
                  users={platformUsers}
                  pickerTitle="Assign"
                  onSelect={user => assignOwner(p, user)}
                />
              </td>
              <td className={styles.pcpCell}>{p.pcp}</td>
              <td className={styles.actionsCell} onClick={e => e.stopPropagation()}>
                <ActionButton
                  icon="solar:menu-dots-linear"
                  size="S"
                  tooltip="More actions"
                  tooltipBelow
                  tooltipLeft
                  className={`${styles.rowMenuBtn} ${rowMenuId === p.id ? styles.rowMenuBtnOpen : ''}`}
                  onClick={e => setRowMenu({ id: p.id, rect: e.currentTarget.getBoundingClientRect() })}
                />
              </td>
            </tr>
      )}
    />
  );
}

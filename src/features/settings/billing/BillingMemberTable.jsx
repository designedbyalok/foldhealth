import { WorklistShell } from '../../../components/WorklistShell/WorklistShell';
import { Avatar } from '../../../components/Avatar/Avatar';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { EmptyState } from '../../../components/EmptyState/EmptyState';
import { formatDos, initialsOf, money } from './careProgramBillingData';
import styles from './CareProgramBilling.module.css';

const BASE_COLUMNS = [
  { key: 'member', label: 'Member Name', width: 260 },
  { key: 'ehr', label: 'EHR ID', width: 120 },
  { key: 'dos', label: 'Date of Service', width: 140 },
  { key: 'program', label: 'Program Type', width: 130 },
  { key: 'bill', label: 'Bill', width: 110 },
  { key: 'provider', label: 'Provider', width: 180 },
  { key: 'condition', label: 'Chronic Condition', width: 160 },
  { key: 'time', label: 'Time Spent', width: 120 },
];
const ACTION_COLUMN = { key: 'action', label: 'Action', width: 72, sticky: 'right' };

/**
 * Billed or billable members, one row each (Billable tab and the monthly
 * Billing Report drawer).
 *
 * @param {object[]} props.rows
 * @param {boolean}  [props.loading]
 * @param {function} [props.onView] – (row) => void; adds the Action column
 * @param {boolean}  [props.embedded] – auto-height, inside a drawer
 */
export function BillingMemberTable({ rows, loading, onView, embedded = false }) {
  const columns = onView ? [...BASE_COLUMNS, ACTION_COLUMN] : BASE_COLUMNS;
  const dash = <span className={styles.cellMuted}>-</span>;

  return (
    <div className={`${styles.tableWrap} ${onView ? styles.stickyActions : ''}`}>
      <WorklistShell
        embedded={embedded}
        header={null}
        columns={columns}
        rows={rows}
        loading={loading}
        minTableWidth={columns.reduce((n, c) => n + c.width, 0)}
        emptyState={(
          <div className={styles.empty}>
            <EmptyState icon="solar:bill-list-linear" title="No members match these filters" />
          </div>
        )}
        renderRow={(r) => (
          <tr key={r.id} className={styles.row}>
            <td className={styles.td}>
              <span className={styles.member}>
                <Avatar variant="patient" size="M" initials={initialsOf(r.memberName)} />
                <span>
                  <span className={styles.memberName}>{r.memberName}</span>{' '}
                  <span className={styles.memberMeta}>({r.gender}, {r.age}Y)</span>
                </span>
              </span>
            </td>
            <td className={styles.td}><span className={styles.cellText}>{r.ehrId}</span></td>
            <td className={styles.td}><span className={`${styles.cellText} ${styles.num}`}>{formatDos(r.dateOfService)}</span></td>
            <td className={styles.td}><span className={styles.cellText}>{r.programType}</span></td>
            <td className={styles.td}><span className={`${styles.cellText} ${styles.num}`}>{money(r.bill)}</span></td>
            <td className={styles.td}><span className={styles.cellText}>{r.provider}</span></td>
            <td className={styles.td}>{r.chronicCondition ? <span className={styles.cellText}>{r.chronicCondition}</span> : dash}</td>
            <td className={styles.td}>
              {r.timeSpentMins == null ? dash : <span className={`${styles.cellText} ${styles.num}`}>{r.timeSpentMins} mins</span>}
            </td>
            {onView && (
              <td className={`${styles.td} ${styles.stickyRight} ${styles.actionTd}`}>
                <ActionButton icon="solar:eye-linear" tooltip="View billing details" tooltipLeft onClick={() => onView(r)} />
              </td>
            )}
          </tr>
        )}
      />
    </div>
  );
}

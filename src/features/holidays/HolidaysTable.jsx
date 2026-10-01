import { WorklistShell } from '../../components/WorklistShell/WorklistShell';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { BadgeRow } from '../../components/BadgeRow/BadgeRow';
import { Icon } from '../../components/Icon/Icon';
import { TruncatedText } from '../../components/TruncatedText/TruncatedText';
import { formatDateTime } from '../ooo/oooUtils';
import { isPastHoliday } from './holidayUtils';
import styles from './holidays.module.css';

const COLUMNS = [
  { key: 'name', label: 'Holiday Name', sticky: 'left', left: 0, width: 260 },
  { key: 'start', label: 'Start Date & Time', width: 184 },
  { key: 'end', label: 'End Date & Time', width: 184 },
  { key: 'locations', label: 'Location' },
  { key: 'actions', label: 'Action', sticky: 'right', width: 156 },
];

/**
 * Holidays in the shared WorklistShell table (Figma December-2025
 * 842:14951): name, start, end, locations and Edit / Duplicate / Delete.
 * Past holidays are read-only, so their actions are off (the tooltip says
 * why).
 *
 * @param {object}   props
 * @param {object[]} props.holidays
 * @param {boolean}  [props.loading]
 * @param {boolean}  [props.embedded]   – Grow with the content inside a scrolling parent
 * @param {React.ReactNode} props.emptyState
 * @param {object}   [props.pagination]
 * @param {function} props.onEdit       – (holiday) => void
 * @param {function} props.onDuplicate  – (holiday) => void
 * @param {function} props.onDelete     – (holiday) => void
 */
export function HolidaysTable({ holidays, loading, embedded = false, emptyState, pagination, onEdit, onDuplicate, onDelete }) {
  const now = new Date();
  const action = (h, { icon, label, verb, onClick, left }) => {
    const off = isPastHoliday(h, now);
    return (
      <ActionButton
        size="L"
        tooltip={off ? `Past holidays can't be ${verb}` : label}
        tooltipLeft={left}
        state={off ? 'disabled' : 'active'}
        aria-label={`${label} ${h.name}`}
        onClick={() => !off && onClick(h)}
      >
        <Icon name={icon} size={16} color={off ? 'var(--neutral-150)' : 'var(--neutral-300)'} />
      </ActionButton>
    );
  };
  const renderRow = (h) => (
    <tr key={h.id} className={styles.row}>
      <td className={`${styles.membersTd} ${styles.stickyLeft}`} style={{ left: 0 }}>
        <TruncatedText text={h.name} className={styles.name} />
      </td>
      <td className={`${styles.td} ${styles.dates}`}>{formatDateTime(h.startAt)}</td>
      <td className={`${styles.td} ${styles.dates}`}>{formatDateTime(h.endAt)}</td>
      <td className={styles.td}><BadgeRow items={h.locations || []} maxLines={1} icon="solar:map-point-linear" /></td>
      <td className={`${styles.td} ${styles.stickyRight}`}>
        <span className={styles.actionsCell}>
          {action(h, { icon: 'solar:pen-linear', label: 'Edit', verb: 'edited', onClick: onEdit, left: true })}
          <span className={styles.actionDivider} aria-hidden="true" />
          {action(h, { icon: 'solar:copy-linear', label: 'Duplicate', verb: 'duplicated', onClick: onDuplicate, left: true })}
          <span className={styles.actionDivider} aria-hidden="true" />
          {action(h, { icon: 'solar:trash-bin-minimalistic-linear', label: 'Delete', verb: 'deleted', onClick: onDelete, left: true })}
        </span>
      </td>
    </tr>
  );
  return (
    <div className={[embedded ? styles.wrapEmbedded : styles.wrap, !loading && !holidays.length ? styles.empty : ''].filter(Boolean).join(' ')}>
      <WorklistShell
        header={null}
        columns={COLUMNS}
        rows={holidays}
        renderRow={renderRow}
        loading={loading}
        emptyState={emptyState}
        embedded={embedded}
        minTableWidth={980}
        page={pagination?.page}
        perPage={pagination?.perPage}
        totalItems={pagination?.totalItems}
        onPageChange={pagination?.onPageChange}
        onPageSizeChange={pagination?.onPageSizeChange}
      />
    </div>
  );
}

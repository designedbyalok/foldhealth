import { useRef } from 'react';
import { WorklistShell } from '../../components/WorklistShell/WorklistShell';
import { Badge } from '../../components/Badge/Badge';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Icon } from '../../components/Icon/Icon';
import { TruncatedText } from '../../components/TruncatedText/TruncatedText';
import { useScrollbarOnScroll } from '../../lib/useScrollbarOnScroll';
import { describeSchedule } from './onCallSeed';
import styles from './OooRecordsTable.module.css';

const COLUMNS = [
  { key: 'name', label: 'Schedule Name', width: 260 },
  { key: 'users', label: 'Users', width: 240 },
  { key: 'location', label: 'Location', width: 200 },
  { key: 'date', label: 'Date' },
  { key: 'type', label: 'Phone Tree Type', width: 160 },
  { key: 'actions', label: 'Actions', sticky: 'right', width: 140, thStyle: { boxShadow: 'inset 0.5px 0 0 var(--neutral-150)' } },
];

/**
 * On call schedules (Settings → Calls → On-Call Schedule): name, everyone on
 * call as grey badges (wrapping), the location (or All Locations), the dates and
 * weekdays, the phone tree type, then Edit, View and Delete.
 *
 * @param {object}   props
 * @param {object[]} props.schedules
 * @param {boolean}  [props.loading]
 * @param {React.ReactNode} props.emptyState
 * @param {function} props.onEdit   – (schedule) => void
 * @param {function} props.onView   – (schedule) => void
 * @param {function} props.onDelete – (schedule) => void
 */
export function OnCallSchedulesTable({ schedules, loading, emptyState, onEdit, onView, onDelete }) {
  const wrapRef = useRef(null);
  useScrollbarOnScroll(wrapRef);
  const action = (icon, label, onClick) => (
    <ActionButton tooltip={label} tooltipLeft tooltipBelow aria-label={label} onClick={onClick}>
      <Icon name={icon} size={16} color="var(--neutral-300)" />
    </ActionButton>
  );
  const renderRow = (s) => (
    <tr key={s.id} className={styles.row}>
      <td className={styles.td}><span className={styles.userName}><TruncatedText text={s.name} /></span></td>
      <td className={styles.td}>
        <span className={styles.userBadges}>
          {(s.users || [{ name: s.userName }]).map(u => (
            <Badge key={u.id || u.name} tone="neutral" size="sm" icon="solar:user-linear" className={styles.coverBadge} label={<span className={styles.coverName}>{u.name}</span>} />
          ))}
        </span>
      </td>
      <td className={styles.td}><TruncatedText text={s.location || 'All Locations'} /></td>
      <td className={styles.td}>{describeSchedule(s)}</td>
      <td className={styles.td}>{s.phoneTreeType}</td>
      <td className={`${styles.td} ${styles.stickyRight}`}>
        <span className={`${styles.actionsCell} ${styles.actionsGap}`}>
          {action('solar:pen-linear', 'Edit', () => onEdit(s))}
          <span className={styles.actionDivider} aria-hidden="true" />
          {action('solar:eye-linear', 'View', () => onView(s))}
          <span className={styles.actionDivider} aria-hidden="true" />
          {action('solar:trash-bin-minimalistic-linear', 'Delete', () => onDelete(s))}
        </span>
      </td>
    </tr>
  );
  return (
    <div ref={wrapRef} className={[styles.wrap, 'scrollbar-x-on-scroll', !loading && !schedules?.length ? styles.empty : ''].filter(Boolean).join(' ')}>
      <WorklistShell
        header={null}
        columns={COLUMNS}
        rows={schedules}
        renderRow={renderRow}
        loading={loading}
        emptyState={emptyState}
        minTableWidth={1240}
      />
    </div>
  );
}

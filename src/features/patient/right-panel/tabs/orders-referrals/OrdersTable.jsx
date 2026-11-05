import { ProfileTable } from '../../../../../components/ProfileTable/ProfileTable';
import { profileCellClass, profileRowClass } from '../../../../../components/ProfileTable/profileTableClasses';
import { Checkbox } from '../../../../../components/Checkbox/Checkbox';
import { toneOf } from './ordersViews';
import styles from './OrdersReferralsTab.module.css';

const select = { key: 'select', label: '', showCheckbox: true, width: 36 };
const ORDER_COLUMNS = [
  select, { key: 'name', label: 'Order' }, { key: 'by', label: 'Ordered By' }, { key: 'priority', label: 'Priority', width: 120 },
  { key: 'status', label: 'Status', width: 160 }, { key: 'date', label: 'Created On', width: 200 },
];
const COLUMNS = {
  lab: ORDER_COLUMNS,
  imaging: ORDER_COLUMNS,
  medication: [select, { key: 'name', label: 'Medication' }, { key: 'status', label: 'Status', width: 180 }, { key: 'date', label: 'Start Date', width: 200 }],
};

/** The Lab, Imaging and Medication views: one row per order. */
export function OrdersTable({ view, rows, selectedIds, onToggle, onToggleAll, emptyLabel }) {
  const selected = new Set(selectedIds);
  const columns = COLUMNS[view];
  const hasBy = columns.some(c => c.key === 'by');
  return (
    <ProfileTable
      columns={columns}
      rows={rows}
      selectedIds={selectedIds}
      onSelectAll={onToggleAll}
      emptyState={<span className={styles.muted}>{emptyLabel}</span>}
      renderRow={r => (
        <tr key={r.id} className={profileRowClass}>
          <td className={`${profileCellClass} ${styles.checkCell}`}>
            <Checkbox checked={selected.has(r.id)} onCheckedChange={() => onToggle(r.id)} aria-label={`Select ${r.name}`} />
          </td>
          <td className={profileCellClass}>
            <span className={styles.party}>
              <span className={styles.primaryText}>{r.name}</span>
              {r.detail && <span className={styles.muted}>{r.detail}</span>}
            </span>
          </td>
          {hasBy && <td className={profileCellClass}>{r.by}</td>}
          {hasBy && <td className={profileCellClass}>{r.priority}</td>}
          <td className={`${profileCellClass} ${styles[toneOf(r.status)]}`}>{r.status}</td>
          <td className={`${profileCellClass} ${styles.muted}`}>{r.dateLabel}</td>
        </tr>
      )}
    />
  );
}

import { Badge } from '../../../../../components/Badge/Badge';
import { Icon } from '../../../../../components/Icon/Icon';
import { ProfileTable } from '../../../../../components/ProfileTable/ProfileTable';
import { profileCellClass, profileRowClass } from '../../../../../components/ProfileTable/profileTableClasses';
import { Checkbox } from '../../../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { fmtDateTime } from './assessmentRows';
import styles from './AssessmentsTab.module.css';

const FULL_COLUMNS = [
  { key: 'select', label: '', showCheckbox: true, width: 36 },
  { key: 'name', label: 'Form Title' },
  { key: 'lastSent', label: 'Last Sent', width: 180 },
  { key: 'signed', label: 'Signed', width: 80 },
  { key: 'sentFor', label: 'Sent For', width: 140 },
  { key: 'status', label: 'Response Status', width: 140 },
];
const COMPACT_COLUMNS = FULL_COLUMNS.slice(0, 2);

function SignedCell({ signed }) {
  if (signed === 'yes') return <span className={styles.iconCell} title="Signed" aria-label="Signed"><Icon name="solar:check-circle-linear" size={16} color="var(--status-success)" /></span>;
  if (signed === 'no') return <span className={styles.iconCell} title="Not signed" aria-label="Not signed"><Icon name="solar:close-circle-linear" size={16} color="var(--neutral-300)" /></span>;
  return <span className={styles.muted}>N/A</span>;
}

function ResponseStatus({ pending, completed }) {
  return (
    <span className={styles.status}>
      <span className={`${styles.count} ${pending ? '' : styles.zero}`} title="Pending" aria-label={`${pending} pending`}>
        <Icon name="solar:clock-circle-linear" size={16} color={pending ? 'var(--status-warning)' : 'var(--neutral-200)'} />
        {pending}
      </span>
      <span className={styles.divider} aria-hidden="true" />
      <span className={`${styles.count} ${completed ? '' : styles.zero}`} title="Completed" aria-label={`${completed} completed`}>
        <Icon name="solar:check-read-linear" size={16} color={completed ? 'var(--status-success)' : 'var(--neutral-200)'} />
        {completed}
      </span>
    </span>
  );
}

/**
 * The patient's assessments. `compact` keeps only the checkbox and title,
 * for the narrow list beside an open assessment.
 */
export function AssessmentsTable({ rows, compact, activeId, selectedIds, onToggle, onToggleAll, onOpen, emptyLabel }) {
  const selected = new Set(selectedIds);
  return (
    <ProfileTable
      columns={compact ? COMPACT_COLUMNS : FULL_COLUMNS}
      rows={rows}
      selectedIds={selectedIds}
      onSelectAll={onToggleAll}
      emptyState={<span className={styles.muted}>{emptyLabel}</span>}
      renderRow={r => (
        <tr
          key={r.id}
          className={`${profileRowClass} ${styles.row} ${r.id === activeId ? styles.rowActive : ''}`}
          onClick={() => onOpen(r.id)}
        >
          <td className={`${profileCellClass} ${styles.checkCell}`} onClick={e => e.stopPropagation()}>
            <Checkbox checked={selected.has(r.id)} onCheckedChange={() => onToggle(r.id)} aria-label={`Select ${r.name}`} />
          </td>
          <td className={`${profileCellClass} ${styles.title}`}>{r.name}</td>
          {!compact && (
            <>
              <td className={profileCellClass}>{fmtDateTime(r.lastSentAt) || <span className={styles.muted}>Not sent</span>}</td>
              <td className={profileCellClass}><SignedCell signed={r.signed} /></td>
              <td className={profileCellClass}>
                <span className={styles.badges}>
                  {r.programs.length ? r.programs.map(p => <Badge key={p} tone="grey" size="XS" label={p} />) : <span className={styles.muted}>-</span>}
                </span>
              </td>
              <td className={profileCellClass}><ResponseStatus pending={r.pendingCount} completed={r.completedCount} /></td>
            </>
          )}
        </tr>
      )}
    />
  );
}

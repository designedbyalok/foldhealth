import { Icon } from '../../../../../../../components/Icon/Icon';
import { Input } from '../../../../../../../components/Input/Input';
import { Badge } from '../../../../../../../components/Badge/Badge';
import { Checkbox } from '../../../../../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { CarePlanProgressRing } from '../../../../../../../components/CarePlanProgressRing/CarePlanProgressRing';
import { useState } from 'react';
import styles from './carePlanTables.module.css';

export function EditableInlineTitle({ title, editable, onCommit }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);

  const commit = () => {
    setEditing(false);
    const next = value.trim();
    if (next && next !== title) onCommit(next);
    else setValue(title);
  };

  if (editing) {
    return (
      <Input
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setValue(title); setEditing(false); } }}
        aria-label="Edit title"
        className={styles.titleEditInput}
      />
    );
  }

  if (!editable) return <span className={styles.title}>{title}</span>;

  return (
    <button
      type="button"
      className={`${styles.title} ${styles.titleEditable}`}
      onClick={() => { setValue(title); setEditing(true); }}
      title="Click to rename"
    >
      {title}
    </button>
  );
}

export const GBI_STATUS_TONE = {
  'Not Started': 'grey',
  'In Progress': 'warning',
  'On Hold': 'grey',
  Met: 'success',
  'Not Met': 'error',
};

const BORDER_LEFT = { borderLeft: '0.5px solid var(--neutral-150)' };

// The bulk-select checkbox column. Prepended to a table's columns only while
// bulk mode is on (see withSelectColumn) so the three GBI tables share one
// checkbox placement and, when off, all start at the centered priority cell.
export const SELECT_COLUMN = { key: 'select', label: '', showCheckbox: true, width: 28 };

export const withSelectColumn = (columns, bulkMode) =>
  (bulkMode ? [SELECT_COLUMN, ...columns] : columns);

export const GOAL_COLUMNS = [
  { key: 'priority', label: 'P', width: 32, thStyle: { borderRight: '0.5px solid var(--neutral-150)' } },
  { key: 'title', label: 'Goal Title' },
  { key: 'value', label: 'Current Value', width: 120, thStyle: BORDER_LEFT },
  { key: 'trend', label: 'Trend', width: 80, thStyle: BORDER_LEFT },
  { key: 'progress', label: 'Progress', width: 88, thStyle: BORDER_LEFT },
  { key: 'status', label: 'Status', width: 140, thStyle: BORDER_LEFT },
  { key: 'actions', label: '', width: 40, sticky: 'right', thStyle: BORDER_LEFT },
];

export const INTERVENTION_COLUMNS = [
  { key: 'priority', label: 'P', width: 32, thStyle: { borderRight: '0.5px solid var(--neutral-150)' } },
  { key: 'title', label: 'Name' },
  { key: 'assignee', label: 'Assigned To', width: 130, thStyle: BORDER_LEFT },
  { key: 'adherence', label: 'Adherence', width: 100, thStyle: BORDER_LEFT },
  { key: 'status', label: 'Status', width: 140, thStyle: BORDER_LEFT },
  { key: 'actions', label: '', width: 40, sticky: 'right', thStyle: BORDER_LEFT },
];

export const BARRIER_COLUMNS = [
  { key: 'priority', label: 'P', width: 32, thStyle: { borderRight: '0.5px solid var(--neutral-150)' } },
  { key: 'title', label: 'Barrier Title' },
  { key: 'description', label: 'Description', width: 200, thStyle: BORDER_LEFT },
  { key: 'status', label: 'Status', width: 140, thStyle: BORDER_LEFT },
  { key: 'actions', label: '', width: 40, sticky: 'right', thStyle: BORDER_LEFT },
];

// The per-row bulk checkbox cell shared by all three GBI tables — stops click
// propagation so ticking never fires the row action.
export function GbiCheckboxCell({ checked, onToggle, label, disabled }) {
  return (
    <td className={styles.checkTd} onClick={e => e.stopPropagation()}>
      <Checkbox checked={checked} onCheckedChange={onToggle} aria-label={label} disabled={disabled} />
    </td>
  );
}

export function LinkChip({ count }) {
  return (
    <span className={`${styles.linkChip} ${count ? '' : styles.linkChipEmpty}`}>
      <Icon name="custom:link" size={14} color="var(--neutral-300)" />
      {count > 0 && <span className={styles.linkCount}>{count}</span>}
    </span>
  );
}

export function GoalProgressCell({ progress }) {
  const pct = Math.max(0, Math.min(100, Number(progress) || 0));
  return <CarePlanProgressRing progress={pct} />;
}

export function TrendCell({ trend }) {
  if (!trend || trend === '-') return <span className={styles.trendDash}>—</span>;
  const tone = trend === '↑' ? 'success' : trend === '↓' ? 'error' : 'grey';
  const icon = trend === '↑'
    ? 'solar:arrow-up-linear'
    : trend === '↓'
      ? 'solar:arrow-down-linear'
      : 'solar:minus-circle-linear';
  return <Badge tone={tone} size="S" icon={icon} />;
}

export function GbiStatusButton({ value, disabled, onOpen, badgeSize = 'S' }) {
  return (
    <button
      type="button"
      className={styles.statusBtn}
      disabled={disabled}
      onClick={(e) => onOpen?.(e.currentTarget.getBoundingClientRect())}
    >
      <Badge
        tone={GBI_STATUS_TONE[value] || 'grey'}
        size={badgeSize}
        label={value}
        chevron={!disabled}
      />
    </button>
  );
}

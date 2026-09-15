import { Icon } from '../../../../../../../components/Icon/Icon';
import { Input } from '../../../../../../../components/Input/Input';
import { Badge } from '../../../../../../../components/Badge/Badge';
import { Checkbox } from '../../../../../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { Tooltip } from '../../../../../../../components/Tooltip/Tooltip';
import { CarePlanProgressRing } from '../../../../../../../components/CarePlanProgressRing/CarePlanProgressRing';
import { useState } from 'react';
import { GbiLinkButton } from './CarePlanLinkedPreview';
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
  Overdue: 'error',
  Met: 'success',
  'Not Met': 'error',
};

export const CLOSED_BARRIER_STATUSES = new Set(['Met', 'Not Met']);

export const isClosedBarrier = (status) => CLOSED_BARRIER_STATUSES.has(status);

const HEADER_COMPACT = { paddingLeft: 6, paddingRight: 6 };

/** Fixed widths shared across Goals / Interventions / Barriers so columns align when stacked. */
export const GBI_COL_WIDTH = {
  priority: 28,
  /** Shared by Goals "Current Value" and Interventions "Assigned To". */
  value: 132,
  assignee: 124,
  progress: 90,
  status: 116,
  actions: 36,
};

// The bulk-select checkbox column. Prepended to a table's columns only while
// bulk mode is on (see withSelectColumn) so the three GBI tables share one
// checkbox placement and, when off, all start at the centered priority cell.
export const SELECT_COLUMN = { key: 'select', label: '', showCheckbox: true, width: 28 };

export const withSelectColumn = (columns, bulkMode) =>
  (bulkMode ? [SELECT_COLUMN, ...columns] : columns);

// Goals surface Start + Target instead of Current Value — the value
// is more useful on the goal detail drawer, where trends and last
// measurement context live; the schedule cadence reads better in the
// table. Widths intentionally match the intervention table one-for-one
// (Start ↔ Due Date, Target ↔ Assigned To) so a plan that stacks
// Goals over Interventions reads as a single grid.
export const GBI_COL_DATE_WIDTH = 108;
export const GOAL_COLUMNS = [
  { key: 'priority', label: 'P', popoverLabel: 'Priority', width: GBI_COL_WIDTH.priority, align: 'center', sortKey: '_sortPriority', sortType: 'priority', hideSortIcon: true, thStyle: { paddingLeft: 4, paddingRight: 4 } },
  { key: 'title', label: 'Goal Title', sortKey: 'title', sortType: 'alpha' },
  { key: 'createdDate', label: 'Start', popoverLabel: 'Start Date', width: GBI_COL_DATE_WIDTH, sortKey: '_sortCreatedAt', sortType: 'generic', thStyle: HEADER_COMPACT },
  { key: 'targetDate', label: 'Target', popoverLabel: 'Target Date', width: GBI_COL_WIDTH.assignee, sortKey: '_sortTargetDate', sortType: 'generic', thStyle: HEADER_COMPACT },
  // Optional columns — off by default; users opt in through the picker.
  { key: 'currentValue', label: 'Current Value', width: GBI_COL_WIDTH.progress, defaultHidden: true, thStyle: HEADER_COMPACT },
  { key: 'progress', label: 'Progress', width: GBI_COL_WIDTH.progress, sortKey: '_sortProgress', sortType: 'number', defaultHidden: true, thStyle: HEADER_COMPACT },
  { key: 'trend', label: 'Trend', width: GBI_COL_WIDTH.progress, defaultHidden: true, thStyle: HEADER_COMPACT },
  // Status is intentionally non-hideable — the row is meaningless without
  // its Status pill. It stays in-flow (not sticky) so it reads next to
  // optional metrics; only the picker's Hide toggle is locked off.
  { key: 'status', label: 'Status', width: GBI_COL_WIDTH.status, sortKey: 'status', sortType: 'alpha', locked: true, thStyle: HEADER_COMPACT },
  { key: 'actions', label: '', popoverLabel: 'Action', width: GBI_COL_WIDTH.actions, sticky: 'right', thStyle: { paddingLeft: 4, paddingRight: 4 } },
];

export const INTERVENTION_COLUMNS = [
  { key: 'priority', label: 'P', popoverLabel: 'Priority', width: GBI_COL_WIDTH.priority, align: 'center', sortKey: '_sortPriority', sortType: 'priority', hideSortIcon: true, thStyle: { paddingLeft: 4, paddingRight: 4 } },
  { key: 'title', label: 'Name', sortKey: 'title', sortType: 'alpha' },
  { key: 'assignee', label: 'Assigned To', width: GBI_COL_WIDTH.assignee, sortKey: '_sortAssignee', sortType: 'alpha', thStyle: HEADER_COMPACT },
  { key: 'adherence', label: 'Adherence', width: GBI_COL_WIDTH.progress, sortKey: '_sortAdherence', sortType: 'number', defaultHidden: true, thStyle: HEADER_COMPACT },
  { key: 'status', label: 'Status', width: GBI_COL_WIDTH.status, sortKey: 'status', sortType: 'alpha', thStyle: HEADER_COMPACT },
  { key: 'actions', label: '', popoverLabel: 'Action', width: GBI_COL_WIDTH.actions, sticky: 'right', thStyle: { paddingLeft: 4, paddingRight: 4 } },
];

export const BARRIER_COLUMNS = [
  { key: 'priority', label: '', width: GBI_COL_WIDTH.priority, thStyle: { paddingLeft: 4, paddingRight: 4 } },
  { key: 'title', label: 'Name', sortKey: 'title', sortType: 'alpha' },
  { key: 'status', label: 'Status', width: GBI_COL_WIDTH.status, sortKey: 'status', sortType: 'alpha', thStyle: HEADER_COMPACT },
  { key: 'actions', label: '', width: GBI_COL_WIDTH.actions, thStyle: { paddingLeft: 4, paddingRight: 4 } },
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

/** Shared name cell — primary title + optional secondary meta (inline or stacked). */
export function GbiNameCell({
  icon,
  iconTitle,
  title,
  meta,
  layout = 'inline',
  linked = null,
  // `recurring` — when true, renders a small refresh glyph before
  // the link button so recurring interventions are visible at a
  // glance. No-op for goals / barriers, which never pass it.
  recurring = false,
  // Rich tooltip content for the recurring glyph (e.g. "Repeats every
  // 2 weeks · 5 times, ends in 3 months"). Falls back to "Recurring"
  // when the caller hasn't computed a schedule label.
  recurringLabel = 'Recurring',
}) {
  const stacked = layout === 'stacked';

  return (
    <div className={`${styles.nameCell} ${stacked ? styles.nameCellStacked : ''}`}>
      {icon ? (
        iconTitle ? (
          <Tooltip label={iconTitle}>
            <span className={styles.rowIcon} aria-label={iconTitle}>
              <Icon name={icon} size={16} color="var(--neutral-400)" />
            </span>
          </Tooltip>
        ) : (
          <span className={styles.rowIcon}>
            <Icon name={icon} size={16} color="var(--neutral-400)" />
          </span>
        )
      ) : null}
      <span className={stacked ? styles.nameTextStacked : styles.nameText}>
        <span className={styles.namePrimary}>{title}</span>
        {meta && !stacked ? (
          <>
            <span className={styles.nameSep} aria-hidden="true">·</span>
            <span className={styles.nameSecondary}>{meta}</span>
          </>
        ) : null}
        {meta && stacked ? <span className={styles.nameSecondary}>{meta}</span> : null}
      </span>
      {recurring && (
        <Tooltip label={recurringLabel}>
          <span className={styles.recurringIcon} aria-label={recurringLabel}>
            <Icon name="solar:refresh-linear" size={14} color="var(--neutral-300)" />
          </span>
        </Tooltip>
      )}
      <GbiLinkButton data={linked} />
    </div>
  );
}

/** Progress / adherence cell — bar in tables, ring in drawers. */
export function GbiProgressCell({ progress, variant = 'bar', size = 'S' }) {
  const pct = Math.max(0, Math.min(100, Number(progress) || 0));
  return <CarePlanProgressRing progress={pct} variant={variant} size={size} />;
}

/** @deprecated Use GbiProgressCell */
export const GoalProgressCell = GbiProgressCell;

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

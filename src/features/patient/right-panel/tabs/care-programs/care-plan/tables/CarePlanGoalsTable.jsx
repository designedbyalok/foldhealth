import { useMemo, useState } from 'react';
import { ActionButton } from '../../../../../../../components/ActionButton/ActionButton';
import { WorklistShell } from '../../../../../../../components/WorklistShell/WorklistShell';
import { PriorityIcon } from '../../../../../../../components/PriorityIcon/PriorityIcon';
import { Icon } from '../../../../../../../components/Icon/Icon';
import { Tooltip } from '../../../../../../../components/Tooltip/Tooltip';
import { useTableSort } from '../../../../../../../components/HeaderCell/useTableSort';
import { DatePickerPopover } from '../../../../../../../components/DatePicker/DatePickerPopover';
import {
  GOAL_COLUMNS,
  withSelectColumn,
  GbiCheckboxCell,
  GbiNameCell,
  GbiProgressCell,
  GbiStatusButton,
  GbiMetaLine,
  GbiMetaDate,
  GbiRowActions,
  CompletedRowsGroup,
  TrendCell,
} from './carePlanTableShared';
import { COMPACT_GOAL_COLUMNS } from './carePlanTableColumns';
import { isCompletedStatus, toPickerValue, fmtCarePlanDate } from './carePlanTableModel';
import { enrichGoalRows } from './carePlanTableSort';
import {
  normalizeCategory,
  goalCategoryIcon,
  formatGoalTarget,
  goalTargetUnitMissing,
} from '../../../../../../settings/care-plan-library/lib';
import styles from './carePlanTables.module.css';

// "Goal < 7 %" exactly as the goal editor formats it. Assessments are skipped:
// their target IS the date, which the meta line already shows.
function GoalTargetValue({ goal }) {
  if (normalizeCategory(goal.category) === 'Assessment') return null;
  const target = formatGoalTarget(goal);
  if (!target) return null;
  const unitMissing = goalTargetUnitMissing(goal);
  return (
    <span className={styles.metaInline}>
      <span className={styles.metaText}>Goal {target}</span>
      {unitMissing && (
        <Tooltip label="No unit recorded for this target. Edit the goal to add one.">
          <span className={styles.metaWarn} aria-label="No unit recorded for this target">
            <Icon name="solar:danger-triangle-linear" size={14} color="var(--status-warning)" />
          </span>
        </Tooltip>
      )}
    </span>
  );
}

export function CarePlanGoalsTable({
  rows,
  canEdit,
  bulkMode,
  selectedIds,
  onSelectAll,
  onToggleSelect,
  onOpenGoal,
  onPriorityMenu,
  onStatusMenu,
  onRowMenu,
  // Target-date click hands the goal + the picked date up so the parent can
  // persist through its own save action. Omitted → the date is static text.
  onTargetDateChange,
  // Notes icon → open the goal drawer at its Note section.
  onOpenNotes,
  // (goal) => boolean — whether the goal has a current (undeleted) note.
  hasNote,
  linked,
  template = false,
  emptyState,
}) {
  const sortableRows = useMemo(() => enrichGoalRows(rows), [rows]);
  const { sorted, sortKey, sortDir, requestSort } = useTableSort(sortableRows, 'title', 'asc');
  const [completedOpen, setCompletedOpen] = useState(false);
  // One inline target-date picker shared across rows; the anchor rect +
  // active goal drive the popover position and its seeded value.
  const [targetPicker, setTargetPicker] = useState(null); // { goal, rect } | null
  const targetEditable = canEdit && !!onTargetDateChange;
  const openTargetPicker = (goal, rect) => {
    if (!targetEditable) return;
    setTargetPicker({ goal, rect });
  };
  const commitTargetDate = (iso) => {
    if (targetPicker?.goal) onTargetDateChange(targetPicker.goal, iso);
    setTargetPicker(null);
  };

  // A template row has no value, progress or status, but it still gets its
  // row menu when the caller can act on one.
  const showActions = !template || Boolean(onRowMenu);
  const columns = template
    ? GOAL_COLUMNS.filter(c => c.key === 'priority' || c.key === 'title'
      || (showActions && c.key === 'actions'))
    : COMPACT_GOAL_COLUMNS;

  // Met goals collapse into "Completed Goals"; templates have no status.
  const { activeRows, completedRows } = useMemo(() => {
    if (template) return { activeRows: sorted, completedRows: [] };
    const active = [];
    const done = [];
    for (const g of sorted) (isCompletedStatus(g.status) ? done : active).push(g);
    return { activeRows: active, completedRows: done };
  }, [sorted, template]);

  const openRowMenu = (g, e) => onRowMenu({ kind: 'goal-menu', item: g, rect: e.currentTarget.getBoundingClientRect() });

  const renderPriority = (g) => (
    <td className={styles.priorityTd} onClick={e => e.stopPropagation()}>
      {canEdit ? (
        <button
          type="button"
          className={styles.priorityBtn}
          onClick={(e) => onPriorityMenu({ kind: 'goal', item: g, rect: e.currentTarget.getBoundingClientRect() })}
          aria-label="Change priority"
        >
          <PriorityIcon priority={g.priority} size={16} />
        </button>
      ) : (
        <PriorityIcon priority={g.priority} size={16} />
      )}
    </td>
  );

  // Library templates keep their original row: title + description, link
  // button in the name cell, menu only.
  const renderTemplateRow = (g) => (
    <tr
      key={g.id}
      data-cp-row-id={g.id}
      className={`${styles.row} ${styles.rowClickable} ${styles.gbiRow}`}
      onClick={() => onOpenGoal(g)}
    >
      {bulkMode && (
        <GbiCheckboxCell
          checked={selectedIds.includes(g.id)}
          onToggle={() => onToggleSelect(g.id)}
          label={`Select ${g.title}`}
          disabled={!canEdit}
        />
      )}
      {renderPriority(g)}
      <td className={styles.titleTd}>
        <GbiNameCell
          icon={goalCategoryIcon(g.category)}
          iconTitle={g.category ? normalizeCategory(g.category) : 'Goal'}
          title={g.title}
          meta={g.subtitle || null}
          layout="stacked"
          linked={linked(g)}
        />
      </td>
      {showActions && (
        <td className={styles.actionsTd} onClick={e => e.stopPropagation()}>
          <ActionButton
            icon="solar:menu-dots-linear"
            size="S"
            tooltip="More"
            tooltipBelow
            tooltipLeft
            onClick={(e) => openRowMenu(g, e)}
          />
        </td>
      )}
    </tr>
  );

  const renderRow = (g, _i, ctx) => {
    if (template) return renderTemplateRow(g);
    const hidden = ctx?.hiddenSet || null;
    const isHidden = (k) => (hidden ? hidden.has(k) : false);
    const hasReading = g.currentValue && g.currentValue !== 'No Data';
    const start = fmtCarePlanDate(g.createdAt);
    const targetDate = (prefix) => (
      <GbiMetaDate
        label={prefix}
        noun="target date"
        value={g.targetDate}
        emptyLabel="No target date"
        status={g.status}
        editable={targetEditable}
        onEdit={(rect) => openTargetPicker(g, rect)}
      />
    );
    // A date column the user switched on carries the value, so the meta line
    // drops its copy rather than show it twice.
    const meta = (
      <GbiMetaLine
        segments={[
          isHidden('createdDate') && start && {
            key: 'start',
            node: <span className={styles.metaDate}>Start {start}</span>,
          },
          isHidden('targetDate') && { key: 'target', node: targetDate('Target date') },
          { key: 'goal', node: <GoalTargetValue goal={g} /> },
          hasReading && {
            key: 'current',
            node: <span className={styles.metaText}>Current {g.currentValue}</span>,
          },
        ]}
      />
    );
    return (
      <tr
        key={g.id}
        /* `data-cp-row-id` lets the CarePlan linked-items popover scroll to
           and flash this row on click. */
        data-cp-row-id={g.id}
        className={`${styles.row} ${styles.rowClickable} ${styles.gbiRow}`}
        onClick={() => onOpenGoal(g)}
      >
        {bulkMode && (
          <GbiCheckboxCell
            checked={selectedIds.includes(g.id)}
            onToggle={() => onToggleSelect(g.id)}
            label={`Select ${g.title}`}
            disabled={!canEdit}
          />
        )}
        {!isHidden('priority') && renderPriority(g)}
        <td className={styles.titleTd}>
          <GbiNameCell
            icon={goalCategoryIcon(g.category)}
            iconTitle={g.category ? normalizeCategory(g.category) : 'Goal'}
            title={g.title}
            meta={meta}
            layout="stacked"
            showLink={false}
          />
        </td>
        {!isHidden('createdDate') && (
          <td className={styles.dateTd} onClick={e => e.stopPropagation()}>
            <span className={styles.dueDateText}>{start || '-'}</span>
          </td>
        )}
        {!isHidden('targetDate') && (
          <td className={styles.dateTd} onClick={e => e.stopPropagation()}>
            <span className={styles.metaLine}>{targetDate('')}</span>
          </td>
        )}
        {!isHidden('progress') && (
          <td className={styles.progressTd} onClick={e => e.stopPropagation()}>
            <GbiProgressCell progress={g.progress} />
          </td>
        )}
        {!isHidden('trend') && (
          <td className={styles.progressTd} onClick={e => e.stopPropagation()}>
            <TrendCell trend={g.trend} />
          </td>
        )}
        <td className={styles.statusTd} onClick={e => e.stopPropagation()}>
          <GbiStatusButton
            value={g.status}
            disabled={!canEdit}
            onOpen={rect => onStatusMenu({ kind: 'goal', item: g, rect })}
          />
        </td>
        <td className={`${styles.actionsTd} ${styles.actionsWide}`} onClick={e => e.stopPropagation()}>
          <GbiRowActions
            linked={linked(g)}
            hasNote={!!hasNote?.(g)}
            onNotes={() => onOpenNotes?.(g)}
            onMenu={(e) => openRowMenu(g, e)}
            menuDisabled={!canEdit}
          />
        </td>
      </tr>
    );
  };

  const noActive = activeRows.length === 0 && completedRows.length > 0;

  return (
    <div className={styles.tableWrap}>
      <WorklistShell
        embedded
        embeddedNoScroll
        header={null}
        hideBulkBar
        columns={withSelectColumn(columns, bulkMode)}
        rows={activeRows}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={requestSort}
        selectedIds={selectedIds}
        onSelectAll={onSelectAll}
        minTableWidth={0}
        emptyState={noActive ? <div className={styles.emptyRow}>No open goals.</div> : emptyState}
        // Column prefs (Show/Hide Columns in the Actions header) persist per
        // user. v2: the compact grid changed which columns exist and default.
        worklistKey={template ? undefined : 'carePlan:goals:v2'}
        renderRow={renderRow}
        renderTbodyFooter={template ? undefined : (ctx) => (
          <CompletedRowsGroup
            label="Completed Goals"
            rows={completedRows}
            open={completedOpen}
            onToggle={() => setCompletedOpen(v => !v)}
            colSpan={ctx.colSpan}
            renderRow={renderRow}
            ctx={ctx}
          />
        )}
      />
      {targetPicker && (
        <DatePickerPopover
          open
          value={toPickerValue(targetPicker.goal.targetDate)}
          anchorRect={targetPicker.rect}
          onChange={commitTargetDate}
          onClose={() => setTargetPicker(null)}
        />
      )}
    </div>
  );
}

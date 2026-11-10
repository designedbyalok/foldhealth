import { useMemo, useState } from 'react';
import { ActionButton } from '../../../../../../../components/ActionButton/ActionButton';
import { PriorityIcon } from '../../../../../../../components/PriorityIcon/PriorityIcon';
import { WorklistShell } from '../../../../../../../components/WorklistShell/WorklistShell';
import { useTableSort } from '../../../../../../../components/HeaderCell/useTableSort';
import {
  BARRIER_COLUMNS,
  withSelectColumn,
  GbiCheckboxCell,
  GbiNameCell,
  GbiStatusButton,
  GbiRowActions,
  CompletedRowsGroup,
} from './carePlanTableShared';
import { COMPACT_BARRIER_COLUMNS } from './carePlanTableColumns';
import { enrichBarrierRows } from './carePlanTableSort';
import { isCompletedStatus, openOnRowKey } from './carePlanTableModel';
import { AiSuggestionBadge } from '../ai/AiSuggestionBadge';
import styles from './carePlanTables.module.css';

function BarrierRow({
  barrier: b,
  bulkMode,
  selectedIds,
  canEdit,
  onToggleSelect,
  onStatusMenu,
  onPriorityMenu,
  onRowMenu,
  onOpenBarrier,
  onOpenNotes,
  hasNote,
  onTitleChange,
  linked,
  template,
  active,
}) {
  // Mirrors the table's own gate: a template row keeps its menu when the
  // caller can act on one.
  const showActions = !template || Boolean(onRowMenu);
  const openRowMenu = (e) => onRowMenu({ kind: 'barrier-menu', item: b, rect: e.currentTarget.getBoundingClientRect() });
  return (
    <tr
      key={b.id}
      data-cp-row-id={b.id}
      className={`${styles.row} ${styles.gbiRow} ${onOpenBarrier ? styles.rowClickable : ''}${active ? ` ${styles.rowActive}` : ''}`}
      aria-current={active ? 'true' : undefined}
      tabIndex={onOpenBarrier ? 0 : undefined}
      onClick={() => onOpenBarrier?.(b)}
      onKeyDown={onOpenBarrier ? openOnRowKey(() => onOpenBarrier(b)) : undefined}
    >
      {bulkMode && (
        <GbiCheckboxCell
          checked={selectedIds.includes(b.id)}
          onToggle={() => onToggleSelect(b.id)}
          label={`Select ${b.title}`}
          disabled={!canEdit}
        />
      )}
      {/* Set here the same way as a goal's: on a patient's plan when it can
          be edited, and on a template whenever the caller offers the menu. */}
      <td className={styles.priorityTd} onClick={e => e.stopPropagation()}>
        {(canEdit || template) && onPriorityMenu ? (
          <button
            type="button"
            className={styles.priorityBtn}
            onClick={(e) => onPriorityMenu({ kind: 'barrier', item: b, rect: e.currentTarget.getBoundingClientRect() })}
            aria-label="Change priority"
          >
            <PriorityIcon priority={b.priority} size={16} />
          </button>
        ) : (
          <PriorityIcon priority={b.priority} size={16} />
        )}
      </td>
      <td className={styles.titleTd}>
        {/* Library templates keep the description + inline link button; the
            patient plan reads as a single line with links in Actions. */}
        <GbiNameCell
          icon="custom:barrier"
          title={b.title}
          badge={<AiSuggestionBadge kind="barrier" item={b} />}
          meta={template ? (b.description || null) : null}
          linked={linked(b)}
          showLink={template}
          onTitleCommit={!template && canEdit && onTitleChange ? (t) => onTitleChange(b, t) : undefined}
          titleLabel="Barrier title"
        />
      </td>
      {!template && (
        <td className={styles.barrierStatusTd} onClick={e => e.stopPropagation()}>
          <GbiStatusButton
            value={b.status} reason={b.statusReason}
            disabled={!canEdit}
            onOpen={rect => onStatusMenu({ kind: 'barrier', item: b, rect })}
          />
        </td>
      )}
      {template && showActions && (
        <td className={styles.actionsTd} onClick={e => e.stopPropagation()}>
          <ActionButton
            icon="solar:menu-dots-linear"
            size="sm"
            tooltip="More"
            tooltipBelow
            tooltipLeft
            onClick={openRowMenu}
          />
        </td>
      )}
      {!template && (
        <td className={`${styles.actionsTd} ${styles.actionsWide}`} onClick={e => e.stopPropagation()}>
          <GbiRowActions
            linked={linked(b)}
            note={hasNote?.(b) || null}
            onNotes={e => onOpenNotes?.(b, e?.currentTarget?.getBoundingClientRect?.())}
            onMenu={openRowMenu}
            menuDisabled={!canEdit}
          />
        </td>
      )}
    </tr>
  );
}

export function CarePlanBarriersTable({
  rows,
  canEdit,
  bulkMode,
  selectedIds,
  onSelectAll,
  onToggleSelect,
  onStatusMenu,
  // ({ kind: 'barrier', item, rect }) => void: opens the priority menu.
  onPriorityMenu,
  onRowMenu,
  onOpenBarrier,
  // Id of the barrier open in the docked detail panel, highlighted.
  activeRowId,
  // Notes icon → open the barrier drawer at its Note section.
  onOpenNotes,
  // (barrier) => boolean: whether it has a current (undeleted) note.
  hasNote,
  // (barrier, title) => void: saves an in-place title edit.
  onTitleChange,
  linked,
  template = false,
  emptyState,
}) {
  const [resolvedOpen, setResolvedOpen] = useState(false);
  // Bridge for pre-migration data: consolidate title-clone barrier rows
  // into a single logical row whose `goalIds` merges every clone's
  // goal_id. Post-migration each barrier is already unique per title,
  // so this pass is a no-op then.
  const consolidatedRows = useMemo(() => {
    const groups = new Map();
    for (const row of (rows || [])) {
      const key = (row.title || '').trim().toLowerCase();
      const existing = groups.get(key);
      const rowGoalIds = Array.isArray(row.goalIds) && row.goalIds.length > 0
        ? row.goalIds
        : (row.goalId ? [row.goalId] : []);
      if (!existing) {
        groups.set(key, { ...row, goalIds: [...new Set(rowGoalIds)] });
      } else {
        // Prefer the oldest row's id as the canonical id (matches the
        // migration's keep-the-oldest strategy).
        const keepOlder = new Date(existing.createdAt || 0) <= new Date(row.createdAt || 0);
        groups.set(key, {
          ...(keepOlder ? existing : row),
          goalIds: [...new Set([...(existing.goalIds || []), ...rowGoalIds])],
        });
      }
    }
    return Array.from(groups.values());
  }, [rows]);
  const sortableRows = useMemo(() => enrichBarrierRows(consolidatedRows), [consolidatedRows]);
  const { sorted, sortKey, sortDir, requestSort } = useTableSort(sortableRows, 'title', 'asc');
  // A template row has no status, but it still gets its row menu when the
  // caller can act on one.
  const showActions = !template || Boolean(onRowMenu);
  const columns = template
    ? BARRIER_COLUMNS.filter(c => c.key === 'priority' || c.key === 'title'
      || (showActions && c.key === 'actions'))
    : COMPACT_BARRIER_COLUMNS;

  // Only a Met barrier is resolved; Not Met stays in the open list so an
  // unresolved blocker can't be tucked away.
  const { openRows, resolvedRows } = useMemo(() => {
    if (template) return { openRows: sorted, resolvedRows: [] };
    const open = [];
    const resolved = [];
    for (const row of sorted) (isCompletedStatus(row.status) ? resolved : open).push(row);
    return { openRows: open, resolvedRows: resolved };
  }, [sorted, template]);

  const renderRow = (b) => (
    <BarrierRow
      key={b.id}
      barrier={b}
      bulkMode={bulkMode}
      selectedIds={selectedIds}
      canEdit={canEdit}
      onToggleSelect={onToggleSelect}
      onStatusMenu={onStatusMenu}
      onPriorityMenu={onPriorityMenu}
      onRowMenu={onRowMenu}
      onOpenBarrier={onOpenBarrier}
      onOpenNotes={onOpenNotes}
      hasNote={hasNote}
      onTitleChange={onTitleChange}
      linked={linked}
      template={template}
      active={activeRowId === b.id}
    />
  );

  const noOpen = openRows.length === 0 && resolvedRows.length > 0;

  return (
    <div className={styles.tableWrap}>
      <WorklistShell
        embedded
        embeddedNoScroll
        header={null}
        hideBulkBar
        columns={withSelectColumn(columns, bulkMode)}
        rows={openRows}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={requestSort}
        selectedIds={selectedIds}
        onSelectAll={onSelectAll}
        minTableWidth={0}
        emptyState={noOpen ? <div className={styles.emptyRow}>No open barriers.</div> : emptyState}
        renderRow={renderRow}
        renderTbodyFooter={template ? undefined : (ctx) => (
          <CompletedRowsGroup
            label="Closed Barriers"
            rows={resolvedRows}
            open={resolvedOpen}
            onToggle={() => setResolvedOpen(v => !v)}
            colSpan={ctx.colSpan}
            renderRow={renderRow}
            ctx={ctx}
          />
        )}
      />
    </div>
  );
}

import { useMemo, useState } from 'react';
import { ActionButton } from '../../../../../../../components/ActionButton/ActionButton';
import { AssigneeChange } from '../../../../../../../components/AssigneeChange/AssigneeChange';
import { WorklistShell } from '../../../../../../../components/WorklistShell/WorklistShell';
import { PriorityIcon } from '../../../../../../../components/PriorityIcon/PriorityIcon';
import { useTableSort } from '../../../../../../../components/HeaderCell/useTableSort';
import { DatePickerPopover } from '../../../../../../../components/DatePicker/DatePickerPopover';
import { RepeatEditor } from '../../../../../../../components/RepeatEditor/RepeatEditor';
import { Icon } from '../../../../../../../components/Icon/Icon';
import { Tooltip } from '../../../../../../../components/Tooltip/Tooltip';
import {
  INTERVENTION_COLUMNS,
  withSelectColumn,
  GbiCheckboxCell,
  GbiNameCell,
  GbiProgressCell,
  GbiStatusButton,
  GbiMetaLine,
  GbiMetaDate,
  GbiRowActions,
  CompletedRowsGroup,
  GBI_COL_WIDTH,
} from './carePlanTableShared';
import { COMPACT_INTERVENTION_COLUMNS } from './carePlanTableColumns';
import { isCompletedStatus, parseCarePlanDate, toPickerValue } from './carePlanTableModel';
import { enrichInterventionRows } from './carePlanTableSort';
import { CARE_PLAN_INTERVENTION_ICONS } from '../lib/carePlanInterventionMenu';
import { KIND_LABELS } from '../../../../../../settings/care-plan-library/interventions/shared/interventionKinds';
import styles from './carePlanTables.module.css';

// "7d" / "1w" / "2m" / "1y" (or config.dueOffset + dueUnit) → "1 week".
// Falls back to the raw string when it can't be parsed so nothing is
// lost for legacy rows.
function formatDurationLabel(intv) {
  if (!intv) return null;
  const raw = intv.config?.dueOffset != null && intv.config?.dueUnit
    ? `${intv.config.dueOffset}${String(intv.config.dueUnit)[0]}`
    : intv.duration;
  if (!raw) return null;
  const m = String(raw).trim().match(/^(\d+)\s*([dwmy])$/i);
  if (!m) return String(raw);
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  const dayCount = unit === 'd' ? n : unit === 'w' ? n * 7 : unit === 'm' ? n * 30 : n * 365;
  if (dayCount % 365 === 0) { const y = dayCount / 365; return `${y} year${y === 1 ? '' : 's'}`; }
  if (dayCount % 30  === 0) { const mo = dayCount / 30;  return `${mo} month${mo === 1 ? '' : 's'}`; }
  if (dayCount % 7   === 0) { const w = dayCount / 7;    return `${w} week${w === 1 ? '' : 's'}`; }
  return `${dayCount} day${dayCount === 1 ? '' : 's'}`;
}
function fmtDate(d) {
  if (!d || Number.isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
}
const NO_DUE_DATE = { iso: null, formatted: null };
// Due date = user-picked override when present, else createdAt + the
// configured duration. With neither, the intervention has no due date and
// this returns nulls: callers show "No due date" rather than a projected
// one. Returns { iso, formatted } so the calendar can seed itself and the
// cell has a display string in one call.
export function computeDueDate(intv) {
  const override = intv?.config?.dueDateOverride;
  if (override) {
    // Picked dates are stored date-only; parse locally so they don't
    // render a day early west of UTC.
    const d = parseCarePlanDate(override);
    if (d) return { iso: d.toISOString(), formatted: fmtDate(d) };
  }
  const raw = intv?.config?.dueOffset != null && intv?.config?.dueUnit
    ? `${intv.config.dueOffset}${String(intv.config.dueUnit)[0]}`
    : intv?.duration;
  const m = raw && String(raw).trim().match(/^(\d+)\s*([dwmy])$/i);
  const start = intv?.createdAt ? new Date(intv.createdAt) : null;
  if (!m || !start || Number.isNaN(start.getTime())) return NO_DUE_DATE;
  const end = new Date(start);
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (unit === 'd') end.setDate(end.getDate() + n);
  else if (unit === 'w') end.setDate(end.getDate() + n * 7);
  else if (unit === 'm') end.setMonth(end.getMonth() + n);
  else if (unit === 'y') end.setFullYear(end.getFullYear() + n);
  return { iso: end.toISOString(), formatted: fmtDate(end) };
}

// Project the future occurrences of a recurring intervention onto
// YYYY-MM-DD strings so the calendar popover can paint each cell
// with the "will fire here" grey-50 marker.
//
// Semantics — matches the Add Task drawer's repeat block:
//   • The first occurrence IS the due date (also the primary
//     selection, so it shows in primary purple, not grey).
//   • repeatEvery + repeatEveryUnit sets the interval between runs.
//   • repeatCount caps the total number of runs.
//   • repeatEnds + repeatEndsUnit extends the horizon; whichever
//     rule fires later wins so tweaking either widens the visible
//     schedule immediately.
export function computeOccurrenceDates(intv) {
  const c = intv?.config;
  if (!c?.repeat) return [];
  const startIso = computeDueDate(intv).iso;
  if (!startIso) return [];
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return [];
  const every = Math.max(1, Number(c.repeatEvery) || 1);
  const count = Math.max(1, Number(c.repeatCount) || 1);
  const everyUnit = String(c.repeatEveryUnit || 'Days').toLowerCase();
  const endsAmount = Math.max(0, Number(c.repeatEnds) || 0);
  const endsUnit = String(c.repeatEndsUnit || 'Days').toLowerCase();
  const horizon = endsAmount > 0 ? addUnit(start, endsAmount, endsUnit) : null;
  const HARD_CAP = 100;
  const out = [isoDay(start)];
  for (let k = 1; k < HARD_CAP; k++) {
    const next = addUnit(start, every * k, everyUnit);
    const hitCount = k >= count;
    const hitHorizon = horizon ? next > horizon : true;
    if (hitCount && hitHorizon) break;
    if (horizon && next > horizon) break;
    out.push(isoDay(next));
  }
  return out;
}
function addUnit(base, amount, unit) {
  const d = new Date(base);
  if (unit.startsWith('day')) d.setDate(d.getDate() + amount);
  else if (unit.startsWith('week')) d.setDate(d.getDate() + amount * 7);
  else if (unit.startsWith('month')) d.setMonth(d.getMonth() + amount);
  else if (unit.startsWith('year')) d.setFullYear(d.getFullYear() + amount);
  return d;
}
function isoDay(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// "day" / "days" / "week" / "weeks" — used by the recurrence tooltip
// so "every 1 week" reads as "every week" and "every 2 weeks" pluralizes.
function pluralUnit(unit, count) {
  if (!unit) return '';
  const u = String(unit).toLowerCase().replace(/s$/, '');
  return count === 1 ? u : `${u}s`;
}
// Compose a human-readable schedule string from the intervention's
// repeat config. Renders in the recurring-icon tooltip so hovering
// the glyph reveals "how it repeats". Missing pieces are skipped
// rather than shown as empty parts.
export function formatRecurrenceLabel(intv) {
  const c = intv?.config;
  if (!c?.repeat) return 'Recurring';
  const parts = [];
  const every = Number(c.repeatEvery);
  if (Number.isFinite(every) && every > 0 && c.repeatEveryUnit) {
    parts.push(every === 1
      ? `Repeats every ${pluralUnit(c.repeatEveryUnit, 1)}`
      : `Repeats every ${every} ${pluralUnit(c.repeatEveryUnit, every)}`);
  } else {
    parts.push('Repeats');
  }
  const times = Number(c.repeatCount);
  if (Number.isFinite(times) && times > 0) {
    parts.push(`${times} ${times === 1 ? 'time' : 'times'}`);
  }
  const ends = Number(c.repeatEnds);
  if (Number.isFinite(ends) && ends > 0 && c.repeatEndsUnit) {
    parts.push(`ends in ${ends} ${pluralUnit(c.repeatEndsUnit, ends)}`);
  }
  return parts.join(' · ');
}

// Due Date column width — separate from the shared assignee width
// (kept at the GBI default) so the assignee pill can render the full
// name + avatar pair again.
const DUE_DATE_COL_WIDTH  = 108;

const DUE_DATE_COLUMN = {
  key: 'dueDate',
  label: 'Due Date',
  popoverLabel: 'Due Date',
  width: DUE_DATE_COL_WIDTH,
  sortKey: '_sortDueDate',
  sortType: 'date',
  thStyle: { paddingLeft: 6, paddingRight: 6 },
};
// Inject Due Date immediately before the Assigned To column so the
// row reads: Priority · Name · Due Date · Assigned To · Adherence · Status.
function insertBefore(cols, key, col) {
  const i = cols.findIndex(c => c.key === key);
  if (i < 0) return [...cols, col];
  return [...cols.slice(0, i), col, ...cols.slice(i)];
}
const INTERVENTION_COLUMNS_WITH_DUE = insertBefore(INTERVENTION_COLUMNS, 'assignee', DUE_DATE_COLUMN);

// The one and only rule for the assignee avatar's color:
//   • Member (patient) → 'patient' variant (primary / purple)
//   • User   (staff)   → 'staff'   variant (secondary)
// Look up the assignee in the merged users+patients list (`role`
// field). Fall back to a `patients` name match so a member whose
// intervention has an isMemberTask override still lands in the
// patient bucket. Never guess by intervention kind — the identity
// is what colors the pill.
export function isMemberAssignee(name, users, patients) {
  if (!name || name === 'Unassigned') return false;
  const hit = (users || []).find(u => u.name === name);
  if (hit) return hit.role === 'Member';
  return (patients || []).some(p => p.name === name);
}
export function assigneeAvatarVariant(name, users, patients) {
  return isMemberAssignee(name, users, patients) ? 'patient' : 'staff';
}

// Who actually owns an intervention. Only Internal Task lets the user
// reassign — every other kind runs on the member, so the assignee is BY
// DESIGN the patient even when the row hasn't been backfilled yet.
function effectiveAssignee(i, patients, assigneeUsers) {
  const isMemberTask = i.kind !== 'internal-task';
  const memberRow = (patients || [])[0] || null;
  const rawName = i.assignee?.name || '';
  const rawInitials = i.assignee?.initials || '';
  const name = isMemberTask ? (memberRow?.name || rawName) : rawName;
  const initials = isMemberTask ? (memberRow?.initials || rawInitials) : rawInitials;
  return {
    isMemberTask,
    name,
    initials,
    // Member tasks always render the patient variant, even when the stored
    // name is still "Unassigned" (legacy data).
    avatarVariant: isMemberTask ? 'patient' : assigneeAvatarVariant(name, assigneeUsers, patients),
    // A member task is never truly unassigned — the patient owns it.
    unassigned: !isMemberTask && (!name || name === 'Unassigned'),
  };
}

export function CarePlanInterventionsTable({
  rows,
  canEdit,
  bulkMode,
  selectedIds,
  onSelectAll,
  onToggleSelect,
  onPriorityMenu,
  onStatusMenu,
  onRowMenu,
  onOpenIntervention,
  onAssigneeChange,
  // Persist a manual due-date override + the full recurrence config
  // (repeat toggle + count / every / ends fields) from the inline
  // popover. Both fall through to no-ops for read-only callers (the
  // date stays a plain read-only label in that case).
  onDueDateChange,
  onRecurrenceChange,
  // Notes icon → open the intervention drawer at its Note section.
  onOpenNotes,
  // (intervention) => boolean — whether it has a current (undeleted) note.
  hasNote,
  linked,
  platformUsers,
  // Merged into the inline picker so a member (patient) can be assigned
  // to an intervention from the row as well — matches the picker in the
  // Intervention drawer (Figma 8629:178).
  patients,
  template = false,
  emptyState,
}) {
  const [completedOpen, setCompletedOpen] = useState(false);
  // Inline due-date popover state — one popover shared by every row.
  // The active intervention plus the anchor rect drive positioning
  // and the seeded value in the calendar.
  const [duePicker, setDuePicker] = useState(null); // { intv, rect } | null
  const dueEditable = canEdit && !!onDueDateChange;
  const openDuePicker = (intv, rect) => {
    if (!dueEditable) return;
    setDuePicker({ intv, rect });
  };
  const commitDueDate = (iso) => {
    if (duePicker?.intv) onDueDateChange(duePicker.intv, iso);
    setDuePicker(null);
  };
  // A template row has no assignee, adherence or status, but it still gets
  // its row menu when the caller can act on one.
  const showActions = !template || Boolean(onRowMenu);
  const columns = useMemo(() => {
    if (template) {
      return withSelectColumn(
        INTERVENTION_COLUMNS_WITH_DUE.filter(c => c.key === 'priority' || c.key === 'title'
          || (showActions && c.key === 'actions')),
        bulkMode,
      );
    }
    return withSelectColumn(COMPACT_INTERVENTION_COLUMNS, bulkMode);
  }, [bulkMode, template, showActions]);

  const initialsOf = (name) => (name || '').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  // Merge platform users + patients so members can be assigned inline.
  // Each row picker mirrors the drawer's shape: staff avatar for users,
  // patient avatar (rounded, purple) for members.
  const assigneeUsers = useMemo(() => ([
    ...(platformUsers || []).map(u => ({
      id: u.id || `user:${u.name}`,
      name: u.name,
      initials: u.initials || initialsOf(u.name),
      role: u.role || 'User',
    })),
    ...(patients || []).map(p => ({
      id: p.id || `member:${p.name}`,
      name: p.name,
      initials: p.initials || initialsOf(p.name),
      role: 'Member',
      avatarVariant: 'patient',
    })),
  ]), [platformUsers, patients]);

  const sortableRows = useMemo(() => enrichInterventionRows(rows), [rows]);
  const { sorted, sortKey, sortDir, requestSort } = useTableSort(sortableRows, 'title', 'asc');

  // Met interventions collapse into "Completed Interventions".
  const { activeRows, completedRows } = useMemo(() => {
    if (template) return { activeRows: sorted, completedRows: [] };
    const active = [];
    const done = [];
    for (const i of sorted) (isCompletedStatus(i.status) ? done : active).push(i);
    return { activeRows: active, completedRows: done };
  }, [sorted, template]);

  const openRowMenu = (i, e) => onRowMenu({ kind: 'intv-menu', item: i, rect: e.currentTarget.getBoundingClientRect() });

  const renderPriority = (i) => (
    <td className={styles.priorityTd} onClick={e => e.stopPropagation()}>
      {canEdit ? (
        <button
          type="button"
          className={styles.priorityBtn}
          onClick={(e) => onPriorityMenu({ kind: 'intv', item: i, rect: e.currentTarget.getBoundingClientRect() })}
          aria-label="Change priority"
        >
          <PriorityIcon priority={i.priority} size={16} />
        </button>
      ) : (
        <PriorityIcon priority={i.priority} size={16} />
      )}
    </td>
  );

  // Look up the kind-based icon so rows stay in sync with the Add
  // Intervention menu (single source of truth) — legacy rows saved with a
  // stale `icon` still show the right glyph as long as `kind` is set.
  const kindIcon = (i) => CARE_PLAN_INTERVENTION_ICONS[i.kind] || i.icon || 'solar:clipboard-list-linear';

  const recurringGlyph = (i) => (i.config?.repeat ? (
    <Tooltip label={formatRecurrenceLabel(i)}>
      <span className={styles.recurringIcon} aria-label={formatRecurrenceLabel(i)}>
        <Icon name="solar:refresh-linear" size={14} color="var(--neutral-300)" />
      </span>
    </Tooltip>
  ) : null);

  // Library templates keep their original row: start + duration subline,
  // link button in the name cell, menu only.
  const renderTemplateRow = (i) => {
    const start = parseCarePlanDate(i.createdAt);
    const dur = formatDurationLabel(i);
    const bits = [start && `Started ${fmtDate(start)}`, dur].filter(Boolean);
    return (
      <tr
        key={i.id}
        data-cp-row-id={i.id}
        className={`${styles.row} ${styles.rowClickable} ${styles.gbiRow}`}
        onClick={() => onOpenIntervention(i)}
      >
        {bulkMode && (
          <GbiCheckboxCell
            checked={selectedIds.includes(i.id)}
            onToggle={() => onToggleSelect(i.id)}
            label={`Select ${i.title}`}
            disabled={!canEdit}
          />
        )}
        {renderPriority(i)}
        <td className={styles.titleTd}>
          <GbiNameCell
            icon={kindIcon(i)}
            iconTitle={KIND_LABELS[i.kind] || 'Intervention'}
            title={i.title}
            meta={bits.length ? <span className={styles.intvSubMeta}>{bits.join(' · ')}</span> : null}
            layout="stacked"
            linked={linked(i)}
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
              onClick={(e) => openRowMenu(i, e)}
            />
          </td>
        )}
      </tr>
    );
  };

  const renderRow = (i, _idx, ctx) => {
    if (template) return renderTemplateRow(i);
    const hidden = ctx?.hiddenSet || null;
    const isHidden = (k) => (hidden ? hidden.has(k) : false);
    const owner = effectiveAssignee(i, patients, assigneeUsers);
    const due = computeDueDate(i);
    const dueDate = (prefix) => (
      <GbiMetaDate
        label={prefix}
        noun="due date"
        value={due.iso}
        emptyLabel="No due date"
        status={i.status}
        editable={dueEditable}
        onEdit={(rect) => openDuePicker(i, rect)}
        trailing={recurringGlyph(i)}
      />
    );
    // A column the user switched on carries the value, so the meta line
    // drops its copy rather than show it twice.
    const ownerLabel = owner.unassigned ? 'Unassigned' : `Assigned to ${owner.name || 'Member'}`;
    const meta = (
      <GbiMetaLine
        segments={[
          isHidden('dueDate') && { key: 'due', node: dueDate('Due') },
          isHidden('assignee') && {
            key: 'owner',
            node: (
              <span className={`${styles.metaText} ${owner.unassigned ? styles.metaDateEmpty : ''}`}>
                {ownerLabel}
              </span>
            ),
          },
        ]}
      />
    );
    return (
      <tr
        key={i.id}
        data-cp-row-id={i.id}
        className={`${styles.row} ${styles.rowClickable} ${styles.gbiRow}`}
        onClick={() => onOpenIntervention(i)}
      >
        {bulkMode && (
          <GbiCheckboxCell
            checked={selectedIds.includes(i.id)}
            onToggle={() => onToggleSelect(i.id)}
            label={`Select ${i.title}`}
            disabled={!canEdit}
          />
        )}
        {!isHidden('priority') && renderPriority(i)}
        <td className={styles.titleTd}>
          <GbiNameCell
            icon={kindIcon(i)}
            iconTitle={KIND_LABELS[i.kind] || 'Intervention'}
            title={i.title}
            meta={meta}
            layout="stacked"
            showLink={false}
          />
        </td>
        {!isHidden('dueDate') && (
          <td className={styles.valueTd} onClick={e => e.stopPropagation()}>
            <span className={styles.metaLine}>{dueDate('')}</span>
          </td>
        )}
        {!isHidden('assignee') && (
          <td className={styles.assigneeTd} onClick={e => e.stopPropagation()}>
            {/* Member tasks lock the picker so the patient stays the owner. */}
            <AssigneeChange
              size="S"
              fillContainer
              name={owner.name || (owner.isMemberTask ? 'Member' : undefined)}
              initials={owner.initials}
              ariaLabel={owner.unassigned ? 'Assign' : owner.name}
              unassigned={owner.unassigned}
              users={assigneeUsers}
              avatarVariant={owner.avatarVariant}
              pickerTitle="Change assignee"
              onSelect={(u) => onAssigneeChange(i, u)}
              disabled={!canEdit || owner.isMemberTask}
            />
          </td>
        )}
        {!isHidden('adherence') && (
          <td className={styles.adherenceTd} onClick={e => e.stopPropagation()}>
            <GbiProgressCell progress={i.adherence} />
          </td>
        )}
        <td className={styles.statusTd} onClick={e => e.stopPropagation()}>
          <GbiStatusButton
            value={i.status}
            disabled={!canEdit}
            onOpen={rect => onStatusMenu({ kind: 'intv', item: i, rect })}
          />
        </td>
        <td className={`${styles.actionsTd} ${styles.actionsWide}`} onClick={e => e.stopPropagation()}>
          <GbiRowActions
            linked={linked(i)}
            hasNote={!!hasNote?.(i)}
            onNotes={() => onOpenNotes?.(i)}
            onMenu={(e) => openRowMenu(i, e)}
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
        columns={columns}
        rows={activeRows}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={requestSort}
        selectedIds={selectedIds}
        onSelectAll={onSelectAll}
        minTableWidth={0}
        emptyState={noActive ? <div className={styles.emptyRow}>No open interventions.</div> : emptyState}
        // v2: the compact grid changed which columns exist and default.
        worklistKey={template ? undefined : 'carePlan:interventions:v2'}
        renderRow={renderRow}
        renderTbodyFooter={template ? undefined : (ctx) => (
          <CompletedRowsGroup
            label="Completed Interventions"
            rows={completedRows}
            open={completedOpen}
            onToggle={() => setCompletedOpen(v => !v)}
            colSpan={ctx.colSpan}
            renderRow={renderRow}
            ctx={ctx}
          />
        )}
      />
      {duePicker && (
        <DatePickerPopover
          open
          value={toPickerValue(computeDueDate(duePicker.intv).iso)}
          anchorRect={duePicker.rect}
          onChange={commitDueDate}
          onClose={() => setDuePicker(null)}
          highlightedDates={computeOccurrenceDates(duePicker.intv)}
          footer={(
            <RepeatEditor
              value={{
                repeat: !!duePicker.intv?.config?.repeat,
                repeatCount: duePicker.intv?.config?.repeatCount ?? '1',
                repeatEvery: duePicker.intv?.config?.repeatEvery ?? '1',
                repeatEveryUnit: duePicker.intv?.config?.repeatEveryUnit || 'Weeks',
                repeatEnds: duePicker.intv?.config?.repeatEnds ?? '0',
                repeatEndsUnit: duePicker.intv?.config?.repeatEndsUnit || 'Days',
              }}
              onChange={(next) => {
                if (onRecurrenceChange) onRecurrenceChange(duePicker.intv, next);
                setDuePicker(prev => prev ? ({
                  ...prev,
                  intv: {
                    ...prev.intv,
                    config: { ...(prev.intv.config || {}), ...next },
                  },
                }) : prev);
              }}
            />
          )}
        />
      )}
    </div>
  );
}

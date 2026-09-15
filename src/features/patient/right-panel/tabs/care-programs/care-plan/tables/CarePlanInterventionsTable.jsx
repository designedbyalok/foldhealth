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
  GBI_COL_WIDTH,
} from './carePlanTableShared';
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
function fmtDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
}
// Due date = user-picked override when present, else createdAt +
// parsed duration. When neither is set we now fall back to
// createdAt + 30 days so the column always shows a real date
// (matches the seed the save handler writes to the DB). Returns
// { iso, formatted } so the calendar can seed itself and the cell
// has a display string in one call.
function computeDueDate(intv) {
  const override = intv?.config?.dueDateOverride;
  if (override) {
    const d = new Date(override);
    if (!Number.isNaN(d.getTime())) return { iso: d.toISOString(), formatted: fmtDate(d.toISOString()) };
  }
  const start = intv?.createdAt ? new Date(intv.createdAt) : new Date();
  if (Number.isNaN(start.getTime())) return { iso: null, formatted: null };
  const raw = intv.config?.dueOffset != null && intv.config?.dueUnit
    ? `${intv.config.dueOffset}${String(intv.config.dueUnit)[0]}`
    : intv.duration;
  const m = raw && String(raw).trim().match(/^(\d+)\s*([dwmy])$/i);
  const end = new Date(start);
  if (m) {
    const n = Number(m[1]);
    const unit = m[2].toLowerCase();
    if (unit === 'd') end.setDate(end.getDate() + n);
    else if (unit === 'w') end.setDate(end.getDate() + n * 7);
    else if (unit === 'm') end.setMonth(end.getMonth() + n);
    else if (unit === 'y') end.setFullYear(end.getFullYear() + n);
  } else {
    end.setDate(end.getDate() + 30);
  }
  return { iso: end.toISOString(), formatted: fmtDate(end.toISOString()) };
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
function computeOccurrenceDates(intv) {
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
function formatRecurrenceLabel(intv) {
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
  // cell stays a plain read-only label in that case).
  onDueDateChange,
  onRecurrenceChange,
  linked,
  platformUsers,
  // Merged into the inline picker so a member (patient) can be assigned
  // to an intervention from the row as well — matches the picker in the
  // Intervention drawer (Figma 8629:178).
  patients,
  template = false,
  emptyState,
}) {
  // Inline due-date popover state — one popover shared by every row.
  // The active intervention plus the anchor rect drive positioning
  // and the seeded value in the calendar.
  const [duePicker, setDuePicker] = useState(null); // { intv, rect } | null
  const openDuePicker = (intv, rect) => {
    if (!canEdit || !onDueDateChange) return;
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
    return withSelectColumn(INTERVENTION_COLUMNS_WITH_DUE, bulkMode);
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

  return (
    <div className={styles.tableWrap}>
      <WorklistShell
        embedded
        embeddedNoScroll
        header={null}
        hideBulkBar
        columns={columns}
        rows={sorted}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={requestSort}
        selectedIds={selectedIds}
        onSelectAll={onSelectAll}
        minTableWidth={0}
        emptyState={emptyState}
        worklistKey={template ? undefined : 'carePlan:interventions'}
        renderRow={(i, _idx, ctx) => {
          const hidden = ctx?.hiddenSet || null;
          const isHidden = (k) => (hidden ? hidden.has(k) : false);
          return (
            <tr
              key={i.id}
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
              {!isHidden('priority') && (
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
              )}
              {!isHidden('title') && (
              <td className={styles.titleTd}>
                <GbiNameCell
                  // Look up the kind-based icon so rows stay in sync with
                  // the Add Intervention menu (single source of truth) —
                  // legacy rows saved with a stale `icon` still show the
                  // right glyph as long as `kind` is set.
                  icon={CARE_PLAN_INTERVENTION_ICONS[i.kind] || i.icon || 'solar:clipboard-list-linear'}
                  iconTitle={KIND_LABELS[i.kind] || 'Intervention'}
                  // Recurring glyph moved to the Due Date cell so
                  // schedule + cadence read together in one column.
                  title={i.title}
                  /* Start date + duration read below the title in a
                     stacked layout: "Started 03/20/2026 · 1 week". Font
                     size is 12px (--font-sm) from the shared
                     .nameSecondary rule; the muted class overrides the
                     default neutral-300 with grey200 per spec. */
                  meta={(() => {
                    const start = fmtDate(i.createdAt);
                    const dur = formatDurationLabel(i);
                    const bits = [];
                    if (start) bits.push(`Started ${start}`);
                    if (dur) bits.push(dur);
                    if (bits.length === 0) return null;
                    return <span className={styles.intvSubMeta}>{bits.join(' · ')}</span>;
                  })()}
                  layout="stacked"
                  linked={linked(i)}
                  canEdit={canEdit}
                  />
              </td>
              )}
              {!template && !isHidden('dueDate') && (() => {
                /* Due Date cell — click opens an inline calendar
                   popover. Recurring glyph sits next to the date so
                   cadence + schedule read as one column; hover
                   reveals the composed "Repeats every N weeks · X
                   times · ends in Y months" tooltip. */
                const due = computeDueDate(i);
                const dueLabel = due.formatted || '-';
                const dueIso = due.iso || '';
                const isRecurring = !!i.config?.repeat;
                const editable = canEdit && !!onDueDateChange;
                return (
                  <td className={styles.valueTd} onClick={e => e.stopPropagation()}>
                    <span className={styles.dueDateCell}>
                      {editable ? (
                        <button
                          type="button"
                          className={styles.dateBtn}
                          onClick={(e) => openDuePicker(i, e.currentTarget.getBoundingClientRect())}
                          aria-label={dueIso ? `Change due date (${dueLabel})` : 'Set due date'}
                        >
                          {dueLabel}
                        </button>
                      ) : (
                        <span className={styles.dueDateText}>{dueLabel}</span>
                      )}
                      {isRecurring && (
                        <Tooltip label={formatRecurrenceLabel(i)}>
                          <span className={styles.recurringIcon} aria-label={formatRecurrenceLabel(i)}>
                            <Icon name="solar:refresh-linear" size={14} color="var(--neutral-300)" />
                          </span>
                        </Tooltip>
                      )}
                    </span>
                  </td>
                );
              })()}
              {!template && (() => {
                // Only Internal Task lets the user reassign — every
                // other intervention kind runs on the member and the
                // assignee is BY DESIGN the patient, even if the row
                // hasn't been backfilled yet. In that case we force
                // the member's identity + patient variant + `unassigned=
                // false`, so the pill never renders as the generic
                // outlined-person icon on a member task.
                const isMemberTask = i.kind !== 'internal-task';
                const memberRow = (patients || [])[0] || null;
                const rawName = i.assignee?.name || '';
                const rawInitials = i.assignee?.initials || '';
                const effectiveName = isMemberTask
                  ? (memberRow?.name || rawName)
                  : rawName;
                const effectiveInitials = isMemberTask
                  ? (memberRow?.initials || rawInitials)
                  : rawInitials;
                // Member tasks are always the member — force patient
                // variant even if the row's name field is still
                // "Unassigned" (legacy data). Internal tasks derive
                // from actual identity.
                const avatarVariant = isMemberTask
                  ? 'patient'
                  : assigneeAvatarVariant(effectiveName, assigneeUsers, patients);
                // Same rule: a member task is never truly unassigned —
                // the patient owns it — so the AssigneeChange pill
                // must not render the unassigned generic state on
                // those rows.
                const showAsUnassigned = !isMemberTask
                  && (!effectiveName || effectiveName === 'Unassigned');
                return (
                <>
                  {!isHidden('assignee') && (
                  <td className={styles.assigneeTd} onClick={e => e.stopPropagation()}>
                    {/* Full pill — avatar + name — matches the earlier
                        Assigned To column. Member tasks still lock the
                        picker so the patient stays the owner. */}
                    <AssigneeChange
                      size="S"
                      fillContainer
                      name={effectiveName || (isMemberTask ? 'Member' : undefined)}
                      initials={effectiveInitials}
                      ariaLabel={showAsUnassigned ? 'Assign' : effectiveName}
                      unassigned={showAsUnassigned}
                      users={assigneeUsers}
                      avatarVariant={avatarVariant}
                      pickerTitle="Change assignee"
                      onSelect={(u) => onAssigneeChange(i, u)}
                      disabled={!canEdit || isMemberTask}
                    />
                  </td>
                  )}
                  {!isHidden('adherence') && (
                  <td className={styles.adherenceTd} onClick={e => e.stopPropagation()}>
                    <GbiProgressCell progress={i.adherence} />
                  </td>
                  )}
                  {!isHidden('status') && (
                  <td className={styles.statusTd} onClick={e => e.stopPropagation()}>
                    <GbiStatusButton
                      value={i.status}
                      disabled={!canEdit}
                      onOpen={rect => onStatusMenu({ kind: 'intv', item: i, rect })}
                    />
                  </td>
                  )}
                </>
                );
              })()}
              {showActions && (
                <td className={styles.actionsTd} onClick={e => e.stopPropagation()}>
                  <ActionButton
                    icon="solar:menu-dots-linear"
                    size="S"
                    tooltip="More"
                    tooltipBelow
                    tooltipLeft
                    disabled={!template && !canEdit}
                    onClick={(e) => onRowMenu({ kind: 'intv-menu', item: i, rect: e.currentTarget.getBoundingClientRect() })}
                  />
                </td>
              )}
            </tr>
          );
        }}
      />
      {duePicker && (
        <DatePickerPopover
          open
          value={(() => {
            const iso = computeDueDate(duePicker.intv).iso;
            if (!iso) return null;
            const d = new Date(iso);
            if (Number.isNaN(d.getTime())) return null;
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
          })()}
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

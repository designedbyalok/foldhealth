import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DrawerDockContext } from '@/components/Drawer/drawerDock';
import { Icon } from '../../../../../../../../components/Icon/Icon';
import { CollapsibleContent } from '../../../../../../../../components/Collapsible/Collapsible';
import { Badge } from '../../../../../../../../components/Badge/Badge';
import { Avatar } from '../../../../../../../../components/Avatar/Avatar';
import { Button } from '../../../../../../../../components/Button/Button';
import { CloseButton } from '../../../../../../../../components/CloseButton/CloseButton';
import { Drawer } from '../../../../../../../../components/Drawer/Drawer';
import { HeaderCell } from '../../../../../../../../components/HeaderCell/HeaderCell';
import { ActivityLog } from '../../../../../../../../components/ActivityLog/ActivityLog';
import { DownChevronIcon } from '../../../../../../../../components/Icon/DownChevronIcon';
import { PriorityIcon } from '../../../../../../../../components/PriorityIcon/PriorityIcon';
import { EmptyState } from '../../../../../../../../components/EmptyState/EmptyState';
import { TableSkeleton } from '../../../../../../../../components/TableSkeleton/TableSkeleton';
import { WorklistShell } from '../../../../../../../worklists/WorklistShell';
import { MenuPopover } from '../../../../../../../../components/MenuPopover/MenuPopover';
import { ActionButton } from '../../../../../../../../components/ActionButton/ActionButton';
import { AddIconMinimalist } from '../../../../../../../../components/Icon/AddIconMinimalist';
import { CarePlanRollupAdd } from '../CarePlanRollupAdd';
import { AssigneeChange } from '../../../../../../../../components/AssigneeChange/AssigneeChange';
import { useTableSort } from '../../../../../../../../components/HeaderCell/useTableSort';
import { useAppStore } from '../../../../../../../../store/useAppStore';
import { buildCarePlanSnapshot, filterCarePlanSnapshot } from '../carePlanSnapshot';
import { AiSummaryCard, AiSummarySkeleton } from '../CarePlanAiSummary/CarePlanAiSummary';
import { buildSummaryPayload, useCarePlanAiSummary } from '../CarePlanAiSummary/useCarePlanAiSummary';
import {
  GbiNameCell,
  GbiProgressCell,
  GbiStatusButton,
  GBI_COL_WIDTH,
  GOAL_COLUMNS,
  INTERVENTION_COLUMNS,
  BARRIER_COLUMNS,
  gbiStatusMenuItems,
} from '../../tables/carePlanTableShared';
import { fmtCarePlanDate, isCompletedStatus } from '../../tables/carePlanTableModel';
import { enrichGoalRows, enrichInterventionRows } from '../../tables/carePlanTableSort';
import { CARE_PLAN_INTERVENTION_ICONS } from '../../lib/carePlanInterventionMenu';
import { assigneeAvatarVariant, computeDueDate } from '../../tables/CarePlanInterventionsTable';
import { KIND_LABELS } from '../../../../../../../settings/care-plan-library/interventions/shared/interventionKinds';
import { normalizeCategory, goalCategoryIcon } from '../../../../../../../settings/care-plan-library/lib';
import { GoalPreviewDrawer } from '../../drawers/GoalPreviewDrawer/GoalPreviewDrawer';
import { InterventionPreviewDrawer } from '../../drawers/InterventionPreviewDrawer/InterventionPreviewDrawer';
import { BarrierDetailDrawer } from '../../drawers/BarrierDetailDrawer/BarrierDetailDrawer';
import sharedRow from '../../tables/carePlanTables.module.css';
import styles from './CarePlanSummaryView.module.css';
import { localDateMs } from '../../../../../../../../lib/localDate';
import { useSignedCarePlans } from '../../lib/useSignedCarePlans';
import { CarePlanSummaryStrip } from '../../CarePlanView/CarePlanSummaryStrip';
import { AllProgramsFocus } from '../AllProgramsFocus/AllProgramsFocus';
import { allProgramsPlanState } from '../allProgramsPlan';
import { isProgramClosed } from '../../../../../../data/programStatus';
import { isEmptyDash } from '../../../../../../../../lib/emptyDash';
import { latestPlanNote } from '../../lib/carePlanNotes';
import { SegmentedControl } from '../../../../../../../../components/SegmentedControl/SegmentedControl';
import { confirmStatusChange, statusReasonPatch } from '../../lib/confirmStatusChange';

const PRIORITIES = ['high', 'medium', 'low'];
// Wide enough, an open item docks beside the tables (as in a program's plan).
const DOCK_MIN_WIDTH = 1080;
const dueOf = i => computeDueDate(i);

// Person cell: shared Avatar primitive + name, so PCM / PCP renders
// the way every other assignee cell in the app does (matches the
// Fold design system rather than a bespoke user glyph).
function PersonCell({ name, fallback = 'Unassigned' }) {
  if (!name) return <span className={styles.programMuted}>{fallback}</span>;
  const initials = name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <span className={styles.programPerson}>
      <Avatar variant="assignee" size="XS" initials={initials} />
      <span className={styles.programPersonName} title={name}>{name}</span>
    </span>
  );
}

// Active Programs Summary table: one row per enrolled program that
// has a care plan. Plan (first column) and Actions (last column) are
// sticky so the middle columns can scroll horizontally on narrow
// panes. Read-only surface; interactions are limited to View Plan +
// clicking the Activity Since Review cell to open the drawer.
function ActiveProgramsTable({ rows, onView, onOpenActivity }) {
  return (
    <div className={styles.programsTableWrap}>
      <table className={styles.programsTable}>
        <thead>
          <tr>
            <HeaderCell label="Plan"                 className={`${styles.stickyLeft} ${styles.colPlan}`} />
            <HeaderCell label="Conditions / Focus"   className={styles.colConditions} />
            <HeaderCell label="Started-Ends"         className={styles.colDates} />
            <HeaderCell label="PCM"                  className={styles.colPerson} />
            <HeaderCell label="PCP"                  className={styles.colPerson} />
            <HeaderCell label="Last Reviewed"        className={styles.colReview} />
            <HeaderCell label="Activity Since Review" className={styles.colActivity} />
            <HeaderCell label="Actions"              className={`${styles.stickyRight} ${styles.colActions}`} />
          </tr>
        </thead>
        <tbody>
          {rows.map(p => {
            const conditionsList = p.conditionsList || [];
            const firstCondition = conditionsList[0] || null;
            const extraConditions = Math.max(conditionsList.length - 1, 0);
            const range = isEmptyDash(p.startDateFmt) && isEmptyDash(p.endDateFmt)
              ? '-'
              : `${p.startDateFmt} - ${p.endDateFmt}`;
            const activityCount = (p.sinceReviewEntries || []).length;
            return (
              <tr key={p.id}>
                <td className={`${styles.stickyLeft} ${styles.colPlan}`}>
                  <Badge size="sm" label={p.code} />
                </td>
                <td>
                  {firstCondition ? (
                    <span className={styles.conditionCell} title={conditionsList.join(', ')}>
                      <span className={styles.conditionName}>{firstCondition}</span>
                      {extraConditions > 0 && (
                        <Badge size="sm" label={`+${extraConditions}`} />
                      )}
                    </span>
                  ) : (
                    <span className={styles.programMuted}>-</span>
                  )}
                </td>
                <td className={styles.programDates}>{range}</td>
                <td><PersonCell name={p.pcmName} /></td>
                <td><PersonCell name={p.pcpName} fallback="-" /></td>
                <td>
                  <div className={styles.programReview}>
                    <span>{p.lastReviewed}</span>
                    {p.lastReviewedBy && <span className={styles.programMuted}>by {p.lastReviewedBy}</span>}
                  </div>
                </td>
                <td className={styles.programWrap}>
                  {activityCount > 0 ? (
                    <button
                      type="button"
                      className={styles.activityLink}
                      onClick={() => onOpenActivity?.(p)}
                      aria-label={`Open activity since last review for ${p.name || p.code}`}
                    >
                      {p.activitySummary}
                    </button>
                  ) : (
                    <span className={styles.programMuted}>-</span>
                  )}
                </td>
                <td className={`${styles.stickyRight} ${styles.colActions}`}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onView?.(p)}
                    disabled={!onView}
                  >
                    View Plan
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Drawer that lists every audit event on a plan since its last review
// stamp (Figma Care-Plan-Creation 12369-276180). Renders through the
// shared ActivityLog primitive so the entries look identical to the
// GBI preview drawers' timelines. Read-only; the reader just needs
// to see what has happened while they were away.
function ActivityReviewDrawer({ target, onClose }) {
  const entries = (target?.sinceReviewEntries || []).map(a => {
    const created = a.createdAt ? new Date(a.createdAt) : null;
    return {
      id: a.id,
      t: 'default',
      date: created ? created.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null,
      time: created ? created.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null,
      by: a.actor || null,
      title: a.summary || a.action || 'Update',
      commentBody: a.detail || null,
      createdAt: a.createdAt,
    };
  });
  return (
    <Drawer
      title={`Activity Since Review${target?.code ? `, ${target.code}` : ''}`}
      onClose={onClose}
      headerRight={target?.lastReviewed ? (
        <span className={styles.drawerMeta}>Last reviewed {target.lastReviewed}{target.lastReviewedBy ? ` · by ${target.lastReviewedBy}` : ''}</span>
      ) : null}
    >
      <div className={styles.activityDrawerBody}>
        <ActivityLog entries={entries} emptyLabel="No activity since the last review." />
      </div>
    </Drawer>
  );
}

// Goals/Interventions/Barriers section head: matches the CarePlanView's GBI
// treatment (chevron + title + count pill). The read-only roll-up has no Add;
// the editable one (care_plan_mode = 'both') passes `onAdd`, which asks for
// the owning program first.
function SectionHead({ title, count, open, onToggle, onAdd }) {
  const toggle = (
    <button type="button" className={styles.sectionHead} onClick={onToggle} aria-expanded={open}>
      <DownChevronIcon
        size={16}
        color="var(--neutral-400)"
        className={`${styles.sectionChevron} ${open ? '' : styles.sectionChevronClosed}`}
      />
      <span className={styles.sectionTitle}>{title}</span>
      {count > 0 ? <span className={styles.sectionCount}>{count}</span> : null}
    </button>
  );
  if (!onAdd) return toggle;
  return (
    <div className={styles.sectionHeadRow}>
      {toggle}
      <span className={styles.sectionActionDivider} aria-hidden="true" />
      <ActionButton size="sm" tooltip={`Add ${title.toLowerCase().replace(/s$/, '')}`} onClick={e => onAdd(e.currentTarget.getBoundingClientRect())}>
        <AddIconMinimalist size={16} color="var(--neutral-300)" />
      </ActionButton>
    </div>
  );
}

// Care Plan column: injected before Status in each table so every row
// tells you which program owns it. Sort by the row's `programCode` tag.
const HEADER_COMPACT = { paddingLeft: 6, paddingRight: 6 };
const CARE_PLAN_COLUMN = {
  key: 'carePlan',
  label: 'Program',
  width: 100,
  sortKey: 'programCode',
  sortType: 'alpha',
  thStyle: HEADER_COMPACT,
};

const insertBefore = (cols, key, col) => {
  const i = cols.findIndex(c => c.key === key);
  if (i < 0) return [...cols, col];
  return [...cols.slice(0, i), col, ...cols.slice(i)];
};

const stripActions = (cols) => cols.filter(c => c.key !== 'actions');

// Due Date column: matches the per-plan CarePlanInterventionsTable
// injection (inserted immediately before Assigned To), so the
// Comprehensive interventions grid reads: P · Name · Due Date ·
// Assigned To · Adherence · Program · Status.
const SUMMARY_DUE_DATE_COLUMN = {
  key: 'dueDate',
  label: 'Due Date',
  width: 108,
  sortKey: '_sortDueDate',
  sortType: 'date',
  thStyle: HEADER_COMPACT,
};

const colByKey = (cols, key) => cols.find(c => c.key === key);

// Declare the Comprehensive Goals / Interventions columns explicitly rather
// than reusing every GBI column: the body renders a compact metric set
// (Progress for goals, Adherence for interventions) plus a Program tag, so a
// literal list keeps the header aligned with the body. The sticky `actions`
// column is kept: it is where WorklistShell mounts the column picker button.
// Progress and Adherence carry `defaultHidden` from the shared defs, so both
// start hidden and users opt in through the picker.
const SUMMARY_GOAL_COLUMNS = [
  colByKey(GOAL_COLUMNS, 'priority'),
  colByKey(GOAL_COLUMNS, 'title'),
  colByKey(GOAL_COLUMNS, 'createdDate'),
  colByKey(GOAL_COLUMNS, 'targetDate'),
  colByKey(GOAL_COLUMNS, 'progress'),
  CARE_PLAN_COLUMN,
  colByKey(GOAL_COLUMNS, 'status'),
  colByKey(GOAL_COLUMNS, 'actions'),
];
const SUMMARY_INTERVENTION_COLUMNS = [
  colByKey(INTERVENTION_COLUMNS, 'priority'),
  colByKey(INTERVENTION_COLUMNS, 'title'),
  SUMMARY_DUE_DATE_COLUMN,
  colByKey(INTERVENTION_COLUMNS, 'assignee'),
  colByKey(INTERVENTION_COLUMNS, 'adherence'),
  CARE_PLAN_COLUMN,
  colByKey(INTERVENTION_COLUMNS, 'status'),
  colByKey(INTERVENTION_COLUMNS, 'actions'),
];
const SUMMARY_BARRIER_COLUMNS = insertBefore(stripActions(BARRIER_COLUMNS), 'status', CARE_PLAN_COLUMN);

// Program cell: first programCode as a badge, plus a `+N` badge
// when the same title also appears on other programs in the current
// filtered snapshot. Keeps each row's own program identity intact
// while surfacing cross-program overlap ("SNP +1") in one glance.
function ProgramCell({ code, overlap }) {
  const extra = Math.max((overlap || 1) - 1, 0);
  return (
    <span className={styles.programBadgeStack}>
      <Badge size="sm" label={code} />
      {extra > 0 && <Badge size="sm" label={`+${extra}`} />}
    </span>
  );
}

// Build a "title (lowercased) → number of distinct programCodes"
// map for a filtered row set. Fuels ProgramCell's overlap badge.
function buildProgramOverlap(rows) {
  const acc = new Map();
  for (const r of rows || []) {
    const key = (r?.title || '').trim().toLowerCase();
    if (!key || !r?.programCode) continue;
    if (!acc.has(key)) acc.set(key, new Set());
    acc.get(key).add(r.programCode);
  }
  const out = new Map();
  for (const [k, v] of acc) out.set(k, v.size);
  return out;
}
const overlapFor = (map, row) => (map?.get((row?.title || '').trim().toLowerCase()) || 1);

// Collapse rows that share a normalized title down to one representative
// so the Comprehensive Care Plan lists each goal / intervention / barrier
// once, even when the same item lives on multiple programs. The
// ProgramCell's "+N" badge (computed from the full set before dedup)
// still tells the reader it spans programs.
function dedupeByTitle(rows) {
  const seen = new Set();
  const out = [];
  for (const r of rows || []) {
    const key = (r?.title || '').trim().toLowerCase();
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    out.push(r);
  }
  return out;
}

function fmtMMDDYYYY(v) {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '-';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}/${dd}/${d.getFullYear()}`;
}

function GoalsTable({ rows, onOpen, onPriorityMenu, onStatusMenu, programOverlap }) {
  const sortable = useMemo(() => enrichGoalRows(rows), [rows]);
  const { sorted, sortKey, sortDir, requestSort } = useTableSort(sortable, 'title', 'asc');
  return (
    <div className={sharedRow.tableWrap}>
      <WorklistShell
        embedded
        embeddedNoScroll
        header={null}
        hideBulkBar
        columns={SUMMARY_GOAL_COLUMNS}
        rows={sorted}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={requestSort}
        minTableWidth={0}
        worklistKey="carePlan:summaryGoals"
        emptyState={<div className={styles.emptyRow}>No goals match.</div>}
        renderRow={(g, _idx, ctx) => {
          const hidden = ctx?.hiddenSet || null;
          const isHidden = (k) => (hidden ? hidden.has(k) : false);
          return (
          <tr
            key={`${g.programCode}-${g.id}`}
            className={`${sharedRow.row} ${sharedRow.rowClickable} ${sharedRow.gbiRow}`}
            onClick={() => onOpen(g)}
          >
            {!isHidden('priority') && (
            <td className={sharedRow.priorityTd} onClick={e => e.stopPropagation()}>
              {onPriorityMenu ? (
                <button
                  type="button"
                  className={sharedRow.priorityBtn}
                  aria-label="Change priority"
                  onClick={(e) => onPriorityMenu({ kind: 'goal', item: g, rect: e.currentTarget.getBoundingClientRect() })}
                >
                  <PriorityIcon priority={g.priority} size={16} />
                </button>
              ) : (
                <PriorityIcon priority={g.priority} size={16} />
              )}
            </td>
            )}
            <td className={sharedRow.titleTd}>
              <GbiNameCell
                icon={goalCategoryIcon(g.category)}
                iconTitle={g.category ? normalizeCategory(g.category) : 'Goal'}
                title={g.title}
                meta={g.subtitle || null}
                layout="stacked"
              />
            </td>
            {!isHidden('createdDate') && (
            <td className={sharedRow.dateTd} onClick={e => e.stopPropagation()}>
              <span className={sharedRow.dueDateText}>{fmtMMDDYYYY(g.createdAt)}</span>
            </td>
            )}
            {!isHidden('targetDate') && (
            <td className={sharedRow.dateTd} onClick={e => e.stopPropagation()}>
              <span className={sharedRow.dueDateText}>{fmtCarePlanDate(g.targetDate) || 'No target date'}</span>
            </td>
            )}
            {!isHidden('progress') && (
            <td className={sharedRow.progressTd} onClick={e => e.stopPropagation()}>
              <GbiProgressCell progress={g.progress} />
            </td>
            )}
            {!isHidden('carePlan') && (
            <td className={sharedRow.assigneeTd} onClick={e => e.stopPropagation()}>
              <ProgramCell code={g.programCode} overlap={overlapFor(programOverlap, g)} />
            </td>
            )}
            <td className={sharedRow.statusTd} onClick={e => e.stopPropagation()}>
              <GbiStatusButton
                value={g.status} reason={g.statusReason}
                disabled={!onStatusMenu}
                onOpen={rect => onStatusMenu?.({ kind: 'goal', item: g, rect })}
              />
            </td>
            <td className={sharedRow.actionsTd} aria-hidden="true" />
          </tr>
          );
        }}
      />
    </div>
  );
}

function InterventionsTable({ rows, onOpen, onPriorityMenu, onStatusMenu, onAssigneeChange, patients, platformUsers, programOverlap }) {
  const sortable = useMemo(() => enrichInterventionRows(rows), [rows]);
  const { sorted, sortKey, sortDir, requestSort } = useTableSort(sortable, 'title', 'asc');
  const initialsOf = (name) => (name || '').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  // Merge platform users + patients so members can be assigned inline.
  // Each row picker mirrors the per-plan InterventionsTable shape: staff
  // avatar for users, patient avatar (rounded, purple) for members.
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
  return (
    <div className={sharedRow.tableWrap}>
      <WorklistShell
        embedded
        embeddedNoScroll
        header={null}
        hideBulkBar
        columns={SUMMARY_INTERVENTION_COLUMNS}
        rows={sorted}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={requestSort}
        minTableWidth={0}
        worklistKey="carePlan:summaryInterventions"
        emptyState={<div className={styles.emptyRow}>No interventions match.</div>}
        renderRow={(i, _idx, ctx) => {
          const hidden = ctx?.hiddenSet || null;
          const isHidden = (k) => (hidden ? hidden.has(k) : false);
          // Only Internal Task lets the user reassign, every other
          // intervention kind runs on the member and the assignee stays
          // locked to them. Fall back to the plan's patient when a
          // legacy row is still 'Unassigned' so the column reads
          // correctly without a data backfill (matches the per-plan
          // InterventionsTable behavior).
          const isMemberTask = i.kind !== 'internal-task';
          const memberRow = (patients || [])[0] || null;
          const effectiveName = isMemberTask
            ? (memberRow?.name || i.assignee?.name)
            : (i.assignee?.name || '');
          const effectiveInitials = isMemberTask
            ? (memberRow?.initials || i.assignee?.initials)
            : (i.assignee?.initials || '');
          const avatarVariant = assigneeAvatarVariant(effectiveName, assigneeUsers, patients);
          return (
            <tr
              key={`${i.programCode}-${i.id}`}
              className={`${sharedRow.row} ${sharedRow.rowClickable} ${sharedRow.gbiRow}`}
              onClick={() => onOpen(i)}
            >
              {!isHidden('priority') && (
              <td className={sharedRow.priorityTd} onClick={e => e.stopPropagation()}>
                {onPriorityMenu ? (
                  <button
                    type="button"
                    className={sharedRow.priorityBtn}
                    aria-label="Change priority"
                    onClick={(e) => onPriorityMenu({ kind: 'intv', item: i, rect: e.currentTarget.getBoundingClientRect() })}
                  >
                    <PriorityIcon priority={i.priority} size={16} />
                  </button>
                ) : (
                  <PriorityIcon priority={i.priority} size={16} />
                )}
              </td>
              )}
              <td className={sharedRow.titleTd}>
                <GbiNameCell
                  icon={CARE_PLAN_INTERVENTION_ICONS[i.kind] || i.icon || 'solar:clipboard-list-linear'}
                  iconTitle={KIND_LABELS[i.kind] || 'Intervention'}
                  title={i.title}
                  meta={i.duration || null}
                />
              </td>
              {!isHidden('dueDate') && (
              <td className={sharedRow.valueTd} onClick={e => e.stopPropagation()}>
                <span className={sharedRow.dueDateText}>
                  {computeDueDate(i).formatted || 'No due date'}
                </span>
              </td>
              )}
              {!isHidden('assignee') && (
              <td className={sharedRow.assigneeTd} onClick={e => e.stopPropagation()}>
                <AssigneeChange
                  size="S"
                  fillContainer
                  nameMuted
                  name={effectiveName}
                  initials={effectiveInitials}
                  showRole={false}
                  unassigned={!effectiveName || effectiveName === 'Unassigned'}
                  unassignedLabel="Unassigned"
                  users={assigneeUsers}
                  avatarVariant={avatarVariant}
                  pickerTitle="Change assignee"
                  onSelect={(u) => onAssigneeChange?.(i, u)}
                  disabled={isMemberTask || !onAssigneeChange}
                />
              </td>
              )}
              {!isHidden('adherence') && (
              <td className={sharedRow.adherenceTd} onClick={e => e.stopPropagation()}>
                <GbiProgressCell progress={i.adherence} />
              </td>
              )}
              {!isHidden('carePlan') && (
              <td className={sharedRow.assigneeTd} style={{ width: CARE_PLAN_COLUMN.width, minWidth: CARE_PLAN_COLUMN.width, maxWidth: CARE_PLAN_COLUMN.width }} onClick={e => e.stopPropagation()}>
                <ProgramCell code={i.programCode} overlap={overlapFor(programOverlap, i)} />
              </td>
              )}
              {!isHidden('status') && (
              <td className={sharedRow.statusTd} onClick={e => e.stopPropagation()}>
                <GbiStatusButton
                  value={i.status} reason={i.statusReason}
                  disabled={!onStatusMenu}
                  onOpen={rect => onStatusMenu?.({ kind: 'intv', item: i, rect })}
                />
              </td>
              )}
              <td className={sharedRow.actionsTd} aria-hidden="true" />
            </tr>
          );
        }}
      />
    </div>
  );
}

// Row body: mirrors the per-plan CarePlanBarriersTable's BarrierRow
// (empty priority cell, custom:barrier icon, barrierStatusTd width),
// with the Care Plan column injected before Status.
function BarrierRow({ b, onOpen, onStatusMenu, overlap }) {
  return (
    <tr
      className={`${sharedRow.row} ${sharedRow.gbiRow} ${sharedRow.rowClickable}`}
      onClick={() => onOpen(b)}
    >
      <td className={sharedRow.priorityTd} aria-hidden="true" />
      <td className={sharedRow.titleTd}>
        <GbiNameCell
          icon="custom:barrier"
          title={b.title}
          meta={b.description || null}
        />
      </td>
      <td className={sharedRow.assigneeTd} style={{ width: CARE_PLAN_COLUMN.width, minWidth: CARE_PLAN_COLUMN.width, maxWidth: CARE_PLAN_COLUMN.width }} onClick={e => e.stopPropagation()}>
        <ProgramCell code={b.programCode} overlap={overlap} />
      </td>
      <td className={sharedRow.barrierStatusTd} onClick={e => e.stopPropagation()}>
        <GbiStatusButton
          value={b.status} reason={b.statusReason}
          disabled={!onStatusMenu}
          onOpen={rect => onStatusMenu?.({ kind: 'barrier', item: b, rect })}
        />
      </td>
    </tr>
  );
}

function BarriersTable({ rows, onOpen, onStatusMenu, programOverlap }) {
  const [closedOpen, setClosedOpen] = useState(false);
  const { sorted, sortKey, sortDir, requestSort } = useTableSort(rows, 'title', 'asc');
  // Only a Met barrier is resolved; Not Met stays in the open list so an
  // unresolved blocker can't be tucked away (same rule as the plan view).
  const { openRows, closedRows } = useMemo(() => {
    const open = [];
    const closed = [];
    for (const row of sorted) {
      if (isCompletedStatus(row.status)) closed.push(row);
      else open.push(row);
    }
    return { openRows: open, closedRows: closed };
  }, [sorted]);
  return (
    <div className={sharedRow.tableWrap}>
      <WorklistShell
        embedded
        embeddedNoScroll
        header={null}
        hideBulkBar
        columns={SUMMARY_BARRIER_COLUMNS}
        rows={openRows}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={requestSort}
        minTableWidth={0}
        emptyState={openRows.length === 0 && closedRows.length === 0 ? (
          <div className={styles.emptyRow}>No barriers match.</div>
        ) : null}
        renderRow={(b) => (
          <BarrierRow
            key={`${b.programCode}-${b.id}`}
            b={b}
            onOpen={onOpen}
            onStatusMenu={onStatusMenu}
            overlap={overlapFor(programOverlap, b)}
          />
        )}
      />
      {closedRows.length > 0 && (
        <div className={sharedRow.closedBarriers}>
          <button
            type="button"
            className={sharedRow.closedBarriersToggle}
            onClick={() => setClosedOpen(v => !v)}
            aria-expanded={closedOpen}
          >
            <DownChevronIcon
              size={6}
              color="var(--neutral-300)"
              className={`${sharedRow.closedBarriersChevron} ${closedOpen ? '' : sharedRow.closedBarriersChevronClosed}`}
            />
            <span className={sharedRow.closedBarriersLabel}>Closed Barriers</span>
            <span className={sharedRow.completedCount}>{closedRows.length}</span>
          </button>
          <CollapsibleContent open={closedOpen}>
            <table className={sharedRow.closedBarriersTable}>
              <colgroup>
                <col style={{ width: GBI_COL_WIDTH.priority }} />
                <col />
                <col style={{ width: CARE_PLAN_COLUMN.width }} />
                <col style={{ width: GBI_COL_WIDTH.status }} />
              </colgroup>
              <tbody>
                {closedRows.map(b => (
                  <BarrierRow
                    key={`${b.programCode}-${b.id}`}
                    b={b}
                    onOpen={onOpen}
                    onStatusMenu={onStatusMenu}
                    overlap={overlapFor(programOverlap, b)}
                  />
                ))}
              </tbody>
            </table>
          </CollapsibleContent>
        </div>
      )}
    </div>
  );
}

// Patient-level snapshot of every care plan across all of a patient's
// programs (roadmap #1 / E2). Rows are editable in place for priority +
// status; clicking a row opens the full preview drawer where the user
// can change status, adherence/progress, and add notes. Every write
// goes through the same store actions the per-plan tab uses, so the
// activity log, DB persistence, and cross-view sync work identically.
export function CarePlanSummaryView({
  patientId, programs, onClose, onOpenProgramStep,
  searchText = '',
  programFilter = [],
  templateFilter = [],
  statusFilter = [],
  priorityFilter = [],
  dueDateFilter = [],
  createdDateFilter = [],
  embedded = false,
  // care_plan_mode = 'both': the roll-up is the patient-level Care Plan, so
  // its drawers edit in full and each section can add to a chosen program.
  editable = false, summarizeRequest = 0, onSummaryState }) {
  const containerRef = useRef(null);
  const [dockWide, setDockWide] = useState(false);
  const [dockEl, setDockEl] = useState(null);
  const [attentionOn, setAttentionOn] = useState(false);
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!editable || !el) return undefined;
    const measure = () => setDockWide(el.clientWidth >= DOCK_MIN_WIDTH);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [editable]);
  const docked = editable && dockWide && !!dockEl;
  const [rollupAdd, setRollupAdd] = useState(null); // { kind, rect } | null
  // The editable roll-up (care plan level "both") is where the drafts are
  // edited, so it reads them. Read-only, a plan reads as last signed, with
  // the progress made on it since (status, priority, assignee...); its
  // unsigned draft stays in the editor, and a never-signed plan is not listed.
  const fetchAllPatientCarePlans = useAppStore(s => s.fetchAllPatientCarePlans);
  const fetchSignedCarePlans = useAppStore(s => s.fetchSignedCarePlans);
  const loading = useAppStore(s => (editable ? s.patientCarePlanAllLoading[patientId] : s.patientSignedCarePlansLoading[patientId]));
  const loadedFor = useAppStore(s => (editable ? s.patientCarePlanAllLoadedFor[patientId] : s.patientSignedCarePlansLoadedFor[patientId]));
  const draftCarePlans = useAppStore(s => s.patientCarePlans);
  const signedCarePlans = useSignedCarePlans();
  const patientCarePlans = editable ? draftCarePlans : signedCarePlans;
  const saveCarePlanLiveField = useAppStore(s => s.saveCarePlanLiveField);
  // Resolve THIS patient only: `s.patients` holds the current worklist
  // slice (many patients), so indexing [0] there landed on whoever's at
  // the top of the list (e.g. "Ralph Halvorson") instead of the patient
  // we're viewing. Look up by `patientId` across every worklist slice,
  // then hand the row picker a single-element array, mirrors what the
  // per-plan CarePlanView passes into `CarePlanInterventionsTable`.
  const currentPatient = useAppStore(s => {
    const buckets = [s.patients, s.allPatients, s.snpMembers, s.ccmMembers, s.hccMembers, s.awvMembers, s.jsaMembers];
    for (const list of buckets) {
      if (!Array.isArray(list)) continue;
      const hit = list.find(p => p && (p.id === patientId || String(p.memberId) === String(patientId)));
      if (hit) return hit;
    }
    return null;
  });
  const patients = useMemo(() => {
    if (!currentPatient) return [];
    const name = currentPatient.name || '';
    const initials = currentPatient.initials
      || name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    return [{ id: currentPatient.id || patientId, name, initials }];
  }, [currentPatient, patientId]);
  const platformUsers = useAppStore(s => s.platformUsers) || [];
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);

  useEffect(() => { fetchPlatformUsers?.(); }, [fetchPlatformUsers]);

  useEffect(() => {
    if (!patientId) return;
    if (editable) fetchAllPatientCarePlans(patientId);
    else fetchSignedCarePlans(patientId);
  }, [patientId, editable, fetchAllPatientCarePlans, fetchSignedCarePlans]);

  // Flatten every program's plan into goals + interventions + barriers
  // tagged with their program (shared with the Download export).
  const { conditions, goals, interventions, barriers } = useMemo(
    () => buildCarePlanSnapshot(programs, patientCarePlans, patientId),
    [programs, patientCarePlans, patientId],
  );

  // Apply the toolbar's search + every FilterChip to the snapshot.
  // Each filter is an array; concat-key memo dep avoids re-computing on
  // referential churn when the arrays are logically equal.
  const filterKey = [
    programFilter, templateFilter, statusFilter,
    priorityFilter, dueDateFilter, createdDateFilter,
  ].map(a => a.join('|')).join('#');
  const { goals: filteredGoals, interventions: filteredInterventions, barriers: filteredBarriers } = useMemo(
    () => filterCarePlanSnapshot(
      { conditions, goals, interventions, barriers },
      { searchText, programFilter, templateFilter, statusFilter, priorityFilter, dueDateFilter, createdDateFilter },
    ),
    [conditions, goals, interventions, barriers, searchText, filterKey], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Per-table cross-program overlap map: powers the ProgramCell's
  // "+N" badge on rows whose title appears on multiple programs.
  const goalProgramOverlap         = useMemo(() => buildProgramOverlap(filteredGoals),         [filteredGoals]);
  const interventionProgramOverlap = useMemo(() => buildProgramOverlap(filteredInterventions), [filteredInterventions]);
  const barrierProgramOverlap      = useMemo(() => buildProgramOverlap(filteredBarriers),      [filteredBarriers]);

  // Show each goal / intervention / barrier once. Overlap maps above are
  // built from the full filtered set, so the "+N" program badge survives.
  // The All Programs view (editable): totals, what needs attention across the
  // plans, and its Needs Attention filter on the tables.
  const openPrograms = useMemo(() => (programs || []).filter(p => !isProgramClosed(p.status)), [programs]);
  const allPlans = useMemo(
    () => (editable ? allProgramsPlanState(openPrograms, patientCarePlans, patientId, dueOf) : null),
    [editable, openPrograms, patientCarePlans, patientId],
  );
  const attentionIds = useMemo(
    () => (attentionOn && allPlans ? new Set(allPlans.attention.map(a => String(a.item?.id))) : null),
    [attentionOn, allPlans],
  );
  const onlyAttention = rows => (attentionIds ? rows.filter(r => attentionIds.has(String(r.id))) : rows);
  const uniqueGoals         = useMemo(() => onlyAttention(dedupeByTitle(filteredGoals)),         [filteredGoals, attentionIds]); // eslint-disable-line react-hooks/exhaustive-deps
  const uniqueInterventions = useMemo(() => onlyAttention(dedupeByTitle(filteredInterventions)), [filteredInterventions, attentionIds]); // eslint-disable-line react-hooks/exhaustive-deps
  const uniqueBarriers      = useMemo(() => onlyAttention(dedupeByTitle(filteredBarriers)),      [filteredBarriers, attentionIds]); // eslint-disable-line react-hooks/exhaustive-deps

  const isEmpty = loadedFor && goals.length === 0 && interventions.length === 0 && barriers.length === 0;

  const [openSections, setOpenSections] = useState({ aiSummary: true, programs: true, careNotes: true, goals: true, interventions: true, barriers: true });
  // Which program's Care Note the Care Notes section shows.
  const [noteProgramId, setNoteProgramId] = useState(null);
  const toggleSection = (k) => setOpenSections(s => ({ ...s, [k]: !s[k] }));

  // Active programs summary row set. Only surfaces programs whose
  // patient plan actually exists (a plan row in `patientCarePlans` for
  // this patient + program): matches the ask that the section shows
  // "only plans that have been created". Closed / completed enrollments
  // are still hidden to match CareProgramsTab's PAST_STATUSES rule.
  const patientCarePlanAudit = useAppStore(s => s.patientCarePlanAudit);
  const fetchCarePlanAudit = useAppStore(s => s.fetchCarePlanAudit);
  // The Care Notes and Activity Since Review read each plan's audit, which
  // this view would otherwise only have once the program's plan was opened.
  const openProgramIds = (programs || []).filter(p => !isProgramClosed(p.status)).map(p => p.id).join(',');
  useEffect(() => {
    if (!patientId || !openProgramIds) return;
    for (const id of openProgramIds.split(',')) {
      if (!useAppStore.getState().patientCarePlanAudit[`${patientId}::${id}`]) fetchCarePlanAudit(patientId, id);
    }
  }, [patientId, openProgramIds, fetchCarePlanAudit]);
  const fmtDate = (iso) => {
    if (!iso || isEmptyDash(iso)) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
  };
  const activeProgramRows = useMemo(() => {
    return (programs || [])
      .filter(p => !isProgramClosed(p.status))
      .map(p => {
        const key = `${patientId}::${p.id}`;
        const plan = patientCarePlans[key];
        if (!plan) return null;
        // Conditions on this plan: only the patient-level medical
        // conditions the plan row carries (e.g. Diabetes,
        // Hypertension). Goal.conditions holds template category tags
        // ("Care management", "Comprehensive care management"), which
        // aren't clinical conditions and shouldn't leak into this
        // column. Dedup by lowercase.
        const seen = new Map();
        for (const c of (plan.plan?.conditions || [])) {
          const label = c?.label;
          if (!label) continue;
          const k = String(label).trim().toLowerCase();
          if (!k || seen.has(k)) continue;
          seen.set(k, label);
        }
        const planConditions = [...seen.values()];

        // Start = plan signed date (falls back to the plan's created
        // date if it hasn't been signed and shared yet). End = latest
        // target date across every goal on the plan (with the
        // program's own endDate as a last resort).
        const startISO = plan.plan?.signedAt || plan.plan?.createdDate || null;
        const goalEndTimes = (plan.goals || [])
          .map(g => localDateMs(g.targetDate))
          .filter(t => !Number.isNaN(t));
        const endISO = goalEndTimes.length
          ? new Date(Math.max(...goalEndTimes)).toISOString()
          : null;
        const startDate = fmtDate(startISO) || '-';
        const endDate = fmtDate(endISO) || (p.endDate && !isEmptyDash(p.endDate) ? p.endDate : '-');

        // Reviewer + last review date come off the plan's most recent
        // signature; fall back to the program's lastUpdated stamp.
        const lastReviewedISO = plan.plan?.signedAt || (!isEmptyDash(p.lastUpdated) ? p.lastUpdated : null);
        const lastReviewed = fmtDate(lastReviewedISO) || '-';
        const lastReviewedBy = plan.plan?.signedBy || null;
        const lastReviewedTs = lastReviewedISO ? new Date(lastReviewedISO).getTime() : 0;

        const audit = patientCarePlanAudit[key] || [];
        const sinceReview = audit
          .filter(a => a.createdAt && new Date(a.createdAt).getTime() > lastReviewedTs)
          .sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt));
        const buckets = { goal: 0, intervention: 0, barrier: 0 };
        for (const row of sinceReview) {
          if (row.entityType && buckets[row.entityType] != null) buckets[row.entityType] += 1;
        }
        const activityBits = [];
        if (buckets.goal) activityBits.push(`${buckets.goal} Goal${buckets.goal === 1 ? '' : 's'} Update`);
        if (buckets.intervention) activityBits.push(`${buckets.intervention} Intervention${buckets.intervention === 1 ? '' : 's'} Updated`);
        if (buckets.barrier) activityBits.push(`${buckets.barrier} Barrier${buckets.barrier === 1 ? '' : 's'} Closed`);
        // Every plan-level or otherwise-bucketed audit entry that isn't
        // captured above still counts as activity for the reviewer,
        // report it as a generic "N Plan Update(s)" so the cell never
        // renders a blank clickable when sinceReview has entries but
        // none of them are goal / intervention / barrier changes.
        const bucketedTotal = buckets.goal + buckets.intervention + buckets.barrier;
        const otherCount = Math.max(0, sinceReview.length - bucketedTotal);
        if (otherCount) activityBits.push(`${otherCount} Plan Update${otherCount === 1 ? '' : 's'}`);

        // Patient row's `pcp` is either the provider name or falsy;
        // treat 'Unassigned' / empty as "no PCP on file" so the cell
        // reads truthfully.
        const rawPcp = (currentPatient?.pcp || '').trim();
        const pcpName = rawPcp && rawPcp.toLowerCase() !== 'unassigned' ? rawPcp : null;

        return {
          ...p,
          conditionsList: planConditions,
          startDateFmt: startDate,
          endDateFmt: endDate,
          pcmName: p.assignee && p.assignee !== 'Unassigned' ? p.assignee : null,
          pcpName,
          lastReviewed,
          lastReviewedBy,
          activitySummary: activityBits.join(', '),
          sinceReviewEntries: sinceReview,
          planNote: latestPlanNote(audit),
        };
      })
      .filter(Boolean);
  }, [programs, patientCarePlans, patientCarePlanAudit, patientId, currentPatient?.pcp]);

  // Summarize: the cross-program recap (via the /api/care-plan-summary proxy,
  // which keeps the Gemini key server-side). It is persisted one row per patient
  // in patient_care_plan_summaries, so the card renders straight from the store:
  // a generated summary survives reload, and regenerating overwrites it.
  const savedSummaryEntry = useAppStore(s => s.patientCarePlanSummaries[patientId]);
  const fetchPatientCarePlanSummary = useAppStore(s => s.fetchPatientCarePlanSummary);
  const savePatientCarePlanSummary = useAppStore(s => s.savePatientCarePlanSummary);
  const deletePatientCarePlanSummary = useAppStore(s => s.deletePatientCarePlanSummary);

  useEffect(() => {
    if (patientId) fetchPatientCarePlanSummary(patientId);
  }, [patientId, fetchPatientCarePlanSummary]);

  const summary = useCarePlanAiSummary({
    saved: savedSummaryEntry?.summary || null,
    onSave: (next) => savePatientCarePlanSummary(patientId, next),
    onDelete: () => deletePatientCarePlanSummary(patientId),
    buildPayload: () => buildSummaryPayload({ patientName: currentPatient?.name, programs, conditions, goals, interventions, barriers }),
    isEmpty: goals.length + interventions.length + barriers.length === 0,
  });

  // Summarize lives in the pane's toolbar: it bumps `summarizeRequest`, and
  // the state goes back up so its button reads "AI is writing…" / "Generated".
  useEffect(() => {
    if (!summarizeRequest) return;
    summary.generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summarizeRequest]);
  useEffect(() => { onSummaryState?.(summary.state); }, [summary.state, onSummaryState]);

  // "Activity Since Review" drawer target: the row the user clicked;
  // null when the drawer is closed.
  const [activityReviewOpen, setActivityReviewOpen] = useState(null);

  // Preview drawer state: reuses the exact per-plan drawer so every
  // edit (status, adherence, progress, notes) lands in the same store
  // slice and shows up here on the next render.
  const [previewGoal, setPreviewGoal] = useState(null);
  const [previewIntervention, setPreviewIntervention] = useState(null);
  const [previewBarrier, setPreviewBarrier] = useState(null);

  // Status, priority and an internal task's assignee are progress on the
  // signed plan, so they save from here straight onto it.
  const [priorityMenu, setPriorityMenu] = useState(null);
  const [statusMenu, setStatusMenu] = useState(null);
  const TYPE_OF = { goal: 'goal', intv: 'intervention', barrier: 'barrier' };

  const changePriority = (priority) => {
    if (!priorityMenu) return;
    const { kind, item } = priorityMenu;
    setPriorityMenu(null);
    if (item.program) saveCarePlanLiveField(patientId, item.program, TYPE_OF[kind], item.id, { priority });
  };

  const changeStatus = async (status) => {
    if (!statusMenu) return;
    const { kind, item } = statusMenu;
    setStatusMenu(null);
    if (!item.program) return;
    const why = await confirmStatusChange([{ type: TYPE_OF[kind], item }], status);
    if (!why) return;
    saveCarePlanLiveField(patientId, item.program, TYPE_OF[kind], item.id, { status, ...statusReasonPatch(item, why) });
  };

  // Only Internal Task's assignee is editable; other kinds stay with the member.
  const handleInterventionAssignee = (intv, user) => {
    if (!intv?.program || intv.kind !== 'internal-task') return;
    const name = user?.name || 'Unassigned';
    const initials = name === 'Unassigned'
      ? ''
      : name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    saveCarePlanLiveField(patientId, intv.program, 'intervention', intv.id, { assignee: { name, initials } });
  };

  // Docked, the panel holds one item: opening another replaces it.
  const only = (keep) => {
    if (!docked) return;
    if (keep !== 'goal') setPreviewGoal(null);
    if (keep !== 'intervention') setPreviewIntervention(null);
    if (keep !== 'barrier') setPreviewBarrier(null);
  };
  const openGoal = (g, program = g.program) => { only('goal'); setPreviewGoal({ goal: g, program }); };
  const openIntervention = (i, program = i.program) => { only('intervention'); setPreviewIntervention({ intervention: i, program }); };
  const openBarrier = (b, program = b.program) => { only('barrier'); setPreviewBarrier({ barrier: b, program }); };
  const openFocusItem = (kind, item, program) => {
    if (kind === 'goal') openGoal(item, program);
    else if (kind === 'intervention') openIntervention(item, program);
    else if (kind === 'barrier') openBarrier(item, program);
  };

  return (
    <DrawerDockContext.Provider value={docked ? dockEl : null}>
    <div ref={containerRef} className={`${styles.container} ${embedded ? styles.embedded : ''} ${editable ? styles.workspace : ''}`}>
      <div className={editable ? styles.workspaceMain : styles.plainMain}>
      {!embedded && (
        <div className={styles.header}>
          <div className={styles.headerText}>
            <span className={styles.headerTitle}>Care Plan</span>
            <span className={styles.headerMeta}>All programs · read-only snapshot</span>
          </div>
          <span className={styles.readOnlyBadge}>
            <Icon name="solar:lock-keyhole-minimalistic-linear" size={14} color="var(--neutral-300)" />
            Read only
          </span>
          <span className={styles.headerDivider} />
          <CloseButton onClick={onClose} />
        </div>
      )}

      {loading && !loadedFor ? (
        <TableSkeleton rows={6} />
      ) : isEmpty ? (
        <EmptyState icon="solar:hand-heart-linear" title={editable ? 'No Care Plans Yet' : 'No Signed Care Plans Yet'} />
      ) : (
        <div className={styles.body}>
          {allPlans && allPlans.plans.length > 0 && (
            <CarePlanSummaryStrip
              totals={allPlans.totals}
              attention={allPlans.attention}
              attentionOn={attentionOn}
              onToggleAttention={() => setAttentionOn(v => !v)}
              review={null}
            />
          )}
          {attentionOn && (
            <div className={styles.attentionBar}>
              <Icon name="solar:danger-circle-linear" size={16} color="var(--status-error)" />
              <span>Showing only what needs attention</span>
              <button type="button" className={styles.clearAttention} onClick={() => setAttentionOn(false)}>Show All</button>
            </div>
          )}
          {/* Shown once Summarize (in the toolbar) is generating or has run. */}
          {summary.state !== 'idle' && (
          <div className={styles.section}>
            {/* AI Summary: the cross-program recap, saved until someone
                regenerates or dismisses it. Its own section, separate from
                the Active Programs table. */}
            <div className={styles.splitHead}>
              <button
                type="button"
                className={styles.sectionHead}
                onClick={() => toggleSection('aiSummary')}
                aria-expanded={openSections.aiSummary}
              >
                <DownChevronIcon
                  size={16}
                  color="var(--neutral-400)"
                  className={`${styles.sectionChevron} ${openSections.aiSummary ? '' : styles.sectionChevronClosed}`}
                />
                <span className={styles.sectionTitle}>AI Summary</span>
              </button>
            </div>
            {openSections.aiSummary && summary.state === 'loading' && <AiSummarySkeleton />}
            {openSections.aiSummary && summary.state === 'ready' && (
              <AiSummaryCard
                data={savedSummaryEntry.summary}
                onCopy={summary.copy}
                onRegenerate={summary.regenerate}
                onDelete={summary.clear}
              />
            )}
          </div>
          )}

          <div className={styles.section}>
            {/* Active Programs Summary: one row per enrolled program.
                Sits above the GBI sections so the reader gets a quick
                who-owns-what recap (PCM / PCP / last review / activity
                since review) before diving into the goal / intervention
                lists. Closed / completed enrollments are hidden. */}
            <button
              type="button"
              className={styles.sectionHead}
              onClick={() => toggleSection('programs')}
              aria-expanded={openSections.programs}
            >
              <DownChevronIcon
                size={16}
                color="var(--neutral-400)"
                className={`${styles.sectionChevron} ${openSections.programs ? '' : styles.sectionChevronClosed}`}
              />
              <span className={styles.sectionTitle}>Active Programs Summary</span>
            </button>
            {openSections.programs && (
              activeProgramRows.length === 0 ? (
                <div className={styles.programsEmpty}>No active programs.</div>
              ) : (
                <ActiveProgramsTable
                  rows={activeProgramRows}
                  onView={onOpenProgramStep}
                  onOpenActivity={setActivityReviewOpen}
                />
              )
            )}
          </div>

          {/* Care Notes (#80): one program's note at a time, with a tab per
              program that has one. Hidden until some program has a note;
              the toolbar's note action adds one. */}
          {(() => {
            const withNotes = activeProgramRows.filter(r => r.planNote);
            if (!withNotes.length) return null;
            const shown = withNotes.find(r => r.id === noteProgramId) || withNotes[0];
            return (
              <div className={styles.section}>
                <div className={styles.careNotesHead}>
                  <button
                    type="button"
                    className={styles.sectionHead}
                    onClick={() => toggleSection('careNotes')}
                    aria-expanded={openSections.careNotes}
                  >
                    <DownChevronIcon
                      size={16}
                      color="var(--neutral-400)"
                      className={`${styles.sectionChevron} ${openSections.careNotes ? '' : styles.sectionChevronClosed}`}
                    />
                    <span className={styles.sectionTitle}>Care Notes</span>
                  </button>
                  {withNotes.length > 1 ? (
                    <SegmentedControl
                      size="sm"
                      items={withNotes.map(r => ({ key: r.id, label: r.code }))}
                      value={shown.id}
                      onValueChange={(id) => {
                        setNoteProgramId(id);
                        if (!openSections.careNotes) toggleSection('careNotes');
                      }}
                    />
                  ) : (
                    <span className={styles.careNoteProgram}>{shown.code}</span>
                  )}
                </div>
                {openSections.careNotes && (
                  <div className={styles.careNoteCard}>
                    <p className={styles.careNoteBody}>{shown.planNote.detail}</p>
                    <span className={styles.careNoteMeta}>
                      {shown.planNote.actor || 'Unknown'} • {fmtDate(shown.planNote.createdAt)}
                    </span>
                  </div>
                )}
              </div>
            );
          })()}

          <div className={styles.section}>
            <SectionHead
              title="Goals"
              onAdd={editable ? (rect) => setRollupAdd({ kind: 'goal', rect }) : undefined}
              count={uniqueGoals.length}
              open={openSections.goals}
              onToggle={() => toggleSection('goals')}
            />
            {openSections.goals && (
              <GoalsTable
                rows={uniqueGoals}
                onOpen={openGoal}
                onPriorityMenu={setPriorityMenu}
                onStatusMenu={setStatusMenu}
                programOverlap={goalProgramOverlap}
              />
            )}
          </div>

          <div className={styles.section}>
            <SectionHead
              title="Interventions"
              onAdd={editable ? (rect) => setRollupAdd({ kind: 'intervention', rect }) : undefined}
              count={uniqueInterventions.length}
              open={openSections.interventions}
              onToggle={() => toggleSection('interventions')}
            />
            {openSections.interventions && (
              <InterventionsTable
                rows={uniqueInterventions}
                onOpen={openIntervention}
                onPriorityMenu={setPriorityMenu}
                onStatusMenu={setStatusMenu}
                onAssigneeChange={handleInterventionAssignee}
                patients={patients}
                platformUsers={platformUsers}
                programOverlap={interventionProgramOverlap}
              />
            )}
          </div>

          <div className={styles.section}>
            <SectionHead
              title="Barriers"
              onAdd={editable ? (rect) => setRollupAdd({ kind: 'barrier', rect }) : undefined}
              count={uniqueBarriers.length}
              open={openSections.barriers}
              onToggle={() => toggleSection('barriers')}
            />
            {openSections.barriers && (
              <BarriersTable
                rows={uniqueBarriers}
                onOpen={openBarrier}
                onStatusMenu={setStatusMenu}
                programOverlap={barrierProgramOverlap}
              />
            )}
          </div>
        </div>
      )}

      </div>
      {editable && dockWide && (
        <aside ref={setDockEl} className={styles.dockColumn} aria-label="Plan focus and item details">
          <div className={styles.focusSlot}>
            <AllProgramsFocus
              patientId={patientId}
              patientName={currentPatient?.name || ''}
              attention={allPlans?.attention || []}
              onOpenItem={openFocusItem}
            />
          </div>
        </aside>
      )}

      {priorityMenu && (
        <MenuPopover
          anchorRect={priorityMenu.rect}
          align="left"
          width={160}
          ariaLabel="Change priority"
          items={PRIORITIES.map(p => ({
            key: p,
            label: p.charAt(0).toUpperCase() + p.slice(1),
            iconElement: <PriorityIcon priority={p} size={16} />,
          }))}
          onSelect={changePriority}
          onClose={() => setPriorityMenu(null)}
        />
      )}

      {statusMenu && (
        <MenuPopover
          anchorRect={statusMenu.rect}
          align="left"
          width={180}
          ariaLabel="Change status"
          items={gbiStatusMenuItems(TYPE_OF[statusMenu.kind], statusMenu.item?.status)}
          onSelect={changeStatus}
          onClose={() => setStatusMenu(null)}
        />
      )}

      {previewGoal && (
        <GoalPreviewDrawer
          goal={previewGoal.goal}
          patientId={patientId}
          program={previewGoal.program}
          onClose={() => setPreviewGoal(null)}
          onOpenBarrier={(b) => openBarrier(b, previewGoal.program)}
          onOpenIntervention={editable ? (i) => openIntervention(i, previewGoal.program) : undefined}
          consolidated={!editable}
          signedView={!editable}
        />
      )}
      {previewIntervention && (
        <InterventionPreviewDrawer
          intervention={previewIntervention.intervention}
          patientId={patientId}
          program={previewIntervention.program}
          onClose={() => setPreviewIntervention(null)}
          onOpenGoal={editable ? (g) => openGoal(g, previewIntervention.program) : undefined}
          consolidated={!editable}
          signedView={!editable}
        />
      )}
      {previewBarrier && (
        <BarrierDetailDrawer
          barrier={previewBarrier.barrier}
          patientId={patientId}
          program={previewBarrier.program}
          onClose={() => setPreviewBarrier(null)}
          onOpenGoal={editable ? (g) => openGoal(g, previewBarrier.program) : undefined}
          consolidated={!editable}
          signedView={!editable}
        />
      )}
      {rollupAdd && (
        <CarePlanRollupAdd
          start={rollupAdd}
          patientId={patientId}
          patientName={currentPatient?.name || ''}
          programs={programs}
          onDone={() => setRollupAdd(null)}
        />
      )}
      {activityReviewOpen && (
        <ActivityReviewDrawer
          target={activityReviewOpen}
          onClose={() => setActivityReviewOpen(null)}
        />
      )}
    </div>
    </DrawerDockContext.Provider>
  );
}

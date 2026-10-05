import {
  GOAL_COLUMNS,
  INTERVENTION_COLUMNS,
  BARRIER_COLUMNS,
  GBI_COL_DATE_WIDTH,
} from './carePlanTableShared';

/* ── Compact plan grid (Figma 866:7336) ──
   P · Name (+ meta line) · Status · Actions, identical in all three sections
   so the stacked tables align and fit the 700px drawer. Dates, assignee and
   metrics now live in the meta line; their columns stay available through
   the column picker (off by default) so no field or sort is lost. The full
   column sets stay as they are for the Comprehensive Care Plan. */

const colOf = (cols, key) => cols.find(c => c.key === key);
const hiddenByDefault = (col) => ({ ...col, defaultHidden: true });
const HEADER_COMPACT = colOf(GOAL_COLUMNS, 'status').thStyle;

export const GBI_ACTIONS_WIDTH = 104;
const COMPACT_ACTIONS_COLUMN = {
  key: 'actions', label: 'Actions', popoverLabel: 'Actions', width: GBI_ACTIONS_WIDTH, sticky: 'right', thStyle: HEADER_COMPACT,
};

export const COMPACT_GOAL_COLUMNS = [
  colOf(GOAL_COLUMNS, 'priority'),
  { ...colOf(GOAL_COLUMNS, 'title'), label: 'Name' },
  hiddenByDefault(colOf(GOAL_COLUMNS, 'createdDate')),
  hiddenByDefault(colOf(GOAL_COLUMNS, 'targetDate')),
  colOf(GOAL_COLUMNS, 'progress'),
  colOf(GOAL_COLUMNS, 'trend'),
  colOf(GOAL_COLUMNS, 'status'),
  COMPACT_ACTIONS_COLUMN,
];

export const COMPACT_INTERVENTION_COLUMNS = [
  colOf(INTERVENTION_COLUMNS, 'priority'),
  colOf(INTERVENTION_COLUMNS, 'title'),
  {
    key: 'dueDate', label: 'Due Date', popoverLabel: 'Due Date', width: GBI_COL_DATE_WIDTH,
    sortKey: '_sortDueDate', sortType: 'date', defaultHidden: true, thStyle: HEADER_COMPACT,
  },
  hiddenByDefault(colOf(INTERVENTION_COLUMNS, 'assignee')),
  colOf(INTERVENTION_COLUMNS, 'adherence'),
  { ...colOf(INTERVENTION_COLUMNS, 'status'), locked: true },
  COMPACT_ACTIONS_COLUMN,
];

// Barriers have no column picker, so the actions column isn't pinned.
export const COMPACT_BARRIER_COLUMNS = [
  colOf(BARRIER_COLUMNS, 'priority'),
  colOf(BARRIER_COLUMNS, 'title'),
  colOf(BARRIER_COLUMNS, 'status'),
  { ...COMPACT_ACTIONS_COLUMN, sticky: undefined },
];

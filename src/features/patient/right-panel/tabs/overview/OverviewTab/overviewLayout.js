// Overview tab layout: which widgets show, in which lane, in what order.
//
// The user arranges three lanes (Customize). The column count follows the
// Overview's own width (not the window), so the left panel being open,
// closed or dragged wider is handled in one place. With the left panel open
// it already reads as a column, so the Overview tops out at two; collapsed, a
// wide Overview gets three (25% / 50% / 25%).
//
// Folding: 3 columns show the lanes as they are (Overview, Care Management,
// Actionables); 2 columns stack Actionables under Overview in the narrow
// column and give Care Management the wide one; 1 column stacks the lanes
// in that order.

export const TWO_COLUMN_MIN_WIDTH = 1150;
export const THREE_COLUMN_MIN_WIDTH = 1400;

export function overviewColumnCount(width, { leftPanelOpen }) {
  if (!leftPanelOpen && width >= THREE_COLUMN_MIN_WIDTH) return 3;
  if (width >= TWO_COLUMN_MIN_WIDTH) return 2;
  return 1;
}

export const LANE_LABELS = ['Overview', 'Care Management', 'Actionables'];
export const LANE_HINTS = ['Patient context', 'Clinical work', 'What to do next'];

// Bump when the default lanes change, so a layout saved before the categories
// picks up the new columns instead of keeping the old mix.
export const OVERVIEW_LAYOUT_REVISION = 3;

// Every widget the Overview can show. `sample` marks widgets reused from the
// left panel Summary tab that still show built-in sample data rather than
// this patient's. `group` is the column it belongs in.
export const OVERVIEW_WIDGETS = [
  { key: 'synopsis', label: 'Patient Synopsis', group: 'Overview' },
  { key: 'healthChart', label: 'Health Chart', group: 'Overview' },
  { key: 'highlights', label: 'Highlights', group: 'Overview' },
  { key: 'careTeam', label: 'Care Team', group: 'Overview' },
  { key: 'contact', label: 'Contact & Reachability', group: 'Overview' },
  { key: 'caregivers', label: 'Caregiver & Family', group: 'Overview' },
  { key: 'populationGroups', label: 'Population Groups', group: 'Overview', sample: true },
  { key: 'insurance', label: 'Insurance', group: 'Overview', sample: true },
  { key: 'subscription', label: 'Subscription', group: 'Overview', sample: true },
  { key: 'vitals', label: 'Vitals', group: 'Care Management' },
  { key: 'carePlan', label: 'Care Plan', group: 'Care Management' },
  { key: 'carePrograms', label: 'Active Care Programs', group: 'Care Management' },
  { key: 'gaps', label: 'Gaps', group: 'Care Management' },
  { key: 'notes', label: 'Recent Notes', group: 'Care Management' },
  { key: 'medications', label: 'Medications', group: 'Care Management' },
  { key: 'conditions', label: 'Diagnoses & Problems', group: 'Care Management' },
  { key: 'programProgress', label: 'Program Progress', group: 'Care Management' },
  { key: 'careUtilization', label: 'Care Utilization Summary', group: 'Care Management', sample: true },
  { key: 'priorAuth', label: 'Prior Authorization Requests', group: 'Care Management', sample: true },
  { key: 'careJourneys', label: 'Care Journeys', group: 'Care Management', sample: true },
  { key: 'quickActions', label: 'Quick Actions', group: 'Actionables' },
  { key: 'suggestedActions', label: 'Suggested Actions', group: 'Actionables' },
  { key: 'appointments', label: 'Appointments', group: 'Actionables' },
  { key: 'tasks', label: 'Tasks', group: 'Actionables' },
  { key: 'reminders', label: 'Reminders', group: 'Actionables' },
  { key: 'awaitingReply', label: 'Awaiting Reply', group: 'Actionables' },
  { key: 'sinceLastTouch', label: 'Since Last Visit', group: 'Actionables' },
  { key: 'automations', label: 'Active Automations', group: 'Actionables', sample: true },
];

export const OVERVIEW_WIDGET_KEYS = OVERVIEW_WIDGETS.map(w => w.key);
const KNOWN = new Set(OVERVIEW_WIDGET_KEYS);

// Every widget has a home lane. Hidden widgets stay in their lane (dimmed in
// Customize, skipped on the Overview), so showing one again puts it back
// where it was.
//
// Needs Attention sits above the lanes, so each lane leads with what moves:
// Overview is who the patient is (synopsis first, reference cards last;
// risk, acuity and consent live in the patient banner). Care Management is
// the clinical record (the wide column), with vitals, care plan and gaps on
// top. Actionables is what to do next, led by
// Suggested Actions, Tasks and Appointments. Sample-only reference cards
// (population groups, insurance, subscription) start hidden. Unchanged
// revision: a layout someone already arranged stays as they left it.
export const DEFAULT_OVERVIEW_LAYOUT = {
  revision: OVERVIEW_LAYOUT_REVISION,
  lanes: [
    ['synopsis', 'healthChart', 'careTeam', 'caregivers', 'highlights', 'contact', 'populationGroups', 'insurance', 'subscription'],
    ['vitals', 'carePlan', 'gaps', 'carePrograms', 'medications', 'conditions', 'notes', 'programProgress', 'careUtilization', 'priorAuth', 'careJourneys'],
    ['suggestedActions', 'tasks', 'reminders', 'appointments', 'awaitingReply', 'quickActions', 'sinceLastTouch', 'automations'],
  ],
  hidden: ['programProgress', 'populationGroups', 'insurance', 'subscription'],
};

const DEFAULT_LANE_OF = Object.fromEntries(
  DEFAULT_OVERVIEW_LAYOUT.lanes.flatMap((lane, i) => lane.map(k => [k, i])),
);
const DEFAULT_HIDDEN = new Set(DEFAULT_OVERVIEW_LAYOUT.hidden);

/**
 * Saved layout → a complete, valid one: every known widget in exactly one
 * lane, `hidden` a subset of them. Drops unknown or duplicate keys. Widgets
 * the user has never seen (added after they last saved) go to their default
 * lane with their default visibility.
 */
export function normalizeOverviewLayout(saved) {
  const current = saved?.revision === OVERVIEW_LAYOUT_REVISION;
  const source = current && Array.isArray(saved.lanes) ? saved : DEFAULT_OVERVIEW_LAYOUT;
  const lanes = [[], [], []];
  const seen = new Set();
  source.lanes.slice(0, 3).forEach((lane, i) => {
    (Array.isArray(lane) ? lane : []).forEach((k) => {
      if (KNOWN.has(k) && !seen.has(k)) { seen.add(k); lanes[i].push(k); }
    });
  });
  const savedHidden = new Set(Array.isArray(source.hidden) ? source.hidden : []);
  const hidden = new Set([...savedHidden].filter(k => seen.has(k)));
  // Not in any lane: new to this user, or saved before hidden widgets kept
  // their lane. Either way it goes home; a widget the user hid stays hidden.
  OVERVIEW_WIDGET_KEYS.forEach((k) => {
    if (seen.has(k)) return;
    lanes[DEFAULT_LANE_OF[k] ?? 0].push(k);
    if (savedHidden.has(k) || DEFAULT_HIDDEN.has(k)) hidden.add(k);
  });
  return { lanes, hidden: [...hidden] };
}

/** The visible columns for a column count, folded from the three lanes. */
export function overviewColumns(layout, count) {
  const hidden = new Set(layout.hidden);
  const [a, b, c] = layout.lanes.map(lane => lane.filter(k => !hidden.has(k)));
  if (count === 3) return [a, b, c];
  if (count === 2) return [[...a, ...c], b];
  return [[...a, ...b, ...c]];
}

// Relative column widths: 25 / 50 / 25 at three, 1/3 + 2/3 at two.
export const OVERVIEW_COLUMN_TEMPLATE = {
  3: '1fr 2fr 1fr',
  2: '1fr 2fr',
  1: 'minmax(0, 1fr)',
};

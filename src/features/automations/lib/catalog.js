/* What an automation can be built from: triggers, conditions, actions and the
   logic pieces (AND / OR / Delay / Repeat). The palette, the canvas cards, the
   edit panels, the simulator and the validator all read this file, so a new
   node type is added here once.

   Copy follows the Figma section (Settings > Automations) with grammar fixed
   ("When a contact is added or updated", not "added or update"); see
   docs/features/automations-design-review.md. */

// Visual family of a node: drives the icon tile color on canvas cards and the
// tint of the palette group.
export const FAMILY = {
  trigger: { color: 'var(--primary-300)', bg: 'var(--ai-gradient-light)' },
  condition: { color: 'var(--primary-300)', bg: 'color-mix(in srgb, var(--primary-300) 10%, transparent)' },
  send: { color: 'var(--accent-amber)', bg: 'color-mix(in srgb, var(--accent-amber) 10%, transparent)' },
  order: { color: 'var(--accent-green)', bg: 'color-mix(in srgb, var(--accent-green) 10%, transparent)' },
  add: { color: 'var(--accent-cyan)', bg: 'color-mix(in srgb, var(--accent-cyan) 10%, transparent)' },
  logic: { color: 'var(--status-warning)', bg: 'var(--status-warning-light)' },
};

// ── Triggers ──
// `group` is the section header in the "Run automation, when" picker.
export const TRIGGERS = [
  { type: 'contactAddedOrUpdated', group: 'Match condition', icon: 'solar:user-plus-linear', label: 'When a contact is added or updated' },
  { type: 'patientRegistered', group: 'Patient', icon: 'solar:user-plus-rounded-linear', label: 'A new patient is registered in the account' },
  { type: 'familyMemberAdded', group: 'Patient', icon: 'solar:hand-heart-linear', label: 'A patient’s family member is added' },
  { type: 'prospectRegistered', group: 'Prospect', icon: 'solar:incognito-linear', label: 'A new prospect is registered in the account' },
  { type: 'employeeRegistered', group: 'Employee', icon: 'solar:case-round-linear', label: 'A new employee is registered in the account' },
  { type: 'dependentAdded', group: 'Employee', icon: 'solar:users-group-rounded-linear', label: 'An employee’s dependent is added to the account' },
  { type: 'membershipEnrolled', group: 'Membership', icon: 'solar:medal-ribbon-star-linear', label: 'A contact enrolls in a new membership' },
  { type: 'membershipStatusChanged', group: 'Membership', icon: 'solar:medal-star-square-linear', label: 'A contact’s membership status changes' },
  // Not in the Figma: the enrollment trigger the former Settings > Automation
  // Rules ran on (store: runAutoApplyRules). Config: { programCodes: [] }.
  { type: 'careProgramEnrolled', group: 'Care program', icon: 'solar:clipboard-heart-linear', label: 'A patient is enrolled in a care program' },
  // Program moves to Unable to Reach / Paused / Completed / Closed (store:
  // runProgramStatusRules). Config: { programStatuses: [], programCodes: [] };
  // no program codes = the account default, a program code = its override.
  { type: 'careProgramStatusChanged', group: 'Care program', icon: 'solar:refresh-circle-linear', label: 'A patient’s care program status changes' },
];
export const TRIGGER_GROUPS = [...new Set(TRIGGERS.map(t => t.group))];
export const triggerDef = (type) => TRIGGERS.find(t => t.type === type) || null;

// ── Conditions ──
// `fields` are the rows the Edit Condition panel shows (see conditionFields.js).
// `outcomes` (optional) turn the condition into a splitter: one branch per
// selected value instead of a pass / stop filter.
export const CONDITIONS = [
  {
    type: 'matchingConditions', group: 'Contact', icon: 'solar:code-linear',
    label: 'Member is matching selected conditions',
    fields: 'all',
    helper: 'The automation continues for members who match these conditions.',
  },
  { type: 'contactTypes', group: 'Contact', icon: 'solar:user-id-linear', label: 'Member is matching contact types', fields: ['contactType'] },
  { type: 'demographics', group: 'Contact', icon: 'solar:user-rounded-linear', label: 'Member is matching contact demographics', fields: ['gender', 'sexAtBirth', 'age', 'location'] },
  { type: 'employee', group: 'Contact', icon: 'solar:case-minimalistic-linear', label: 'Employee is matching', fields: ['employer', 'membershipType'] },
  { type: 'emergencyContact', group: 'Contact', icon: 'solar:phone-calling-rounded-linear', label: 'Member has emergency contact info', fields: ['emergencyContact'] },
  { type: 'loggedIn', group: 'Contact', icon: 'solar:login-2-linear', label: 'Member is logged in', fields: ['loginStatus', 'lastActivity'] },
  { type: 'deactivated', group: 'Contact', icon: 'solar:user-block-linear', label: 'Member is deactivated', fields: ['deactivated'] },
  { type: 'language', group: 'Communication', icon: 'solar:translation-linear', label: 'Contact language is added or updated', fields: ['language'] },
  { type: 'inboxes', group: 'Communication', icon: 'solar:inbox-linear', label: 'Member uses communication inboxes', fields: ['inbox'] },
  {
    type: 'preferredChannel', group: 'Communication', icon: 'solar:chat-round-like-linear',
    label: 'Member’s preferred mode of communication is',
    fields: ['preferredChannel'],
    outcomes: 'channels',
  },
  { type: 'tagsLabels', group: 'Other', icon: 'solar:tag-linear', label: 'Member has tags and labels', fields: ['tags'] },
  // Not in the Figma: the clinical criteria the former Automation Rules used
  // (chronic condition, lab, assessment answer, recent event), evaluated by
  // lib/clinicalCriteria.js against the patient record.
  { type: 'clinicalCriteria', group: 'Clinical', icon: 'solar:health-linear', label: 'Patient matches clinical criteria', fields: 'clinical' },
];
export const CONDITION_GROUPS = [...new Set(CONDITIONS.map(c => c.group))];

// Channels a preferred-mode condition can branch on.
export const CHANNELS = [
  { key: 'email', label: 'Email', icon: 'solar:letter-linear' },
  { key: 'sms', label: 'SMS', icon: 'solar:chat-line-linear' },
  { key: 'chat', label: 'Chat', icon: 'solar:chat-round-dots-linear' },
  { key: 'voice', label: 'Phone call', icon: 'solar:phone-linear' },
  { key: 'none', label: 'None', icon: 'solar:forbidden-circle-linear' },
];

// ── Outcome sets ──
// A message action splits its audience by what happened to the message; each
// outcome is a branch on the canvas. `rate` is the simulator's share of members
// landing on that branch (deterministic per member, see simulate.js).
export const OUTCOME_SETS = {
  emailStatus: {
    label: 'Email status',
    outcomes: [
      { key: 'opened', label: 'Opened', icon: 'solar:letter-opened-linear', rate: 0.62 },
      { key: 'notOpened', label: 'Not Opened', icon: 'solar:forbidden-circle-linear', rate: 0.38 },
    ],
  },
  formResponse: {
    label: 'Form sent and response',
    outcomes: [
      // Figma reads "All Sent"; a sent state can't follow "Few Submitted", so
      // the branch is labelled by submission like its siblings.
      { key: 'allSubmitted', label: 'All Submitted', icon: 'solar:check-square-linear', rate: 0.48 },
      { key: 'fewSubmitted', label: 'Few Submitted', icon: 'solar:checklist-minimalistic-linear', rate: 0.27 },
      { key: 'noneSubmitted', label: 'None Submitted', icon: 'solar:forbidden-circle-linear', rate: 0.25 },
    ],
  },
  appointmentStatus: {
    label: 'Appointment status',
    outcomes: [
      { key: 'booked', label: 'Booked', icon: 'solar:calendar-mark-linear', rate: 0.55 },
      { key: 'notBooked', label: 'Not Booked', icon: 'solar:calendar-minimalistic-linear', rate: 0.45 },
    ],
  },
  appOnboarding: {
    label: 'App onboarding status',
    outcomes: [
      { key: 'loggedIn', label: 'Logged In', icon: 'solar:login-2-linear', rate: 0.4 },
      { key: 'notLoggedIn', label: 'Not Logged In', icon: 'solar:logout-2-linear', rate: 0.6 },
    ],
  },
};

// ── Actions ──
// `channel`: how the simulator delivers it and which analytics card counts
// it. `requires`: config keys that must be set before Save / Test (the
// validator in graph.js names the field). `minutes`: staff time one execution
// saves, for "time saved" in analytics.
export const ACTIONS = [
  { type: 'sms', group: 'Send', family: 'send', icon: 'solar:chat-line-linear', label: 'SMS', nodeLabel: 'Send SMS', channel: 'sms', requires: ['message'], minutes: 3 },
  { type: 'email', group: 'Send', family: 'send', icon: 'solar:letter-linear', label: 'Email', nodeLabel: 'Send Email', channel: 'email', outcomes: 'emailStatus', requires: ['templateId'], minutes: 5 },
  { type: 'ivr', group: 'Send', family: 'send', icon: 'solar:phone-calling-linear', label: 'IVR', nodeLabel: 'IVR Call', channel: 'voice', requires: ['script'], minutes: 8 },
  { type: 'preferredChannelMessage', group: 'Send', family: 'send', icon: 'solar:star-linear', label: 'Via member’s preferred mode of communication', nodeLabel: 'Send via Preferred Channel', channel: 'preferred', requires: ['message'], minutes: 5 },
  { type: 'reminder', group: 'Send', family: 'send', icon: 'solar:bell-linear', label: 'Reminder', nodeLabel: 'Send Reminder', channel: 'email', outcomes: 'emailStatus', requires: ['templateId'], minutes: 4, needsMessageAncestor: true },
  { type: 'form', group: 'Send', family: 'send', icon: 'solar:document-text-linear', label: 'Forms', nodeLabel: 'Send Form', channel: 'email', outcomes: 'formResponse', requires: ['formIds', 'templateId'], minutes: 6 },
  { type: 'appointmentLink', group: 'Send', family: 'send', icon: 'solar:calendar-add-linear', label: 'Appointment Link', nodeLabel: 'Appointment Link', channel: 'email', outcomes: 'appointmentStatus', requires: ['templateId'], minutes: 6 },
  { type: 'push', group: 'Send', family: 'send', icon: 'solar:bell-bing-linear', label: 'Push Notification', nodeLabel: 'Push Notification', channel: 'push', requires: ['message'], minutes: 2 },
  { type: 'appInvitation', group: 'Send', family: 'send', icon: 'solar:smartphone-linear', label: 'Application Invitation', nodeLabel: 'Application Invitation', channel: 'email', outcomes: 'appOnboarding', requires: ['templateId'], minutes: 4 },
  { type: 'education', group: 'Send', family: 'send', icon: 'solar:book-linear', label: 'Education Content', nodeLabel: 'Send Patient Education', channel: 'email', outcomes: 'emailStatus', requires: ['contentTitle', 'templateId'], minutes: 5 },
  { type: 'lab', group: 'Order', family: 'order', icon: 'solar:test-tube-linear', label: 'Lab', nodeLabel: 'Order Lab', channel: null, requires: ['labTest'], minutes: 10 },
  { type: 'microAutomation', group: 'Add', family: 'add', icon: 'solar:bolt-linear', label: 'Micro Automation', nodeLabel: 'Micro Automation', channel: null, requires: [], minutes: 0, isGroup: true },
  { type: 'generalTask', group: 'Add', family: 'add', icon: 'solar:checklist-minimalistic-linear', label: 'General Task', nodeLabel: 'General Task', channel: 'task', requires: ['title', 'description', 'assignee', 'priority'], minutes: 10 },
  // Not in the Figma: the former Automation Rules' action (attach care plan
  // templates in draft and queue a review task).
  { type: 'attachCarePlan', group: 'Care plan', family: 'add', icon: 'solar:clipboard-list-linear', label: 'Attach care plan templates', nodeLabel: 'Attach Care Plan', channel: 'task', requires: ['templateIds'], minutes: 15, triggers: ['careProgramEnrolled'] },
  // Every open goal / intervention / barrier in the program → one status, with a reason.
  { type: 'setGbiStatus', group: 'Care plan', family: 'add', icon: 'solar:clipboard-check-linear', label: 'Update care plan item statuses', nodeLabel: 'Update GBI Status', channel: null, requires: ['toStatus'], minutes: 5, triggers: ['careProgramStatusChanged'] },
];
export const ACTION_GROUPS = [...new Set(ACTIONS.map(a => a.group))];

// ── Logic ──
export const LOGIC = [
  { type: 'and', icon: 'solar:link-round-linear', label: 'AND', help: 'Adds another condition the member must also match.' },
  { type: 'or', icon: 'solar:route-linear', label: 'OR', help: 'Adds alternative conditions; the member continues down every branch they match.' },
  { type: 'delay', icon: 'solar:clock-circle-linear', label: 'Delay', help: 'Waits before the next step. Skipped during a test run.', requires: ['amount', 'unit'] },
  { type: 'repeat', icon: 'solar:refresh-linear', label: 'Repeat', help: 'Repeats the previous step on an interval until the branch changes or the limit is reached.', requires: ['every', 'unit', 'times'] },
];

export const DELAY_UNITS = [
  { value: 'minutes', label: 'Minutes' },
  { value: 'hours', label: 'Hours' },
  { value: 'days', label: 'Days' },
  { value: 'weeks', label: 'Weeks' },
];

const unitLabel = (unit, n) => {
  const u = DELAY_UNITS.find(d => d.value === unit)?.label || unit || '';
  return Number(n) === 1 ? u.replace(/s$/, '') : u;
};
export const formatDuration = (amount, unit) => `${amount} ${unitLabel(unit, amount)}`;

// Run Automation options in the Save panel. Anything but 'manual' is an
// automatic execution type.
export const RUN_SCHEDULES = [
  { value: 'onTrigger', label: 'When the trigger fires' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Every week' },
  { value: 'monthly', label: 'Every month' },
  { value: 'manual', label: 'Manually only' },
];
export const scheduleLabel = (v) => RUN_SCHEDULES.find(s => s.value === v)?.label || 'When the trigger fires';
export const executionTypeOf = (schedule) => (schedule === 'manual' ? 'Manual' : 'Automatic');

export const STATUSES = [
  { value: 'draft', label: 'Draft', tone: 'grey' },
  { value: 'active', label: 'Active', tone: 'success' },
  { value: 'inactive', label: 'Inactive', tone: 'warning' },
];
export const statusDef = (v) => STATUSES.find(s => s.value === v) || STATUSES[0];

export const TEMPLATE_CATEGORIES = [
  { key: 'careCompliance', label: 'Care compliance' },
  { key: 'careDelivery', label: 'Care delivery' },
  { key: 'feedback', label: 'Feedback' },
  { key: 'outreach', label: 'Outreach' },
];
export const categoryLabel = (key) => TEMPLATE_CATEGORIES.find(c => c.key === key)?.label || key;

// One lookup for any node type, with the family resolved.
const DEF_BY_TYPE = new Map([
  ...TRIGGERS.map(t => [t.type, { ...t, kind: 'trigger', family: 'trigger', nodeLabel: 'Trigger' }]),
  ...CONDITIONS.map(c => [c.type, { ...c, kind: 'condition', family: 'condition', nodeLabel: c.label }]),
  ...ACTIONS.map(a => [a.type, { ...a, kind: 'action' }]),
  ...LOGIC.map(l => [l.type, { ...l, kind: 'logic', family: 'logic', nodeLabel: l.label }]),
]);
export const nodeDef = (type) => DEF_BY_TYPE.get(type) || null;

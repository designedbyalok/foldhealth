import { PROGRAM_STEPS } from '../../patient/data/programActivityMock.js';
import { CARE_PROGRAM_CATALOG } from '../../patient/data/careProgramCatalog.js';
import { defaultCadence, withCadenceDefaults } from '../../patient/right-panel/tabs/care-programs/care-plan/lib/cadence.js';

/**
 * Care Program Configuration (Settings): a program type and everything about
 * how it runs: its steps, worklists, care team, completion criteria and who
 * can see and change it. Stored one row per program type in
 * `care_program_types` (supabase/care_program_types_migration.sql).
 *
 * Steps are a tree: `{ id, name, kind?, type?: 'section', enabled, mandatory,
 * hasAlert?, custom?, screen?, formId?, formName?, children? }`. What a step
 * opens in the patient's program (ProgramDetailView): its linked form
 * (`formId`, from Settings > Content > Forms), else its built-in `screen`,
 * else the screen its `name` matches. So any step can be renamed once its
 * screen is set. Step ids never change: a patient's saved step status is
 * keyed by them.
 */

export const PROGRAM_STATUSES = [
  { value: 'active', label: 'Active', tone: 'success' },
  { value: 'draft', label: 'Draft', tone: 'warning' },
  { value: 'inactive', label: 'Inactive', tone: 'grey' },
];

/**
 * Steps every program lists (switched off until needed). `screen: false`:
 * no step screen yet. Assessments aren't here: they're forms built in
 * Settings > Content > Forms and linked to a program's section as needed.
 */
export const STEP_LIBRARY = [
  { name: 'Outreach', group: 'Engagement' },
  { name: 'Letters', group: 'Engagement' },
  { name: 'Snapshot', group: 'Engagement' },
  { name: 'Care Plan', group: 'Care' },
  { name: 'Appointment', group: 'Care' },
  { name: 'ICT Appointment', group: 'Care' },
  { name: 'Medication Reconciliation', group: 'Care' },
  { name: 'Open Care Gaps', group: 'Care' },
  { name: 'Open Diagnosis Gaps', group: 'Care' },
  { name: 'Referral Review', group: 'Care' },
  { name: 'Clinical Notes', group: 'Care', screen: false },
  { name: 'Orders', group: 'Care', screen: false },
  { name: 'Program Related Task', group: 'Records' },
  { name: 'Program Related Files', group: 'Records' },
  { name: 'Billing Review', group: 'Records', kind: 'billing' },
];
const LIBRARY_BY_NAME = new Map(STEP_LIBRARY.map(s => [s.name, s]));

/**
 * Built-in screens a step can open, by name: the library steps that have a
 * screen plus the built-in assessments.
 */
export const STEP_SCREENS = [
  ...STEP_LIBRARY.filter(l => l.screen !== false).map(l => l.name),
  'Pre-visit', 'HRA', 'BRCSI Assessment', 'SNP Assessment', 'Post IP Assessment', 'Post Visit Checklist',
];

/** What a step opens: 'form' (a linked form), 'screen' (a built-in screen) or 'none' (nothing yet). */
export function stepOpens(step) {
  if (step?.formId) return 'form';
  return stepScreen(step) ? 'screen' : 'none';
}

/** The built-in screen a step opens: its `screen`, else the one its name matches. */
export function stepScreen(step) {
  if (!step) return null;
  if (step.screen) return step.screen;
  const name = canonical(step.name);
  return STEP_SCREENS.find(sc => sc.toLowerCase() === String(name).toLowerCase()) || null;
}

/** Sections that hold assessments (Program Directives, Assessments): their steps can be linked from the Forms library and removed. */
export const holdsAssessments = section => section?.type === 'section'
  && (/directive|assessment/i.test(section.name) || (section.children || []).some(c => c.formId));

// Step names programs already use for a library step (same screen).
const STEP_ALIASES = {
  'program documents': 'Program Related Files',
  'documents': 'Program Related Files',
  'medication review': 'Medication Reconciliation',
  'care gaps': 'Open Care Gaps',
  'task': 'Program Related Task',
};
const canonical = name => STEP_ALIASES[String(name).toLowerCase()] || LIBRARY_BY_NAME.get(name)?.name
  || STEP_LIBRARY.find(l => l.name.toLowerCase() === String(name).toLowerCase())?.name || name;

/**
 * Every program lists every step: its own (in its order) plus the rest of
 * the library, switched off, so turning a step on is all it takes.
 * Ids are fixed per step name, so this can run again without adding
 * anything twice.
 */
export function withLibrarySteps(steps = []) {
  const present = new Set(steps.flatMap(st => (st.type === 'section' ? (st.children || []) : [st])).map(st => canonical(st.name)));
  const missing = STEP_LIBRARY.filter(l => !present.has(l.name));
  const entry = l => ({ id: `lib-${slug(l.name)}`, name: l.name, enabled: false, mandatory: false, ...(l.kind ? { kind: l.kind } : {}) });
  const full = missing.length ? [...steps, ...missing.map(entry)] : steps;
  if (full.some(holdsAssessments)) return full;
  // Somewhere to link assessments: an empty Program Directives after Outreach / Letters.
  const directives = { id: 'lib-program-directives', name: 'Program Directives', type: 'section', enabled: true, mandatory: false, children: [] };
  const after = Math.max(full.findIndex(st => st.name === 'Outreach'), full.findIndex(st => st.name === 'Letters'));
  return [...full.slice(0, after + 1), directives, ...full.slice(after + 1)];
}

/** Care team roles a program maps to a team. */
export const CARE_TEAM_ROLES = ['Care Manager', 'Care Coordinator', 'Nurse', 'Physician/PCP', 'Social Worker', 'Pharmacist', 'Outreach Specialist'];

export const ASSIGNMENT_MODES = [
  { value: 'manual', label: 'Manual', hint: 'Someone picks the assignee for each patient.' },
  { value: 'round-robin', label: 'Round robin', hint: 'New patients go to the assignees in turn.' },
  { value: 'care-team', label: 'Care team', hint: 'The patient’s Care Manager from the care team mapping.' },
];

export const COMPLETION_STATUSES = ['Completed', 'Discontinued', 'Closed'];

export const DEFAULT_COMPLETION = {
  requireMandatorySteps: true,
  requireCarePlanSigned: false,
  minOutreachAttempts: null,
  maxDurationDays: null,
  autoCloseInactiveDays: null,
  completionStatus: 'Completed',
};

export const DEFAULT_ACCESS = {
  showInNavigation: true,
  navigationRoles: [],   // empty: everyone
  enrollRoles: [],
  settingsRoles: ['Admin/Practice Manager'],
};

// ── Ids ──
const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const newId = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
export const programTypeId = code => `cpt-${slug(code)}`;

// ── Built-in steps → configuration ──
function toConfigStep(step) {
  const base = {
    id: step.id,
    name: step.name,
    enabled: true,
    mandatory: !!step.mandatory,
    ...(step.kind ? { kind: step.kind } : {}),
    ...(step.hasAlert ? { hasAlert: true } : {}),
  };
  if (step.type === 'section') return { ...base, type: 'section', children: (step.children || []).map(toConfigStep) };
  return base;
}

const step = (id, name, extra = {}) => ({ id, name, enabled: true, mandatory: false, ...extra });
const off = (id, name, extra = {}) => step(id, name, { enabled: false, ...extra });

/**
 * SNP as listed for the configuration: Snapshot, Outreach, Letters, Program
 * Directives (Pre-visit and the assessments), Model of Care (Care Plan, ICT Appointment), Medication
 * Reconciliation, Care Gaps, Task, Referral, Clinical Notes, Diagnosis Gaps,
 * Documents, Orders, Billing. Existing steps keep their ids and settings, so
 * patients' progress doesn't change; the new ones start switched off.
 */
const SNP_STEPS = [
  step('step-3s', 'Snapshot'),
  step('step-1', 'Outreach'),
  step('step-2', 'Letters', { mandatory: true }),
  step('step-3', 'Program Directives', {
    type: 'section',
    children: [
      step('step-3a', 'Pre-visit', { mandatory: true }),
      step('step-3b', 'HRA', { hasAlert: true }),
      step('step-3c', 'BRCSI Assessment'),
      step('step-3d', 'SNP Assessment', { mandatory: true }),
      step('step-6', 'Post Visit Checklist', { mandatory: true }),
    ],
  }),
  step('step-4', 'Model of Care', {
    type: 'section',
    children: [
      step('step-4a', 'Care Plan', { mandatory: true }),
      step('step-5', 'ICT Appointment', { mandatory: true }),
    ],
  }),
  step('step-8', 'Medication Reconciliation'),
  step('step-7', 'Open Care Gaps'),
  step('step-9', 'Program Related Task'),
  step('step-11', 'Referral Review', { mandatory: true }),
  off('snp-clinical-notes', 'Clinical Notes'),
  off('snp-diagnosis-gaps', 'Open Diagnosis Gaps'),
  step('step-10', 'Program Related Files', { mandatory: true }),
  off('snp-orders', 'Orders'),
  off('snp-billing', 'Billing Review', { kind: 'billing' }),
];

const DESCRIPTIONS = {
  SNP: 'Special Needs Plan care management: outreach, assessments, model of care and ICT review.',
  CCM: 'Chronic Care Management: monthly time-based care management and billing.',
  AWV: 'Annual Wellness Visit: outreach, pre-visit assessments and the visit itself.',
};

/** The program types the app starts with: the enrollable catalog plus CCM. */
export function defaultProgramTypes() {
  const catalog = [...CARE_PROGRAM_CATALOG, { code: 'CCM', name: 'Chronic Care Management' }];
  return catalog.map((entry, i) => {
    const steps = withLibrarySteps(entry.code === 'SNP' ? SNP_STEPS : (PROGRAM_STEPS[entry.code] || []).map(toConfigStep));
    return {
      id: programTypeId(entry.code),
      code: entry.code,
      name: entry.name,
      description: DESCRIPTIONS[entry.code] || '',
      status: 'active',
      allowMultiple: entry.code === 'SNP',
      steps,
      worklists: [{
        id: `${programTypeId(entry.code)}-wl`,
        name: `${entry.code} Worklist`,
        description: `Every patient enrolled in ${entry.name}.`,
        assignmentMode: 'manual',
        assigneeIds: [],
        statuses: [],
        showInNavigation: true,
      }],
      careTeam: [{ id: `${programTypeId(entry.code)}-cm`, role: 'Care Manager', teamId: null, defaultAssigneeId: null, stepIds: [] }],
      completion: DEFAULT_COMPLETION,
      cadence: defaultCadence(entry.code),
      access: DEFAULT_ACCESS,
      sortOrder: i,
      createdBy: 'System',
      createdAt: null,
      updatedAt: null,
    };
  });
}

/** A new, empty program type. */
export function blankProgramType({ code, name, description = '' }, sortOrder = 0) {
  return {
    id: programTypeId(code),
    code,
    name,
    description,
    status: 'draft',
    allowMultiple: false,
    steps: withLibrarySteps([]),
    worklists: [],
    careTeam: [],
    completion: DEFAULT_COMPLETION,
    cadence: defaultCadence(code),
    access: DEFAULT_ACCESS,
    sortOrder,
  };
}

/** A copy of `steps` with fresh ids (for "start from another program"). */
export function cloneSteps(steps) {
  return steps.map(s => ({
    ...s,
    id: newId('step'),
    ...(s.children ? { children: cloneSteps(s.children) } : {}),
  }));
}

// ── Configuration → the live program view ──
/**
 * The steps the patient's program shows, in the shape the program view
 * reads (PROGRAM_STEPS): only those switched on, sections with nothing on
 * left out.
 */
export function runtimeSteps(steps = []) {
  return steps
    .filter(s => s.enabled !== false)
    .map((s) => {
      const out = { id: s.id, name: s.name, mandatory: !!s.mandatory };
      if (s.kind) out.kind = s.kind;
      if (s.hasAlert) out.hasAlert = true;
      if (s.screen) out.screen = s.screen;
      if (s.formId) { // a form linked from the Forms library
        out.formId = s.formId;
        if (s.formName) out.formName = s.formName;
      }
      if (s.type === 'section') {
        out.type = 'section';
        out.expanded = true;
        out.children = runtimeSteps(s.children || []);
      }
      return out;
    })
    .filter(s => s.type !== 'section' || s.children.length > 0);
}

/** On / mandatory / total counts over every step (sections counted by their steps). */
export function stepCounts(steps = []) {
  const flat = steps.flatMap(s => (s.type === 'section' ? (s.children || []).map(c => ({ ...c, enabled: s.enabled !== false && c.enabled !== false })) : [s]));
  return {
    total: flat.length,
    on: flat.filter(s => s.enabled !== false).length,
    mandatory: flat.filter(s => s.enabled !== false && s.mandatory).length,
  };
}

// ── Rows ──
export function programTypeToRow(t) {
  return {
    id: t.id,
    code: t.code,
    name: t.name,
    description: t.description || '',
    status: t.status || 'active',
    allow_multiple: !!t.allowMultiple,
    steps: t.steps || [],
    worklists: t.worklists || [],
    care_team: t.careTeam || [],
    completion: t.completion || DEFAULT_COMPLETION,
    cadence: t.cadence || defaultCadence(t.code),
    access: t.access || DEFAULT_ACCESS,
    sort_order: t.sortOrder ?? 0,
    created_by: t.createdBy || null,
  };
}

export function rowToProgramType(r) {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    description: r.description || '',
    status: r.status || 'active',
    allowMultiple: !!r.allow_multiple,
    steps: withLibrarySteps(Array.isArray(r.steps) ? r.steps : []),
    worklists: Array.isArray(r.worklists) ? r.worklists : [],
    careTeam: Array.isArray(r.care_team) ? r.care_team : [],
    completion: { ...DEFAULT_COMPLETION, ...(r.completion || {}) },
    // An empty object (a row from before the cadence migration) reads as the program's default.
    cadence: withCadenceDefaults(r.code, r.cadence && Object.keys(r.cadence).length ? r.cadence : null),
    access: { ...DEFAULT_ACCESS, ...(r.access || {}) },
    sortOrder: r.sort_order ?? 0,
    createdBy: r.created_by || '',
    createdAt: r.created_at || null,
    updatedAt: r.updated_at || null,
  };
}

import { supabase } from '../../lib/supabase';
import { goalProgressAuditDetail } from '../../features/patient/right-panel/tabs/care-programs/care-plan/lib/goalMetrics';
import {
  barrierPayloadFromTemplateEntry,
  goalPayloadFromTemplateEntry,
  interventionPayloadFromTemplateEntry,
  templateLinkOwners,
} from '../../features/patient/right-panel/tabs/care-programs/care-plan/lib/carePlanTemplateApply';

// public.notifications row → the shape the bell popover already renders.
// `persisted: true` is what separates a DB-backed notification from a local
// ephemeral one, which decides whether read/dismiss also writes to Supabase.
/* ── Care Plan Library row ⇄ object mapping ──
   The drawer edits camelCase fields; the table is snake_case. Kept beside
   each other so a column rename can't drift from its reader. */
function mapCarePlanGoalRow(row, interventions = []) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    category: row.category || '',
    // The Type column predates `category`; both name the same thing.
    type: row.category || '',
    measure: row.measure || '',
    conditions: row.conditions || [],
    comparator: row.comparator || '=',
    targetValue: row.target_value || '',
    targetValue2: row.target_value_2 || '',
    customUnit: row.custom_unit || '',
    setTarget: row.set_target !== false,
    duration: row.duration || '',
    durationUnit: row.duration_unit || '',
    frequency: row.frequency || '',
    targetDate: row.target_date || '',
    priority: row.priority || 'medium',
    interventions,
    createdBy: row.created_by || '',
    updatedBy: row.updated_by || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Patient problem-list row (PAMI/Hx "Problems") ⇄ object.
function mapPatientProblemRow(row) {
  return {
    id: row.id,
    title: row.title,
    code: row.code || '',
    type: row.problem_type || '',
    severity: row.severity || '',
    status: row.status || 'Active',
    onsetLabel: row.onset_label || '',
    note: row.note || '',
    sortOrder: row.sort_order ?? 0,
  };
}

function mapPatientAllergyRow(row) {
  return {
    id: row.id,
    title: row.title,
    code: row.code || '',
    codeSystem: row.code_system || '',
    reactionType: row.reaction_type || '',
    criticality: row.criticality || '',
    sinceDate: row.since_date || '',
    reactions: row.reactions || [],
    status: row.status || 'Active',
    note: row.note || '',
    sortOrder: row.sort_order ?? 0,
  };
}

function mapPatientImmunizationRow(row) {
  return {
    id: row.id,
    title: row.title,
    code: row.code || '',
    codeSystem: row.code_system || '',
    dateAdministered: row.date_administered || '',
    doseQuantity: row.dose_quantity || '',
    doseUnits: row.dose_units || '',
    status: row.status || 'Active',
    note: row.note || '',
    sortOrder: row.sort_order ?? 0,
  };
}

function mapPatientSocialHistoryRow(row) {
  return {
    answers: row?.answers && typeof row.answers === 'object' ? row.answers : {},
    updatedAt: row?.updated_at || '',
  };
}

function mapPatientHistoryRow(row) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    code: row.code || '',
    codeSystem: row.code_system || '',
    detail: row.detail || '',
    relation: row.relation || '',
    recordedOn: row.recorded_on || '',
    synced: row.synced !== false,
    createdAt: row.created_at || '',
  };
}

function carePlanGoalToRow(g) {
  return {
    title: (g.title || '').trim(),
    description: g.description || '',
    category: g.category || '',
    measure: g.measure || '',
    conditions: g.conditions || [],
    comparator: g.comparator || '=',
    target_value: g.targetValue || '',
    target_value_2: g.targetValue2 || '',
    custom_unit: g.customUnit || '',
    set_target: g.setTarget !== false,
    duration: g.duration || '',
    duration_unit: g.durationUnit || '',
    frequency: g.frequency || '',
    target_date: g.targetDate || '',
    priority: g.priority || 'medium',
  };
}

function mapCarePlanBarrierRow(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    createdBy: row.created_by || '',
    updatedBy: row.updated_by || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCarePlanTemplateRow(row) {
  return {
    id: row.id,
    name: row.name,
    // Rows written before the status column existed are published.
    status: row.status || 'published',
    conditions: row.conditions || [],
    goals: row.goals || [],
    interventions: row.interventions || [],
    barriers: row.barriers || [],
    createdBy: row.created_by || '',
    updatedBy: row.updated_by || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Who it's for: 'org' (everyone), 'user' (owner only), 'patient'.
    // Rows from before the scope column are the shared library.
    scope: row.scope || 'org',
    ownerUserId: row.owner_user_id || null,
    patientId: row.patient_id || null,
  };
}

// Standalone (goal-independent) reusable intervention — the Interventions
// Library tab. Distinct from the goal-linked care_plan_interventions rows.
function mapCarePlanInterventionTemplateRow(row) {
  return {
    id: row.id,
    kind: row.kind || 'internal-task',
    title: row.title,
    description: row.description || '',
    config: row.config || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Goal-linked care_plan_interventions row (library goal drawer). */
function mapInterventionRow(row) {
  return {
    id: row.id,
    goalId: row.goal_id,
    kind: row.kind,
    title: row.title || '',
    config: row.config || {},
    createdAt: row.created_at,
  };
}

/* ── Patient Care Plan row ⇄ object mapping ──
   The per-patient, per-program plan behind the Care Plan step. Goals mirror
   the library goal shape (so a template instantiates cleanly) plus the fields
   the patient view shows and edits: currentValue, trend, status. Kept beside
   the library mappers so a shared column rename can't drift. */
function mapPatientCarePlanGoalRow(row) {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle || '',
    icon: row.icon || 'solar:flag-linear',
    priority: row.priority || 'medium',
    category: row.category || '',
    measure: row.measure || '',
    conditions: row.conditions || [],
    comparator: row.comparator || '=',
    targetValue: row.target_value || '',
    targetValue2: row.target_value_2 || '',
    customUnit: row.custom_unit || '',
    setTarget: row.set_target !== false,
    duration: row.duration || '',
    durationUnit: row.duration_unit || '',
    frequency: row.frequency || '',
    targetDate: row.target_date || '',
    currentValue: row.current_value || '',
    trend: row.trend || '-',
    status: row.status || 'Not Started',
    progress: row.progress ?? 0,
    updatedBy: row.updated_by || '',
    links: 0,
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function patientCarePlanGoalToRow(g, planId) {
  return {
    plan_id: planId,
    title: (g.title || '').trim(),
    subtitle: g.subtitle || '',
    icon: g.icon || 'solar:flag-linear',
    priority: g.priority || 'medium',
    category: g.category || '',
    measure: g.measure || '',
    conditions: g.conditions || [],
    comparator: g.comparator || '=',
    target_value: g.targetValue || '',
    target_value_2: g.targetValue2 || '',
    custom_unit: g.customUnit || '',
    set_target: g.setTarget !== false,
    duration: g.duration || '',
    duration_unit: g.durationUnit || '',
    frequency: g.frequency || '',
    target_date: g.targetDate || '',
    current_value: g.currentValue || '',
    trend: g.trend || '-',
    status: g.status || 'Not Started',
    progress: Number.isFinite(g.progress) ? g.progress : 0,
    updated_by: g.updatedBy || null,
    sort_order: g.sortOrder ?? 0,
  };
}

function mapGoalMeasurementRow(row) {
  return {
    id: row.id,
    goalId: row.goal_id,
    value: row.value || '',
    unit: row.unit || '',
    favorable: row.favorable !== false,
    takenAt: row.taken_at,
    sortOrder: row.sort_order ?? 0,
  };
}

function mapCarePlanAutomationRow(row) {
  return {
    id: row.id,
    goalId: row.goal_id || null,
    title: row.title || '',
    icon: row.icon || 'solar:bolt-linear',
    enabled: row.enabled !== false,
    sortOrder: row.sort_order ?? 0,
  };
}

function mapPatientCarePlanInterventionRow(row) {
  // `taskId` is the FK to the paired tasks row that owns assignee, due
  // date, recurrence, and completion state (care_plan_intervention_task_link
  // migration). Falls back to the legacy `config.taskId` for pre-migration
  // rows so the UI can still find the paired task while the column is
  // rolling out.
  const taskId = row.task_id
    || (row.config && typeof row.config === 'object' ? row.config.taskId : null)
    || null;
  return {
    id: row.id,
    goalId: row.goal_id || null,
    taskId,
    kind: row.kind || '',
    title: row.title || '',
    icon: row.icon || 'solar:clipboard-list-linear',
    priority: row.priority || 'medium',
    duration: row.duration || null,
    config: row.config || {},
    assignee: { name: row.assignee_name || 'Unassigned', initials: row.assignee_initials || '' },
    status: row.status || 'Not Started',
    adherence: row.adherence || '-',
    links: 0,
    sortOrder: row.sort_order ?? 0,
    updatedBy: row.updated_by || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function patientCarePlanInterventionToRow(i, planId) {
  return {
    plan_id: planId,
    goal_id: i.goalId || null,
    task_id: i.taskId || null,
    kind: i.kind || '',
    title: (i.title || '').trim(),
    icon: i.icon || 'solar:clipboard-list-linear',
    priority: i.priority || 'medium',
    duration: i.duration || null,
    config: i.config || {},
    assignee_name: i.assignee?.name || 'Unassigned',
    assignee_initials: i.assignee?.initials || '',
    status: i.status || 'Not Started',
    adherence: i.adherence || '-',
    updated_by: i.updatedBy || null,
    sort_order: i.sortOrder ?? 0,
  };
}

function mapPatientCarePlanBarrierRow(row, goalIdsFromJoin = null) {
  // `goalIds` is the many-to-many set of goal ids linked to this barrier
  // (Figma / spec: patient_care_plan_barrier_goals migration). We prefer
  // the join-table set when provided; before the migration runs we fall
  // back to the legacy 1:1 goal_id column so the UI never renders empty.
  const legacyGoal = row.goal_id || null;
  const goalIds = Array.isArray(goalIdsFromJoin) && goalIdsFromJoin.length > 0
    ? [...new Set(goalIdsFromJoin.filter(Boolean))]
    : (legacyGoal ? [legacyGoal] : []);
  return {
    id: row.id,
    goalId: legacyGoal,
    goalIds,
    title: row.title || '',
    description: row.description || '',
    status: row.status || 'Not Started',
    priority: row.priority || 'medium',
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function patientCarePlanBarrierToRow(b, planId) {
  return {
    plan_id: planId,
    goal_id: b.goalId || null,
    title: (b.title || '').trim(),
    description: b.description || '',
    status: b.status || 'Not Started',
    priority: b.priority || 'medium',
    sort_order: b.sortOrder ?? 0,
  };
}

// Sync a barrier's goal set in the join table. Returns the goal ids that ended
// up recorded — before the join-table migration that is the legacy column only.
async function linkBarrierGoals(barrierId, goalIds) {
  const del = await supabase.from('patient_care_plan_barrier_goals').delete().eq('barrier_id', barrierId);
  const missingJoin = del.error && (del.error.code === '42P01' || del.error.code === 'PGRST205');
  if (missingJoin) return goalIds.slice(0, 1);
  if (!goalIds.length) return [];
  const ins = await supabase.from('patient_care_plan_barrier_goals')
    .insert(goalIds.map(gid => ({ barrier_id: barrierId, goal_id: gid })));
  if (!ins.error) return goalIds;
  if (ins.error.code !== '42P01' && ins.error.code !== 'PGRST205') {
    console.warn('linkBarrierGoals:', ins.error.message);
  }
  return goalIds.slice(0, 1);
}

function mapPatientCarePlanRow(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    programId: row.program_id,
    programCode: row.program_code || '',
    createdBy: row.created_by || '',
    conditions: (row.conditions || []).map(label => ({ label })),
    conditionTotal: row.condition_total ?? (row.conditions || []).length,
    appliedTemplateIds: row.applied_template_ids || [],
    // { [templateId]: 'low' | 'medium' | 'high' } — categorizes the applied
    // templates on the sticky-top strip. Empty until Alok Kumar runs the
    // care_plan_applied_template_priorities migration.
    appliedTemplatePriorities: row.applied_template_priorities && typeof row.applied_template_priorities === 'object'
      ? row.applied_template_priorities
      : {},
    createdDate: row.created_at,
    updatedAt: row.updated_at || null,
    signedBy: row.signed_by || null,
    signedAt: row.signed_at || null,
  };
}

// State key for a patient's plan on one program.
function carePlanKey(patientId, programId) {
  return `${patientId}::${programId}`;
}

// `progressBandLabel` / `goalProgressAuditDetail` moved to
// `features/.../care-plan/lib/goalMetrics.js` as `goalProgressBand` /
// `goalProgressAuditDetail` so the audit-log detail string and the drawer
// readout share one source of truth.

// Derive an audit entry from a goal/intervention save by diffing against its
// previous state — a create, a status change, a progress change, a rename,
// or a generic edit. Progress is its own action so the Goal Details activity
// feed can render the "changed the Progress" row with from → to badges.
// A template's contents as they sit on the plan. There is no template_id on
// goal / intervention / barrier rows, so the link back is the title, exactly
// as the applied-templates strip resolves it.
function templateContents(template, slice, libraryGoals) {
  const norm = v => (v || '').trim().toLowerCase();
  const titlesOf = (list, isGoal) => new Set((list || []).map(e => {
    if (isGoal && e?.id) {
      const lib = (libraryGoals || []).find(g => g.id === e.id);
      if (lib?.title) return norm(lib.title);
    }
    return norm(e?.title || '');
  }).filter(Boolean));
  const goalTitles = titlesOf(template.goals, true);
  const goals = (slice?.goals || []).filter(g => goalTitles.has(norm(g.title)));
  const goalIds = new Set(goals.map(g => g.id));
  const intvTitles = titlesOf(template.interventions);
  const barrierTitles = titlesOf(template.barriers);
  // Interventions match on title only, as the applied-templates strip does; a
  // later intervention hung off a template goal is not the template's.
  const interventions = (slice?.interventions || [])
    .filter(i => intvTitles.has(norm(i.title)));
  const barriers = (slice?.barriers || [])
    .filter(b => barrierTitles.has(norm(b.title))
      || (b.goalIds || []).some(id => goalIds.has(id))
      || goalIds.has(b.goalId));
  const barrierGoals = b => (b.goalIds?.length ? b.goalIds : [b.goalId]).filter(Boolean);
  // Goals carry what hangs off them, so History can show the linkage rather
  // than three unrelated lists.
  return {
    goals: goals.map(g => ({
      title: g.title,
      interventions: interventions.filter(i => i.goalId === g.id).map(i => i.title),
      barriers: barriers.filter(b => barrierGoals(b).includes(g.id)).map(b => b.title),
    })),
    // Whatever the template brought that hangs off no goal of its own.
    interventions: interventions.filter(i => !goalIds.has(i.goalId)).map(i => i.title),
    barriers: barriers.filter(b => !barrierGoals(b).some(id => goalIds.has(id))).map(b => b.title),
  };
}

// Templates recorded by earlier signatures, replayed oldest-first so the set
// reflects what the previous version carried.
function templatesAtLastSignature(auditEntries) {
  const ids = new Set();
  for (const e of [...(auditEntries || [])].reverse()) {
    if (e.entityType !== 'template') continue;
    if (e.action === 'created') ids.add(String(e.entityId));
    else if (e.action === 'deleted') ids.delete(String(e.entityId));
  }
  return ids;
}

// Fields that earn their own history line, beyond the status / progress /
// title cases handled below. Each one records a `from → to` detail so the
// History drawer can render the change instead of a bare "Edited".
const capitalize = v => (v ? String(v).charAt(0).toUpperCase() + String(v).slice(1) : '');
const AUDIT_FIELDS = {
  common: [
    { action: 'priority_changed', read: e => e.priority, format: capitalize },
  ],
  goal: [
    { action: 'category_changed', read: g => g.category },
    { action: 'measure_changed', read: g => g.measure },
    { action: 'target_changed', read: g => [g.comparator, g.targetValue, g.targetValue2].filter(Boolean).join(' ') },
    { action: 'target_date_changed', read: g => g.targetDate },
    { action: 'duration_changed', read: g => [g.duration, g.durationUnit].filter(Boolean).join(' ') },
    { action: 'frequency_changed', read: g => g.frequency },
    { action: 'value_changed', read: g => g.currentValue },
    { action: 'conditions_changed', read: g => (g.conditions || []).join(', ') },
  ],
  intervention: [
    { action: 'type_changed', read: i => i.kind },
    { action: 'duration_changed', read: i => i.duration },
    { action: 'assignee_changed', read: i => i.assignee?.name },
    { action: 'goal_link_changed', read: i => i.goalId },
  ],
  barrier: [
    { action: 'description_changed', read: b => b.description },
    { action: 'goal_link_changed', read: b => (b.goalIds || []).join(', ') },
  ],
};

// An intervention's kind-specific settings live in a free-form `config` blob,
// so it is diffed key by key. The detail is written as "Label: from → to";
// History reads that label as the caption.
const CONFIG_LABEL = {
  form: 'Form', content: 'Content', vital: 'Vital', note: 'Note',
  description: 'Description', creationTiming: 'Task Creation',
  creationCount: 'Creation Count', creationTrigger: 'Creation Trigger',
  dueOffset: 'Due Offset', dueUnit: 'Due Unit', durationType: 'Duration Type',
  // dueDateOverride is written when the reviewer picks a concrete date
  // from the inline DatePickerPopover on the intervention row; log it as
  // "Due Date" so History carries the same wording the row shows.
  dueDateOverride: 'Due Date',
  repeat: 'Repeat', repeatCount: 'Repeat Count', repeatEvery: 'Repeats Every',
  repeatEveryUnit: 'Repeat Unit', repeatEnds: 'Repeat Ends',
  repeatEndsUnit: 'Repeat Ends Unit', memberTaskTitle: 'Member Task Title',
  startDate: 'Start Date', endDate: 'End Date',
};
function configValue(v) {
  if (v == null || v === '') return '';
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  if (typeof v === 'boolean') return v ? 'On' : 'Off';
  return String(v);
}
function configChanges(base, prevConfig, nextConfig) {
  const a = prevConfig || {};
  const b = nextConfig || {};
  return [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .filter(k => CONFIG_LABEL[k] && configValue(a[k]) !== configValue(b[k]))
    .map(k => ({
      ...base,
      action: 'updated',
      detail: `${CONFIG_LABEL[k]}: ${configValue(a[k]) || '—'} → ${configValue(b[k]) || '—'}`,
    }));
}

// Returns every change a save made, so editing two fields writes two rows
// rather than collapsing to whichever the cascade checked first.
function auditForSave(entityType, next, prev) {
  if (!prev) return { entityType, entityId: next.id, action: 'created', summary: next.title };
  const base = { entityType, entityId: next.id, summary: next.title };
  const changes = [];
  if (prev.status !== next.status) {
    changes.push({ ...base, action: 'status_changed', detail: `${prev.status} → ${next.status}` });
  }
  if ((prev.progress ?? 0) !== (next.progress ?? 0)) {
    changes.push({ ...base, action: 'progress_changed', detail: `${goalProgressAuditDetail(prev.progress)} → ${goalProgressAuditDetail(next.progress)}` });
  }
  if (entityType === 'intervention' && String(prev.adherence ?? '-') !== String(next.adherence ?? '-')) {
    const from = Number(prev.adherence) || 0;
    const to = Number(next.adherence) || 0;
    changes.push({ ...base, action: 'progress_changed', detail: `${goalProgressAuditDetail(from)} → ${goalProgressAuditDetail(to)}` });
  }
  if (prev.title !== next.title) {
    changes.push({ ...base, action: 'updated', detail: `Renamed from "${prev.title}"` });
  }
  for (const field of [...AUDIT_FIELDS.common, ...(AUDIT_FIELDS[entityType] || [])]) {
    const from = field.read(prev) ?? '';
    const to = field.read(next) ?? '';
    if (String(from) === String(to)) continue;
    const fmt = field.format || (v => String(v ?? ''));
    changes.push({ ...base, action: field.action, detail: `${fmt(from) || '—'} → ${fmt(to) || '—'}` });
  }
  changes.push(...configChanges(base, prev.config, next.config));
  // A save that changed nothing we can name leaves no history line: an
  // "Edited" row with no detail tells the reader nothing.
  return changes;
}

function mapCarePlanAuditRow(row) {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    summary: row.summary || '',
    detail: row.detail || '',
    actor: row.actor || '',
    programCode: row.program_code || '',
    createdAt: row.created_at,
  };
}

/**
 * Put one template's goals, interventions and barriers onto a patient's plan.
 *
 * Deduped by title, so it is safe to run against a plan that already holds
 * some of them: applying a template and reconciling a template that was
 * applied earlier are the same operation, and share this code.
 */
async function applyTemplateToPlan(get, patientId, program, template, libraryGoals) {
  const key = carePlanKey(patientId, program.id);
  const norm = v => (v || '').trim().toLowerCase();
  const slice = () => get().patientCarePlans[key];
  const existingGoalTitles = new Set((slice()?.goals || []).map(g => norm(g.title)));
  const existingIntvTitles = new Set((slice()?.interventions || []).map(i => norm(i.title)));
  const existingBarrierTitles = new Set((slice()?.barriers || []).map(b => norm(b.title)));

  for (const entry of template.goals || []) {
    const payload = goalPayloadFromTemplateEntry(entry, libraryGoals);
    const titleKey = norm(payload.title);
    if (!payload.title || existingGoalTitles.has(titleKey)) continue;
    const saved = await get().savePatientCarePlanGoal(patientId, program, payload);
    if (saved) existingGoalTitles.add(titleKey);
  }

  // Interventions and barriers come after the goals so the goal they belong to
  // is already on the plan and resolves to a real id. The link itself lives on
  // the library goal, not on the template row. Anything whose goal isn't on the
  // plan is still added, unlinked, rather than dropped.
  const owners = templateLinkOwners(template, libraryGoals);
  const planGoalIdByTitle = new Map((slice()?.goals || []).map(g => [norm(g.title), g.id]));
  const goalIdsFor = (map, title) => (map.get(title) || [])
    .map(t => planGoalIdByTitle.get(norm(t)))
    .filter(Boolean);

  for (const entry of template.interventions || []) {
    const titleKey = norm(entry?.title);
    if (!titleKey || existingIntvTitles.has(titleKey)) continue;
    // An intervention is 1:1 with a goal, so it takes the first owner.
    const payload = interventionPayloadFromTemplateEntry(
      entry, goalIdsFor(owners.intervention, titleKey)[0] || null,
    );
    const saved = await get().savePatientCarePlanIntervention(patientId, program, payload);
    if (saved) existingIntvTitles.add(titleKey);
  }

  for (const entry of template.barriers || []) {
    const titleKey = norm(entry?.title);
    if (!titleKey || existingBarrierTitles.has(titleKey)) continue;
    const saved = await get().savePatientCarePlanBarrier(
      patientId, program,
      barrierPayloadFromTemplateEntry(entry, goalIdsFor(owners.barrier, titleKey)),
    );
    if (saved) existingBarrierTitles.add(titleKey);
  }
}

export {
  mapCarePlanGoalRow,
  mapPatientProblemRow,
  mapPatientAllergyRow,
  mapPatientImmunizationRow,
  mapPatientHistoryRow,
  mapPatientSocialHistoryRow,
  carePlanGoalToRow,
  mapCarePlanBarrierRow,
  mapCarePlanTemplateRow,
  mapCarePlanInterventionTemplateRow,
  mapInterventionRow,
  mapPatientCarePlanGoalRow,
  patientCarePlanGoalToRow,
  mapGoalMeasurementRow,
  mapCarePlanAutomationRow,
  mapPatientCarePlanInterventionRow,
  patientCarePlanInterventionToRow,
  mapPatientCarePlanBarrierRow,
  patientCarePlanBarrierToRow,
  linkBarrierGoals,
  mapPatientCarePlanRow,
  carePlanKey,
  templateContents,
  templatesAtLastSignature,
  auditForSave,
  mapCarePlanAuditRow,
  applyTemplateToPlan,
};

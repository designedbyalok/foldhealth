/* Clinical criteria: whether a patient's chronic conditions, labs, recent
   encounters and assessment answers match, and why. The "Patient matches
   clinical criteria" condition uses it (formerly Settings > Automation Rules;
   rules now live as automations, see enrollmentRules.js). Pure JS so it's
   tested on its own; the store gathers the inputs (runAutoApplyRules).

   A rule: { id, name, enabled, programCodes: string[] (empty = any),
     match: 'all' | 'any', conditions: Condition[], templateIds, reviewer }
   A condition is one of:
     { type: 'condition', value }                         chronic condition
     { type: 'lab', lab, op, value, withinDays }          latest lab result
     { type: 'assessment', formId, question, op, value }  latest answer
     { type: 'score', score, op, value, withinDays }      latest scored screening (PHQ-9)
     { type: 'event', event, withinDays }                 recent encounter */

export const LAB_CATALOG = [
  { key: 'hba1c', label: 'HbA1c', unit: '%', loinc: ['4548-4', '17856-6'], match: /a1c/i },
  { key: 'ldl', label: 'LDL cholesterol', unit: 'mg/dL', loinc: ['13457-7', '18262-6', '2089-1'], match: /\bldl\b/i },
  { key: 'sbp', label: 'Systolic blood pressure', unit: 'mmHg', loinc: ['8480-6'], match: /systolic/i },
  { key: 'egfr', label: 'eGFR', unit: 'mL/min/1.73m²', loinc: ['33914-3', '48642-3', '62238-1'], match: /\be?gfr\b/i },
  { key: 'bmi', label: 'BMI', unit: 'kg/m²', loinc: ['39156-5'], match: /\bbmi\b|body mass/i },
  { key: 'uacr', label: 'Urine albumin-to-creatinine ratio', unit: 'mg/g', loinc: ['9318-7', '14959-1', '32294-1'], match: /albumin\s*(\/|-to-)\s*creatinine|\bu?acr\b/i },
];
// Scored screenings recorded as patient_clinical_events (event_type 'prom'
// or 'assessment') with the total in numeric_value. Answers to a Fold form
// are the 'assessment' criterion instead.
export const SCORE_CATALOG = [
  { key: 'phq9', label: 'PHQ-9', unit: '', loinc: ['44261-6'], match: /phq-?9/i },
];
export const EVENT_CATALOG = [
  { key: 'ed', label: 'ED visit', match: /emergency|\bed\b|\ber\b/i },
  { key: 'inpatient', label: 'Inpatient admission', match: /inpatient|admission|admitted|hospitali[sz]/i },
  { key: 'any', label: 'Any encounter', match: /./ },
];
export const NUMERIC_OPS = ['>', '>=', '<', '<=', '='];
export const ANSWER_OPS = ['equals', 'contains', ...NUMERIC_OPS];
export const CONDITION_TYPES = [
  { key: 'condition', label: 'Chronic condition' },
  { key: 'lab', label: 'Lab result' },
  { key: 'assessment', label: 'Assessment answer' },
  { key: 'score', label: 'Assessment score' },
  { key: 'event', label: 'Recent event' },
];

const withLoinc = (list) => new Map(list.map(l => [l.key, { ...l, loincSet: new Set(l.loinc) }]));
const LAB_BY_KEY = withLoinc(LAB_CATALOG);
const SCORE_BY_KEY = withLoinc(SCORE_CATALOG);
const labDef = (key) => LAB_BY_KEY.get(key) || null;
const scoreDef = (key) => SCORE_BY_KEY.get(key) || null;
const eventDef = (key) => EVENT_CATALOG.find(e => e.key === key) || null;
const norm = (s) => String(s ?? '').trim().toLowerCase();
const pad = (n) => String(n).padStart(2, '0');
const fmtDate = (d) => (d ? `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}` : '');
const toDate = (v) => {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v));
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const daysBetween = (a, b) => Math.floor((b - a) / 86400000);

function compare(left, op, right) {
  if (op === '>') return left > right;
  if (op === '>=') return left >= right;
  if (op === '<') return left < right;
  if (op === '<=') return left <= right;
  if (op === '=') return left === right;
  return false;
}
const OP_WORD = { '>': 'above', '>=': 'at or above', '<': 'below', '<=': 'at or below', '=': 'equal to' };

/** Plain-language summary of a condition, for the rules list and reasons. */
export function describeCondition(c) {
  if (c?.type === 'condition') return `Has ${c.value || '…'}`;
  if (c?.type === 'lab') {
    const lab = labDef(c.lab);
    return `${lab?.label || 'Lab'} ${c.op || '>'} ${c.value ?? '…'}${lab?.unit ? ` ${lab.unit}` : ''}${c.withinDays ? ` (last ${c.withinDays} days)` : ''}`;
  }
  if (c?.type === 'assessment') return `Assessment answer "${c.question || '…'}" ${c.op || 'equals'} ${c.value ?? '…'}`;
  if (c?.type === 'score') {
    return `${scoreDef(c.score)?.label || 'Score'} ${c.op || '>='} ${c.value ?? '…'}${c.withinDays ? ` (last ${c.withinDays} days)` : ''}`;
  }
  if (c?.type === 'event') return `${eventDef(c.event)?.label || 'Event'} in the last ${c.withinDays || 30} days`;
  return 'Unknown condition';
}

/**
 * The patient's facts the rules read, from what the store loads:
 * problems (patient_problems), conditions (the patient's condition chips),
 * clinicalEvents (patient_clinical_events: diagnoses, labs, encounters) and
 * responses (form_responses for the patient).
 */
export function buildRuleInputs({ problems = [], conditions = [], clinicalEvents = [], responses = [] }) {
  const conds = [
    ...problems.filter(p => norm(p.status || 'active') !== 'resolved').map(p => ({ label: p.title, source: 'problem list' })),
    ...conditions.filter(Boolean).map(c => ({ label: typeof c === 'string' ? c : c.label, source: 'conditions' })),
    ...clinicalEvents.filter(e => e.event_type === 'diagnosis' && norm(e.status || 'active') !== 'resolved')
      .map(e => ({ label: e.display || e.code, source: 'diagnosis' })),
  ].filter(c => c.label);
  const labs = clinicalEvents
    .filter(e => e.event_type === 'lab' && e.numeric_value != null)
    .map(e => ({ code: e.code || '', display: e.display || '', value: Number(e.numeric_value), unit: e.unit || '', date: toDate(e.effective_date) }));
  const scores = clinicalEvents
    .filter(e => (e.event_type === 'prom' || e.event_type === 'assessment') && e.numeric_value != null)
    .map(e => ({ code: e.code || '', display: e.display || '', value: Number(e.numeric_value), unit: '', date: toDate(e.effective_date) }));
  const events = clinicalEvents
    .filter(e => e.event_type === 'encounter')
    .map(e => ({ display: [e.display, e.code].filter(Boolean).join(' '), date: toDate(e.effective_date) }));
  const assessments = responses
    .filter(r => r && r.answers && (r.status || 'completed') === 'completed')
    .map(r => ({ formId: r.form_id != null ? String(r.form_id) : '', answers: r.answers, date: toDate(r.completed_at || r.created_at) }))
    .sort((a, b) => (b.date || 0) - (a.date || 0));
  return { conditions: conds, labs, scores, events, assessments };
}

// The latest reading of a lab or score against the threshold, within the window.
function latestReading(def, readings, c, today, defaultOp, noun) {
  const latest = readings
    .filter(l => def.loincSet.has(l.code) || def.match.test(l.display))
    .sort((a, b) => (b.date || 0) - (a.date || 0))[0];
  if (!latest) return { ok: false, text: `No ${def.label} ${noun}` };
  if (c.withinDays && latest.date && daysBetween(latest.date, today) > Number(c.withinDays)) {
    return { ok: false, text: `Latest ${def.label} (${fmtDate(latest.date)}) is older than ${c.withinDays} days` };
  }
  const op = c.op || defaultOp;
  const ok = compare(latest.value, op, Number(c.value));
  const unit = latest.unit || def.unit;
  const reading = `${def.label} ${latest.value}${unit ? ` ${unit}` : ''} on ${fmtDate(latest.date)}`;
  return { ok, text: `${reading} is ${ok ? '' : 'not '}${OP_WORD[op]} ${c.value}` };
}

function evaluateCondition(c, inputs, today) {
  if (c?.type === 'condition') {
    const want = norm(c.value);
    const hit = want && inputs.conditions.find(x => norm(x.label).includes(want));
    return hit
      ? { ok: true, text: `Has ${c.value} (${hit.source}: ${hit.label})` }
      : { ok: false, text: `No ${c.value || 'condition'} on record` };
  }
  if (c?.type === 'lab') {
    const lab = labDef(c.lab);
    if (!lab) return { ok: false, text: 'Unknown lab' };
    return latestReading(lab, inputs.labs, c, today, '>', 'result');
  }
  if (c?.type === 'score') {
    const score = scoreDef(c.score);
    if (!score) return { ok: false, text: 'Unknown score' };
    return latestReading(score, inputs.scores || [], c, today, '>=', 'score');
  }
  if (c?.type === 'assessment') {
    const resp = inputs.assessments.find(a => !c.formId || a.formId === String(c.formId));
    const raw = resp?.answers?.[c.question];
    if (raw == null) return { ok: false, text: `No answer to "${c.question}"` };
    const answer = Array.isArray(raw) ? raw.join(', ') : String(raw);
    const op = c.op || 'equals';
    const ok = op === 'equals' ? norm(answer) === norm(c.value)
      : op === 'contains' ? norm(answer).includes(norm(c.value))
        : compare(Number(answer), op, Number(c.value));
    return { ok, text: `Answered "${answer}" to "${c.question}"${resp.date ? ` on ${fmtDate(resp.date)}` : ''}` };
  }
  if (c?.type === 'event') {
    const ev = eventDef(c.event);
    const within = Number(c.withinDays) || 30;
    const hit = ev && inputs.events
      .filter(e => e.date && daysBetween(e.date, today) <= within && daysBetween(e.date, today) >= 0 && ev.match.test(e.display))
      .sort((a, b) => b.date - a.date)[0];
    return hit
      ? { ok: true, text: `${ev.label} on ${fmtDate(hit.date)} (${hit.display})` }
      : { ok: false, text: `No ${ev?.label.toLowerCase() || 'event'} in the last ${within} days` };
  }
  return { ok: false, text: 'Unknown condition' };
}

/** Whether a rule matches, with one reason per condition. A rule with no conditions never matches. */
export function evaluateRule(rule, inputs, today = new Date()) {
  const results = (rule?.conditions || []).map(c => evaluateCondition(c, inputs, today));
  if (!results.length) return { matched: false, reasons: [{ ok: false, text: 'The rule has no conditions' }] };
  const matched = rule.match === 'any' ? results.some(r => r.ok) : results.every(r => r.ok);
  return { matched, reasons: results };
}

/** The enabled rules that watch a program (empty program list = any). */
export const rulesForProgram = (rules, programCode) => (rules || []).filter(r => r.enabled
  && (!(r.programCodes || []).length || r.programCodes.includes(programCode)));

/** Why a rule can't be saved yet, or null. */
export function ruleProblem(rule) {
  if (!rule?.name?.trim()) return 'Name the rule.';
  if (!(rule.conditions || []).length) return 'Add at least one condition.';
  for (const c of rule.conditions) {
    if (c.type === 'condition' && !norm(c.value)) return 'Name the chronic condition.';
    if (c.type === 'lab' && (!labDef(c.lab) || c.value === '' || c.value == null || Number.isNaN(Number(c.value)))) return 'Give the lab a numeric threshold.';
    if (c.type === 'assessment' && (!c.question?.trim() || c.value === '' || c.value == null)) return 'Give the assessment question and answer.';
    if (c.type === 'score' && (!scoreDef(c.score) || c.value === '' || c.value == null || Number.isNaN(Number(c.value)))) return 'Give the score a numeric threshold.';
    if (c.type === 'event' && !eventDef(c.event)) return 'Pick the kind of event.';
  }
  if (!(rule.templateIds || []).length) return 'Pick at least one template to attach.';
  return null;
}

/** automation_rules row → rule. */
export function mapAutomationRuleRow(row) {
  return {
    id: row.id,
    name: row.name || '',
    description: row.description || '',
    enabled: row.enabled !== false,
    programCodes: row.program_codes || [],
    match: row.match === 'any' ? 'any' : 'all',
    conditions: Array.isArray(row.conditions) ? row.conditions : [],
    templateIds: row.template_ids || [],
    reviewer: row.reviewer && row.reviewer.name ? row.reviewer : null,
    sortOrder: row.sort_order ?? 0,
    updatedBy: row.updated_by || '',
    updatedAt: row.updated_at || null,
  };
}

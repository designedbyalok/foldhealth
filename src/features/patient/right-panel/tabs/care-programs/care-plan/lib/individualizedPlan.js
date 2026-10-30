/* Individualized Plan AI: from a patient's chronic conditions, latest
   assessments, barriers, recent events and lab trends to a tailored draft GBI
   set, every item citing the inputs that drove it.

   1. buildPatientFacts numbers the patient's inputs (F1, F2, …) as short
      lines the model can cite, the reviewer can read, and that are kept with
      each item exactly as they read when the plan was drafted.
   2. The server sends the facts plus the template and library catalogs to
      the model (buildIndividualizedPrompt, INDIVIDUALIZED_SCHEMA).
   3. normalizeIndividualizedDraft keeps only what's grounded: real fact ids,
      real templates and library items, and drops any item that cites nothing.
   With `recommended` (templates the org's enrollment automations matched to
   this patient), the model must merge ALL of them into one plan instead of
   picking its own; the caps grow with how many there are.
   Shared by the API handler and the store; plain JS with explicit .js
   imports so the server can load it. */

import { CARE_PLAN_TITLE_MAX } from '../../../../../../settings/care-plan-library/lib/carePlanLimits.js';

const MAX_FACTS = 60;
const MAX_TEMPLATES = 2;
const MAX_GOALS = 6;
const MAX_INTERVENTIONS = 12;
const MAX_BARRIERS = 8;
// Automation-recommended templates merged into one plan.
const MAX_RECOMMENDED = 6;
const EVENT_WINDOW_DAYS = 180;
const LAB_WINDOW_DAYS = 730;

export const INTERVENTION_KINDS = ['internal-task', 'patient-task', 'patient-education', 'measure-vital', 'send-form'];
export const GOAL_FREQUENCIES = ['Daily', 'Weekly', 'Monthly', 'Quarterly'];
const PRIORITIES = ['high', 'medium', 'low'];

const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const norm = (s) => String(s ?? '').trim().toLowerCase();
const pad = (n) => String(n).padStart(2, '0');
const toDate = (v) => {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const fmt = (d) => (d ? `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}` : '');
const iso = (d) => (d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : null);
const daysAgo = (d, today) => Math.floor((today - d) / 86400000);
const num = (v) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10));

/**
 * The patient's inputs as citable facts: [{ id: 'F1', kind, text, date }].
 *   problems        patient_problems rows { title, status }
 *   clinicalEvents  patient_clinical_events rows (diagnosis, lab, encounter)
 *   responses       form_responses rows for the patient { form_id, answers, … }
 *   formNames       Map form id → name
 *   barriers        open barriers already on the patient's plans { title, program }
 */
export function buildPatientFacts({ problems = [], clinicalEvents = [], responses = [], formNames = new Map(), barriers = [] }, today = new Date()) {
  const facts = [];
  const add = (kind, text, date = null) => {
    if (facts.length < MAX_FACTS && text) facts.push({ id: `F${facts.length + 1}`, kind, text: clip(text, 220), date: iso(date) });
  };

  // Chronic conditions: the problem list, then diagnoses not already named.
  const seen = new Set();
  for (const p of problems) {
    if (norm(p.status || 'active') === 'resolved' || !p.title || seen.has(norm(p.title))) continue;
    seen.add(norm(p.title));
    add('condition', `${p.title} (problem list)`);
  }
  for (const e of clinicalEvents) {
    if (e.event_type !== 'diagnosis' || norm(e.status || 'active') === 'resolved') continue;
    const label = e.display || e.code;
    if (!label || seen.has(norm(label))) continue;
    seen.add(norm(label));
    const d = toDate(e.effective_date);
    add('condition', `${label} (diagnosed${d ? ` ${fmt(d)}` : ''})`, d);
  }

  // Lab trends: each lab's series, latest first, with its direction.
  const series = new Map();
  for (const e of clinicalEvents) {
    if (e.event_type !== 'lab' || e.numeric_value == null) continue;
    const d = toDate(e.effective_date);
    if (d && daysAgo(d, today) > LAB_WINDOW_DAYS) continue;
    const key = e.code || norm(e.display);
    series.set(key, [...(series.get(key) || []), { ...e, d, v: Number(e.numeric_value) }]);
  }
  for (const list of series.values()) {
    list.sort((a, b) => (a.d || 0) - (b.d || 0));
    const latest = list[list.length - 1];
    const prev = list.length > 1 ? list[list.length - 2] : null;
    const unit = latest.unit ? ` ${latest.unit}` : '';
    const name = latest.display || latest.code;
    const range = latest.reference_high != null && latest.v > Number(latest.reference_high) ? ', above range'
      : latest.reference_low != null && latest.v < Number(latest.reference_low) ? ', below range' : '';
    if (prev) {
      const dir = latest.v > prev.v ? 'rising' : latest.v < prev.v ? 'falling' : 'steady';
      add('lab_trend', `${name} ${num(prev.v)} → ${num(latest.v)}${unit} (${fmt(prev.d)} → ${fmt(latest.d)}), ${dir}${range}`, latest.d);
    } else {
      add('lab', `${name} ${num(latest.v)}${unit} on ${fmt(latest.d)}${range}`, latest.d);
    }
  }

  // Recent events: encounters in the last six months, newest first.
  clinicalEvents
    .filter(e => e.event_type === 'encounter')
    .map(e => ({ e, d: toDate(e.effective_date) }))
    .filter(({ d }) => d && daysAgo(d, today) >= 0 && daysAgo(d, today) <= EVENT_WINDOW_DAYS)
    .sort((a, b) => b.d - a.d)
    .forEach(({ e, d }) => add('event', `${e.display || e.code || 'Encounter'} on ${fmt(d)}`, d));

  // Latest assessment per form.
  const latestByForm = new Map();
  for (const r of responses) {
    if (!r?.answers || (r.status || 'completed') !== 'completed') continue;
    const d = toDate(r.completed_at || r.created_at);
    const k = String(r.form_id);
    if (!latestByForm.has(k) || (d && d > latestByForm.get(k).d)) latestByForm.set(k, { r, d });
  }
  for (const [formId, { r, d }] of latestByForm) {
    const answers = Object.entries(r.answers).slice(0, 8)
      .map(([q, a]) => `${q} = ${Array.isArray(a) ? a.join(', ') : a}`).join('; ');
    if (answers) add('assessment', `${formNames.get(formId) || `Form ${formId}`}${d ? ` (${fmt(d)})` : ''}: ${answers}`, d);
  }

  // Barriers already open on the patient's plans.
  for (const b of barriers) {
    if (b?.title) add('barrier', `${b.title} (open barrier${b.program ? ` on ${b.program}` : ''})`);
  }
  return facts;
}

/** Published org templates as the model sees them. */
export function buildTemplateChoices(templates = [], libraryGoals = []) {
  const goalTitle = new Map(libraryGoals.map(g => [String(g.id), g.title]));
  return templates
    .filter(t => (t.status || 'published') === 'published' && (t.scope || 'org') === 'org')
    .slice(0, 120)
    .map(t => ({
      id: String(t.id),
      name: clip(t.name, 100),
      conditions: (t.conditions || []).slice(0, 6),
      goals: (t.goals || []).map(g => goalTitle.get(String(g.id)) || g.title).filter(Boolean).slice(0, 8),
    }));
}

/**
 * How many templates and items a draft may hold. Several automation-matched
 * templates merge into one plan, so the room grows with them (to a ceiling).
 */
export function draftLimits(recommendedCount = 0) {
  const n = Math.min(recommendedCount, MAX_RECOMMENDED);
  if (!n) return { templates: MAX_TEMPLATES, goals: MAX_GOALS, interventions: MAX_INTERVENTIONS, barriers: MAX_BARRIERS };
  const extra = n - 1;
  return {
    templates: n,
    goals: Math.min(MAX_GOALS + 2 * extra, 12),
    interventions: Math.min(MAX_INTERVENTIONS + 4 * extra, 24),
    barriers: Math.min(MAX_BARRIERS + 2 * extra, 14),
  };
}

/** Automation matches as the model sees them, only for templates it was sent. */
export function recommendedForPrompt(recommended = [], templates = []) {
  const known = new Set(templates.map(t => String(t.id)));
  const seen = new Set();
  return (Array.isArray(recommended) ? recommended : [])
    .filter(r => r && known.has(String(r.templateId)) && !seen.has(String(r.templateId)) && seen.add(String(r.templateId)))
    .slice(0, MAX_RECOMMENDED)
    .map(r => ({
      templateId: String(r.templateId),
      rule: clip(r.rule, 120),
      criteria: (Array.isArray(r.criteria) ? r.criteria : []).map(c => clip(c, 160)).slice(0, 8),
    }));
}

const citations = { type: 'array', items: { type: 'string' }, description: 'fact ids (F1, F2, …) that justify this item' };
const libraryRef = {
  libraryId: { type: 'string', nullable: true, description: 'library id, or null for a new item' },
  title: { type: 'string' },
  rationale: { type: 'string' },
  citations,
};

export const INDIVIDUALIZED_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    templates: {
      type: 'array',
      items: { type: 'object', properties: { templateId: { type: 'string' }, why: { type: 'string' }, citations }, required: ['templateId', 'why', 'citations'] },
    },
    goals: {
      type: 'array',
      items: {
        type: 'object',
        properties: { ...libraryRef, priority: { type: 'string', enum: PRIORITIES }, frequency: { type: 'string', enum: GOAL_FREQUENCIES } },
        required: ['libraryId', 'title', 'rationale', 'citations', 'priority'],
      },
    },
    interventions: {
      type: 'array',
      items: {
        type: 'object',
        properties: { ...libraryRef, kind: { type: 'string', enum: INTERVENTION_KINDS }, goalTitle: { type: 'string', nullable: true } },
        required: ['libraryId', 'title', 'rationale', 'citations', 'kind'],
      },
    },
    barriers: {
      type: 'array',
      items: {
        type: 'object',
        properties: { ...libraryRef, goalTitles: { type: 'array', items: { type: 'string' } } },
        required: ['libraryId', 'title', 'rationale', 'citations'],
      },
    },
  },
  required: ['summary', 'templates', 'goals', 'interventions', 'barriers'],
};

export function buildIndividualizedPrompt({ facts, templates, catalog, programName, recommended = [] }) {
  const matches = recommendedForPrompt(recommended, templates);
  const limits = draftLimits(matches.length);
  const pick = matches.length
    ? [
      `- The organization's automations matched every template in MATCHES to this patient (each with the rule and the criteria the patient met). Use ALL of them: list each in templates with why and the facts it rests on.`,
      `- Then merge them into ONE tailored plan: up to ${limits.goals} goals, up to ${limits.interventions} interventions and up to ${limits.barriers} barriers. Where templates overlap, keep a single item. Leave out what the FACTS show doesn't apply to this patient, and add what this patient specifically needs.`,
    ]
    : [
      `- First pick up to ${limits.templates} templates from TEMPLATES that best fit this patient, each with why and the facts it rests on. Pick none if none fit.`,
      `- Then draft a tailored set: up to ${limits.goals} goals, up to ${limits.interventions} interventions and up to ${limits.barriers} barriers. Use the chosen templates' goals where they fit this patient, add what this patient specifically needs, and leave out what doesn't apply.`,
    ];
  return [
    `You draft an individualized care plan for one patient enrolled in ${programName || 'a care program'}. A care manager reviews every item before the plan is signed.`,
    '',
    'Rules:',
    ...pick,
    '- Reuse the LIBRARY: when an item means the same as a library entry, return its id as libraryId and its exact title. Only use libraryId null for something the library lacks.',
    '- Every item must cite at least one fact id from FACTS that shows why this patient needs it, and give a one-sentence rationale that refers to those facts. Never cite a fact that does not support the item. Do not invent data: no dates, lab values, diagnoses or targets that are not in FACTS.',
    '- Link each intervention to the goal it serves by goalTitle (exactly as you titled the goal), and each barrier to the goals it blocks by goalTitles.',
    '- summary: one plain sentence describing the plan\'s focus for this patient.',
    '',
    'FACTS (JSON):',
    JSON.stringify(facts.map(f => ({ id: f.id, kind: f.kind, text: f.text }))),
    '',
    'TEMPLATES (JSON):',
    JSON.stringify(templates),
    ...(matches.length ? ['', 'MATCHES (JSON):', JSON.stringify(matches)] : []),
    '',
    'LIBRARY (JSON):',
    JSON.stringify(catalog),
  ].join('\n');
}

const indexCatalog = (entries = []) => ({
  byId: new Map(entries.map(e => [String(e.id), e])),
  byTitle: new Map(entries.map(e => [norm(e.title), e])),
});
function resolveRef(ref, { byId, byTitle }) {
  const hit = byId.get(String(ref?.libraryId ?? '')) || byTitle.get(norm(ref?.title));
  return hit
    ? { libraryId: String(hit.id), title: hit.title, lib: hit }
    : { libraryId: null, title: clip(ref?.title, CARE_PLAN_TITLE_MAX), lib: null };
}

/**
 * The model's answer, grounded: citations kept only when they're real fact
 * ids (stored as the fact's text so the item keeps its evidence), templates
 * and library items only when they exist, links resolved to drafted goals,
 * and any item left with no citation dropped. Null when no goal survives.
 */
export function normalizeIndividualizedDraft(raw, { facts = [], templates = [], catalog = { goals: [], interventions: [], barriers: [] }, recommended = [] }) {
  if (!raw || typeof raw !== 'object') return null;
  const factById = new Map(facts.map(f => [f.id, f]));
  const cite = (ids) => [...new Set((Array.isArray(ids) ? ids : []).map(x => String(x).trim().toUpperCase()))]
    .map(id => factById.get(id)).filter(Boolean)
    .map(f => ({ fact: f.id, kind: f.kind, text: f.text, date: f.date }));
  const idx = { goals: indexCatalog(catalog.goals), interventions: indexCatalog(catalog.interventions), barriers: indexCatalog(catalog.barriers) };
  const templateById = new Map(templates.map(t => [String(t.id), t]));
  const matches = recommendedForPrompt(recommended, templates);
  const ruleOf = new Map(matches.map(m => [m.templateId, m.rule]));
  const limits = draftLimits(matches.length);

  const pickedTemplates = [];
  for (const t of Array.isArray(raw.templates) ? raw.templates : []) {
    const tpl = templateById.get(String(t?.templateId));
    const c = cite(t?.citations);
    if (!tpl || !c.length || pickedTemplates.some(p => p.id === tpl.id) || pickedTemplates.length >= limits.templates) continue;
    if (matches.length && !ruleOf.has(String(tpl.id))) continue;
    pickedTemplates.push({ id: tpl.id, name: tpl.name, why: clip(t.why, 300), citations: c, ...(ruleOf.has(String(tpl.id)) ? { automation: ruleOf.get(String(tpl.id)) } : {}) });
  }
  // Every automation match stays on record even if the model left it out.
  for (const m of matches) {
    if (pickedTemplates.some(p => String(p.id) === m.templateId)) continue;
    const tpl = templateById.get(m.templateId);
    pickedTemplates.push({ id: tpl.id, name: tpl.name, why: clip(`Matched by automation: ${m.rule}`, 300), citations: [], automation: m.rule });
  }

  const goals = [];
  for (const g of Array.isArray(raw.goals) ? raw.goals : []) {
    if (goals.length >= limits.goals) break;
    const r = resolveRef(g, idx.goals);
    const c = cite(g?.citations);
    if (!r.title || !c.length || goals.some(x => norm(x.title) === norm(r.title))) continue;
    goals.push({
      libraryId: r.libraryId,
      title: r.title,
      priority: PRIORITIES.includes(norm(g.priority)) ? norm(g.priority) : 'medium',
      frequency: GOAL_FREQUENCIES.includes(g.frequency) ? g.frequency : (r.lib?.frequency || ''),
      rationale: clip(g.rationale, 300),
      citations: c,
    });
  }
  if (!goals.length) return null;
  const goalByTitle = new Map(goals.map(g => [norm(g.title), g.title]));
  const linkGoal = (t) => goalByTitle.get(norm(t)) || null;

  const interventions = [];
  for (const i of Array.isArray(raw.interventions) ? raw.interventions : []) {
    if (interventions.length >= limits.interventions) break;
    const r = resolveRef(i, idx.interventions);
    const c = cite(i?.citations);
    if (!r.title || !c.length || interventions.some(x => norm(x.title) === norm(r.title))) continue;
    interventions.push({
      libraryId: r.libraryId,
      title: r.title,
      kind: r.lib?.kind || (INTERVENTION_KINDS.includes(i.kind) ? i.kind : 'internal-task'),
      goalTitle: linkGoal(i.goalTitle),
      rationale: clip(i.rationale, 300),
      citations: c,
    });
  }

  const barriers = [];
  for (const b of Array.isArray(raw.barriers) ? raw.barriers : []) {
    if (barriers.length >= limits.barriers) break;
    const r = resolveRef(b, idx.barriers);
    const c = cite(b?.citations);
    if (!r.title || !c.length || barriers.some(x => norm(x.title) === norm(r.title))) continue;
    barriers.push({
      libraryId: r.libraryId,
      title: r.title,
      goalTitles: [...new Set((Array.isArray(b.goalTitles) ? b.goalTitles : []).map(linkGoal).filter(Boolean))],
      rationale: clip(b.rationale, 300),
      citations: c,
    });
  }

  return { summary: clip(raw.summary, 400), templates: pickedTemplates, goals, interventions, barriers };
}

/** "3 goals, 5 interventions, 2 barriers". */
export function draftCounts(draft) {
  const n = (k, one, many) => `${draft?.[k]?.length || 0} ${(draft?.[k]?.length || 0) === 1 ? one : many}`;
  return [n('goals', 'goal', 'goals'), n('interventions', 'intervention', 'interventions'), n('barriers', 'barrier', 'barriers')].join(', ');
}

/* Care plan template bulk import (Care Plan Library > Import). A supervisor
   uploads CSV or JSON holding templates, their goals, interventions and
   barriers, and which goal each intervention and barrier belongs to. This
   module parses the file, validates structure, references and conflicts with
   the library, and decides per template: add, update or skip. Pure JS; the
   store saves the result as drafts (importCarePlanTemplates).

   JSON: { "templates": [ {
     "name": "Diabetes Intensive", "conditions": ["Diabetes"], "renewal": "extend",
     "goals":         [{ "title", "description", "category", "priority" }],
     "interventions": [{ "title", "kind", "priority", "goal": "<goal title>" }],
     "barriers":      [{ "title", "description", "priority", "goals": ["<goal title>"] }]
   } ] }   (a bare array of templates also works)

   CSV, one row per item; template fields repeat on each row:
     template, conditions, renewal, type, title, description, category, kind, priority, goals
   type is goal | intervention | barrier. conditions and goals list several
   values separated by "|". goals names the goal(s) the item belongs to.

   Relationships stay on the template's own items (intervention.goalTitle,
   barrier.goalTitles), so importing never edits the shared library. */

import { GOAL_CATEGORIES, normalizeCategory } from './goalCategories';
import { INTERVENTION_KINDS } from './aiTemplateDraft';
import { CARE_PLAN_NAME_MAX, CARE_PLAN_TITLE_MAX } from './carePlanLimits';

export const CSV_COLUMNS = ['template', 'conditions', 'renewal', 'type', 'title', 'description', 'category', 'kind', 'priority', 'goals'];
const ITEM_TYPES = ['goal', 'intervention', 'barrier'];
const PRIORITIES = ['high', 'medium', 'low'];
const RENEWALS = ['extend', 'reinstate'];
export const MAX_IMPORT_TEMPLATES = 1000;

const norm = (s) => String(s ?? '').trim().toLowerCase();
const text = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const list = (v) => (Array.isArray(v) ? v : String(v ?? '').split('|')).map(text).filter(Boolean);
const uuid = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `imp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

// ── Parsing ──

/** RFC 4180 CSV: quoted fields, doubled quotes, commas and newlines inside quotes. */
export function parseCsv(input) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const s = String(input ?? '').replace(/^\uFEFF/, '');
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') { field += '"'; i += 1; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i += 1;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(x => text(x)));
}

/**
 * File text → { templates: raw template objects, fileErrors }. Each raw
 * template keeps `source` (CSV rows or JSON position) for messages.
 */
export function parseImportFile(fileName, content) {
  const isJson = /\.json$/i.test(fileName || '') || /^\s*[[{]/.test(content || '');
  return isJson ? parseJson(content) : parseCsvTemplates(content);
}

function parseJson(content) {
  let data;
  try { data = JSON.parse(content); } catch (e) {
    return { templates: [], fileErrors: [`The file isn't valid JSON: ${e.message}`] };
  }
  const arr = Array.isArray(data) ? data : data?.templates;
  if (!Array.isArray(arr)) return { templates: [], fileErrors: ['Expected a "templates" array (or an array of templates).'] };
  return {
    templates: arr.map((t, i) => ({
      source: `Template ${i + 1}`,
      name: t?.name,
      conditions: t?.conditions,
      renewal: t?.renewal,
      goals: (Array.isArray(t?.goals) ? t.goals : []).map(g => ({ ...g, description: g?.description ?? g?.subtitle })),
      interventions: (Array.isArray(t?.interventions) ? t.interventions : []).map(x => ({ ...x, goals: x?.goal ?? x?.goals })),
      barriers: Array.isArray(t?.barriers) ? t.barriers : [],
      shapeErrors: ['goals', 'interventions', 'barriers']
        .filter(k => t?.[k] != null && !Array.isArray(t[k]))
        .map(k => `"${k}" must be a list.`),
    })),
    fileErrors: [],
  };
}

function parseCsvTemplates(content) {
  const rows = parseCsv(content);
  if (!rows.length) return { templates: [], fileErrors: ['The file is empty.'] };
  const header = rows[0].map(norm);
  const missing = ['template', 'type', 'title'].filter(c => !header.includes(c));
  if (missing.length) {
    return { templates: [], fileErrors: [`Missing column${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}. Expected: ${CSV_COLUMNS.join(', ')}.`] };
  }
  const col = (r, name) => { const i = header.indexOf(name); return i < 0 ? '' : r[i]; };
  const byName = new Map();
  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const name = text(col(r, 'template'));
    const key = norm(name) || `__row${line}`;
    if (!byName.has(key)) {
      byName.set(key, { source: `Row ${line}`, lines: [], name, conditions: [], renewal: '', goals: [], interventions: [], barriers: [], shapeErrors: [] });
    }
    const t = byName.get(key);
    t.lines.push(line);
    for (const c of list(col(r, 'conditions'))) if (!t.conditions.some(x => norm(x) === norm(c))) t.conditions.push(c);
    if (!t.renewal && text(col(r, 'renewal'))) t.renewal = text(col(r, 'renewal'));
    const type = norm(col(r, 'type'));
    const item = {
      line,
      title: col(r, 'title'),
      description: col(r, 'description'),
      category: col(r, 'category'),
      kind: col(r, 'kind'),
      priority: col(r, 'priority'),
      goals: col(r, 'goals'),
    };
    if (type === 'goal') t.goals.push(item);
    else if (type === 'intervention') t.interventions.push(item);
    else if (type === 'barrier') t.barriers.push(item);
    else t.shapeErrors.push(`Row ${line}: type "${text(col(r, 'type')) || '(blank)'}" isn't one of ${ITEM_TYPES.join(', ')}.`);
  });
  const templates = [...byName.values()].map(t => ({ ...t, source: t.lines.length > 1 ? `Rows ${t.lines[0]}–${t.lines[t.lines.length - 1]}` : `Row ${t.lines[0]}` }));
  return { templates, fileErrors: [] };
}

// ── Validation ──

const at = (item, fallback) => (item?.line ? `Row ${item.line}` : fallback);

function cleanPriority(v, where, issues) {
  const p = norm(v);
  if (!p) return 'medium';
  if (PRIORITIES.includes(p)) return p;
  issues.push({ level: 'warning', message: `${where}: priority "${text(v)}" isn't high, medium or low; using medium.` });
  return 'medium';
}

// Comparable shape of a template, to tell an unchanged one from an update.
const fingerprint = (t) => JSON.stringify({
  conditions: [...(t.conditions || [])].map(norm).sort(),
  goals: (t.goals || []).map(g => [norm(g.title), norm(g.subtitle ?? g.description), norm(normalizeCategory(g.category)), norm(g.priority || 'medium')]).sort(),
  interventions: (t.interventions || []).map(i => [norm(i.title), norm(i.kind), norm(i.config?.priority || i.priority || 'medium'), norm(i.goalTitle)]).sort(),
  barriers: (t.barriers || []).map(b => [norm(b.title), norm(b.description), norm(b.priority || 'medium'), (b.goalTitles || []).map(norm).sort().join('|')]).sort(),
});

/**
 * Validate parsed templates against the library and decide what to do with each.
 *
 * `library`: { templates, goals } as the store holds them (carePlanTemplates,
 * carePlanGoals). Only organization templates count as conflicts.
 *
 * Returns { plans, totals } where each plan is
 *   { key, name, source, action: 'add' | 'update' | 'skip', why, issues,
 *     existing (the library template it updates or matches), template (to save),
 *     counts: { goals, interventions, barriers, libraryGoals } }
 * and an `error` issue always means skip.
 */
export function planTemplateImport(parsed, library = {}) {
  const orgTemplates = (library.templates || []).filter(t => (t.scope || 'org') === 'org');
  // A draft (an earlier import or Save as Draft) is updated in place; otherwise the published one.
  const draftByName = new Map(orgTemplates.filter(t => t.status === 'draft').map(t => [norm(t.name), t]));
  const publishedByName = new Map(orgTemplates.filter(t => t.status !== 'draft').map(t => [norm(t.name), t]));
  const libGoalByTitle = new Map((library.goals || []).map(g => [norm(g.title), g]));
  const seenNames = new Map();

  const plans = (parsed.templates || []).slice(0, MAX_IMPORT_TEMPLATES).map((raw, idx) => {
    const issues = (raw.shapeErrors || []).map(message => ({ level: 'error', message }));
    const name = text(raw.name);
    if (!name) issues.push({ level: 'error', message: 'The template has no name.' });
    else if (name.length > CARE_PLAN_NAME_MAX) issues.push({ level: 'error', message: `The name is longer than ${CARE_PLAN_NAME_MAX} characters.` });
    const dupOf = name && seenNames.get(norm(name));
    if (dupOf) issues.push({ level: 'error', message: `"${name}" appears twice in the file (also ${dupOf}).` });
    if (name && !dupOf) seenNames.set(norm(name), raw.source);

    let renewal = norm(raw.renewal);
    if (renewal && !RENEWALS.includes(renewal)) {
      issues.push({ level: 'warning', message: `Renewal "${text(raw.renewal)}" isn't extend or reinstate; using the default.` });
      renewal = '';
    }
    const conditions = list(raw.conditions);

    // Goals first: interventions and barriers refer to them by title.
    const goals = [];
    const goalTitles = new Map();
    let libraryGoals = 0;
    (raw.goals || []).forEach((g, i) => {
      const where = at(g, `Goal ${i + 1}`);
      const title = text(g?.title);
      if (!title) { issues.push({ level: 'error', message: `${where}: the goal has no title.` }); return; }
      if (title.length > CARE_PLAN_TITLE_MAX) { issues.push({ level: 'error', message: `${where}: the goal title is longer than ${CARE_PLAN_TITLE_MAX} characters.` }); return; }
      if (goalTitles.has(norm(title))) { issues.push({ level: 'warning', message: `${where}: goal "${title}" is listed twice; kept once.` }); return; }
      let category = text(g?.category);
      if (category && !GOAL_CATEGORIES.includes(normalizeCategory(category))) {
        issues.push({ level: 'warning', message: `${where}: category "${category}" isn't one of ${GOAL_CATEGORIES.join(', ')}; using Others.` });
        category = 'Others';
      }
      const lib = libGoalByTitle.get(norm(title));
      if (lib) libraryGoals += 1;
      const entry = {
        // A goal already in the library is reused, so its measure and target carry over.
        id: lib?.id || uuid(),
        title: lib?.title || title,
        subtitle: text(g?.description) || lib?.description || '',
        category: normalizeCategory(category || lib?.category || 'Others'),
        priority: cleanPriority(g?.priority, where, issues),
      };
      goals.push(entry);
      goalTitles.set(norm(title), entry.title);
    });
    if (!goals.length && !issues.some(x => x.level === 'error' && /goal/.test(x.message))) {
      issues.push({ level: 'error', message: 'The template needs at least one goal.' });
    }

    const resolveGoals = (refs, where, kindWord) => {
      const out = new Set();
      for (const ref of list(refs)) {
        const t = goalTitles.get(norm(ref));
        if (t) out.add(t);
        else issues.push({ level: 'error', message: `${where}: ${kindWord} refers to goal "${ref}", which isn't in this template.` });
      }
      return [...out];
    };

    const interventions = [];
    const seenIntv = new Set();
    (raw.interventions || []).forEach((x, i) => {
      const where = at(x, `Intervention ${i + 1}`);
      const title = text(x?.title);
      if (!title) { issues.push({ level: 'error', message: `${where}: the intervention has no title.` }); return; }
      if (title.length > CARE_PLAN_TITLE_MAX) { issues.push({ level: 'error', message: `${where}: the intervention title is longer than ${CARE_PLAN_TITLE_MAX} characters.` }); return; }
      if (seenIntv.has(norm(title))) { issues.push({ level: 'warning', message: `${where}: intervention "${title}" is listed twice; kept once.` }); return; }
      seenIntv.add(norm(title));
      const kind = norm(x?.kind);
      if (!INTERVENTION_KINDS.includes(kind)) {
        issues.push({ level: 'error', message: `${where}: kind "${text(x?.kind) || '(blank)'}" isn't one of ${INTERVENTION_KINDS.join(', ')}.` });
        return;
      }
      const owners = resolveGoals(x?.goals, where, 'the intervention');
      if (owners.length > 1) issues.push({ level: 'warning', message: `${where}: an intervention belongs to one goal; linked to "${owners[0]}".` });
      if (!list(x?.goals).length) issues.push({ level: 'warning', message: `${where}: "${title}" isn't linked to a goal.` });
      const priority = cleanPriority(x?.priority, where, issues);
      interventions.push({ id: uuid(), title, kind, config: { priority }, ...(owners[0] ? { goalTitle: owners[0] } : {}) });
    });

    const barriers = [];
    const seenBarrier = new Set();
    (raw.barriers || []).forEach((b, i) => {
      const where = at(b, `Barrier ${i + 1}`);
      const title = text(b?.title);
      if (!title) { issues.push({ level: 'error', message: `${where}: the barrier has no title.` }); return; }
      if (title.length > CARE_PLAN_TITLE_MAX) { issues.push({ level: 'error', message: `${where}: the barrier title is longer than ${CARE_PLAN_TITLE_MAX} characters.` }); return; }
      if (seenBarrier.has(norm(title))) { issues.push({ level: 'warning', message: `${where}: barrier "${title}" is listed twice; kept once.` }); return; }
      seenBarrier.add(norm(title));
      const owners = resolveGoals(b?.goals, where, 'the barrier');
      barriers.push({
        id: uuid(), title, description: text(b?.description), priority: cleanPriority(b?.priority, where, issues),
        ...(owners.length ? { goalTitles: owners } : {}),
      });
    });

    const template = { name, conditions, goals, interventions, barriers, ...(renewal ? { renewal } : {}) };
    const counts = { goals: goals.length, interventions: interventions.length, barriers: barriers.length, libraryGoals };
    const base = { key: `${idx}:${norm(name)}`, name: name || '(no name)', source: raw.source, issues, template, counts };

    if (issues.some(x => x.level === 'error')) return { ...base, action: 'skip', why: 'Fix the errors to import it', existing: null };
    const draft = draftByName.get(norm(name));
    if (draft) {
      return fingerprint(draft) === fingerprint(template)
        ? { ...base, action: 'skip', why: 'Already in Draft Templates, unchanged', existing: draft }
        : { ...base, action: 'update', why: 'Updates the existing draft', existing: draft };
    }
    const published = publishedByName.get(norm(name));
    if (published) {
      return fingerprint(published) === fingerprint(template)
        ? { ...base, action: 'skip', why: 'Already in the library, unchanged', existing: published }
        : { ...base, action: 'update', why: 'Saved as a draft revision; replaces the published template when approved', existing: published };
    }
    return { ...base, action: 'add', why: 'New template', existing: null };
  });

  const totals = { add: 0, update: 0, skip: 0, errors: 0, warnings: 0 };
  for (const p of plans) {
    totals[p.action] += 1;
    if (p.issues.some(x => x.level === 'error')) totals.errors += 1;
    if (p.issues.some(x => x.level === 'warning')) totals.warnings += 1;
  }
  const truncated = (parsed.templates || []).length > MAX_IMPORT_TEMPLATES;
  return { plans, totals, truncated };
}

// ── Samples ──

export const SAMPLE_CSV = [
  CSV_COLUMNS.join(','),
  'Diabetes Intensive Monitoring,Diabetes,extend,goal,Lower HbA1c below 8%,Bring HbA1c under 8% within 6 months,Labs,,high,',
  'Diabetes Intensive Monitoring,Diabetes,extend,goal,Check blood glucose daily,Log a fasting reading every morning,Vitals,,medium,',
  'Diabetes Intensive Monitoring,Diabetes,extend,intervention,Repeat HbA1c in 3 months,,,internal-task,high,Lower HbA1c below 8%',
  'Diabetes Intensive Monitoring,Diabetes,extend,intervention,Glucose log review,,,measure-vital,medium,Check blood glucose daily',
  'Diabetes Intensive Monitoring,Diabetes,extend,barrier,Cost of test strips,Strips run out before refill,,,high,Check blood glucose daily',
].join('\n');

export const SAMPLE_JSON = JSON.stringify({
  templates: [{
    name: 'Diabetes Intensive Monitoring',
    conditions: ['Diabetes'],
    renewal: 'extend',
    goals: [
      { title: 'Lower HbA1c below 8%', description: 'Bring HbA1c under 8% within 6 months', category: 'Labs', priority: 'high' },
      { title: 'Check blood glucose daily', description: 'Log a fasting reading every morning', category: 'Vitals', priority: 'medium' },
    ],
    interventions: [
      { title: 'Repeat HbA1c in 3 months', kind: 'internal-task', priority: 'high', goal: 'Lower HbA1c below 8%' },
      { title: 'Glucose log review', kind: 'measure-vital', priority: 'medium', goal: 'Check blood glucose daily' },
    ],
    barriers: [
      { title: 'Cost of test strips', description: 'Strips run out before refill', priority: 'high', goals: ['Check blood glucose daily'] },
    ],
  }],
}, null, 2);

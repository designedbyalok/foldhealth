/* Care plan template versions: each template is a chain of immutable
   versions with effective dates. Active plans record the version their
   template was applied at (patient_care_plan_template_instances); a
   supervisor publishes a new version and chooses how plans move to it.
   Pure JS; the store reads and writes (publishCarePlanTemplateVersion,
   migrateCarePlanTemplateInstance).

   A version: { id, templateId, versionNumber, effectiveDate (YYYY-MM-DD),
                content: { name, conditions, goals, interventions, barriers, renewal, categories? },
                note, publishedBy, publishedAt } */

import { categoriesOf, itemsFor } from './templateCategories.js';

const KINDS = [['goals', 'goal'], ['interventions', 'intervention'], ['barriers', 'barrier']];
const norm = (s) => String(s ?? '').trim().toLowerCase();

/** Today as YYYY-MM-DD in the user's timezone. */
export function todayIso(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** The content a template row holds, as a version stores it. */
export const contentOf = (t) => ({
  name: t?.name || '',
  conditions: t?.conditions || [],
  goals: t?.goals || [],
  interventions: t?.interventions || [],
  barriers: t?.barriers || [],
  ...(t?.renewal ? { renewal: t.renewal } : {}),
  ...(categoriesOf(t).length ? { categories: categoriesOf(t) } : {}),
});

const byNumber = (a, b) => a.versionNumber - b.versionNumber;

/** The version in effect on `date`: the newest one whose effective date has arrived. */
export function effectiveVersion(versions, date = todayIso()) {
  return [...(versions || [])].sort(byNumber).filter(v => v.effectiveDate <= date).pop() || null;
}

/** Each version's place in the chain on `date`: current, scheduled (not yet effective) or past. */
export function versionState(version, versions, date = todayIso()) {
  if (version.effectiveDate > date) return 'scheduled';
  return effectiveVersion(versions, date)?.id === version.id ? 'current' : 'past';
}

export const nextVersionNumber = (versions) => (versions || []).reduce((m, v) => Math.max(m, v.versionNumber), 0) + 1;

/**
 * What moving from one version's content to another changes, by item title:
 * { goal: { added, removed }, intervention: {...}, barrier: {...}, total }.
 * Items kept by title are left as they are on each plan. With categories, a
 * run compares Common + its own category (`categoryId`, null = Common alone);
 * without one, every item in either version is compared.
 */
export function versionDiff(from, to, { categoryId } = {}) {
  const out = { total: 0 };
  for (const [listKey, kind] of KINDS) {
    const before = new Map(itemsFor(from, listKey, categoryId).map(x => [norm(x.title), x]));
    const after = new Map(itemsFor(to, listKey, categoryId).map(x => [norm(x.title), x]));
    const added = [...after.entries()].filter(([k]) => k && !before.has(k)).map(([, x]) => x);
    const removed = [...before.entries()].filter(([k]) => k && !after.has(k)).map(([, x]) => x);
    out[kind] = { added, removed };
    out.total += added.length + removed.length;
  }
  return out;
}

// ── Impact analysis ──
// A usage row is one active run of the template on a plan:
// { instanceId, planId, patientId, patientName, programId, programCode,
//   careManager, ipa, groups: [population group names], versionNumber,
//   pendingVersionNumber }

export const COHORT_DIMENSIONS = [
  { key: 'programCode', label: 'Care program', read: r => (r.programCode ? [r.programCode] : []) },
  { key: 'ipa', label: 'IPA', read: r => (r.ipa ? [r.ipa] : []) },
  { key: 'careManager', label: 'Care manager', read: r => (r.careManager ? [r.careManager] : []) },
  { key: 'groups', label: 'Population group', read: r => r.groups || [] },
];
export const NO_VALUE = '(none)';

/** Counts of plans per value of each dimension, plus per version (`versionOf`), for the impact summary. */
export function impactSummary(rows, versionOf = r => `v${r.versionNumber ?? 1}`) {
  const count = (pick) => {
    const m = new Map();
    for (const r of rows) for (const v of pick(r)) m.set(v, (m.get(v) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))).map(([value, n]) => ({ value, n }));
  };
  const out = { plans: rows.length, patients: new Set(rows.map(r => r.patientId)).size, byVersion: count(r => [versionOf(r)]) };
  for (const d of COHORT_DIMENSIONS) out[d.key] = count(r => { const v = d.read(r); return v.length ? v : [NO_VALUE]; });
  return out;
}

/**
 * Whether a usage row is in the cohort. `cohort` maps a dimension key to the
 * chosen values; dimensions combine with AND, values within one with OR. An
 * empty cohort matches nothing (pick at least one value).
 */
export function inCohort(row, cohort = {}) {
  const active = COHORT_DIMENSIONS.filter(d => (cohort[d.key] || []).length);
  if (!active.length) return false;
  return active.every((d) => {
    const vals = d.read(row);
    const want = new Set(cohort[d.key]);
    return (vals.length ? vals : [NO_VALUE]).some(v => want.has(v));
  });
}

export const MIGRATION_MODES = [
  { key: 'all', label: 'Migrate all plans' },
  { key: 'cohort', label: 'Migrate a cohort' },
  { key: 'review', label: 'At each plan’s next review' },
];

/**
 * The runs a publish moves, and how: 'auto' runs migrate once the version
 * is effective (right away if it already is); 'review' runs migrate when
 * their plan's next review is completed. Rows already on a newer version
 * are left alone.
 */
export function migrationTargets(rows, mode, cohort, newVersionNumber) {
  const eligible = rows.filter(r => (r.versionNumber ?? 1) < newVersionNumber);
  if (mode === 'review') return { pending: 'review', rows: eligible };
  if (mode === 'cohort') return { pending: 'auto', rows: eligible.filter(r => inCohort(r, cohort)) };
  return { pending: 'auto', rows: eligible };
}

/** Whether a pending migration on a run should run now, for this trigger ('load' or 'review'). */
export function shouldMigrateNow(instance, trigger, date = todayIso()) {
  if (!instance?.pendingVersionId) return false;
  if ((instance.pendingEffectiveDate || '') > date) return false;
  return instance.pendingMode === 'auto' || (instance.pendingMode === 'review' && trigger === 'review');
}

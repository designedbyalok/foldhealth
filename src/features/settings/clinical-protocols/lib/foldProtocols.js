import { normalizeProtocol } from './protocolSchema.js';

/* Fold's own clinical protocols (data/foldProtocolContent.js). They are
   stored as ordinary clinical_protocols rows with source_kind 'fold' and
   organization "Fold", Active and read-only, and each seeds a starter care
   plan template (supabase/fold_protocols_seed.sql). Plain JS, no React. */

export const FOLD_ORGANIZATION = 'Fold';
export const FOLD_SOURCE_KIND = 'fold';

export const isFoldProtocol = (p) => p?.sourceKind === FOLD_SOURCE_KIND;

/** A Fold content entry as protocol metadata + the Fold protocol shape. */
export function foldProtocolRecord(entry) {
  const { metadata, protocol } = normalizeProtocol({
    metadata: {
      title: entry.name,
      organization: FOLD_ORGANIZATION,
      conditions: [entry.condition],
      programCodes: [],
      version: entry.version,
      author: 'Fold Health',
    },
    summary: entry.summary,
    scope: { conditions: [{ name: entry.condition }], exclusions: [] },
    thresholds: entry.thresholds,
    decisionRules: entry.decisionRules,
    cadence: entry.cadence,
    crossReferences: (entry.sources || []).map(title => ({ title, kind: 'guideline', source: title })),
  });
  return { slug: entry.id, ...metadata, protocol };
}

const gbiOf = (entry) => ({
    goals: (entry.goals || []).map(g => ({ title: g.title, ...(g.priority ? { priority: g.priority } : {}) })),
    interventions: (entry.interventions || []).map(i => ({
      title: i.title,
      ...(i.priority ? { priority: i.priority } : {}),
      ...(i.kind ? { kind: i.kind } : {}),
      ...(i.goalTitle ? { goalTitle: i.goalTitle } : {}),
    })),
    barriers: (entry.barriers || []).map(b => ({
      title: b.title,
      ...(b.priority ? { priority: b.priority } : {}),
      ...(b.goalTitles?.length ? { goalTitles: [...b.goalTitles] } : {}),
    })),
});

/**
 * The starter template's Common GBI set and categories, items by library
 * title (resolved to ids by the seed).
 */
export function foldStarterGbi(entry) {
  return {
    ...gbiOf(entry),
    categories: (entry.categories || []).map(c => ({
      id: c.id, name: c.name, match: c.match || 'all', criteria: c.criteria || [], ...gbiOf(c),
    })),
  };
}

const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

/** Titles in an entry's GBI set that the given libraries don't have. */
export function unresolvedTitles(entry, { goals = [], interventions = [], barriers = [] } = {}) {
  const has = rows => new Set(rows.map(r => norm(r.title)));
  const lib = { goal: has(goals), intervention: has(interventions), barrier: has(barriers) };
  return [entry, ...(entry.categories || [])].flatMap(section => [
    ...(section.goals || []).map(g => ['goal', g.title]),
    ...(section.interventions || []).map(i => ['intervention', i.title]),
    ...(section.barriers || []).map(b => ['barrier', b.title]),
  ]).filter(([kind, title]) => !lib[kind].has(norm(title))).map(([kind, title]) => ({ kind, title }));
}

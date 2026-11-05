/**
 * Form scoring: author-time validation (spec §7).
 *
 * Pure: returns a list of diagnostics. A form is publishable when no diagnostic
 * has level 'error'. `scoreRange` is the canonical min/max computation the
 * builder UI should also use, so stored ranges never drift from validation.
 */

import { AGGREGATION, DIAGNOSTIC_CODE, ACTION_TYPE } from './types.js';
import { indexItems, ancestorsOf, itemBounds } from './util.js';

const COMPOSITE_MAX_DEPTH = 5;

/**
 * Canonical min/max possible value for a score. Field sources without scorable
 * options are skipped (they can't be bounded in v1).
 * @param {import('./types.js').ScoreDef} def
 * @param {Object.<string, import('./types.js').QItem>} index
 * @param {Map<string, import('./types.js').ScoreDef>} byId
 * @returns {{min:number,max:number}}
 */
export function scoreRange(def, index, byId, seen = new Set()) {
  if (seen.has(def.id)) return { min: 0, max: 0 }; // composite cycle, reported separately
  seen.add(def.id);
  const bounds = [];
  for (const src of def.sources || []) {
    if (src.scoreId) {
      const child = byId.get(src.scoreId);
      if (child) bounds.push({ ...scoreRange(child, index, byId, seen), weight: src.weight ?? 1 });
    } else if (src.linkId && index[src.linkId]) {
      const b = itemBounds(index[src.linkId]);
      if (b) bounds.push({ ...b, weight: src.weight ?? 1 });
    }
  }
  if (bounds.length === 0) return { min: 0, max: 0 };

  switch (def.aggregation) {
    case AGGREGATION.SUM:
    case AGGREGATION.COMPOSITE:
      return {
        min: bounds.reduce((a, b) => a + b.min, 0),
        max: bounds.reduce((a, b) => a + b.max, 0),
      };
    case AGGREGATION.WEIGHTED_SUM:
      return {
        min: bounds.reduce((a, b) => a + b.weight * b.min, 0),
        max: bounds.reduce((a, b) => a + b.weight * b.max, 0),
      };
    case AGGREGATION.COUNT:
      return { min: 0, max: bounds.length };
    case AGGREGATION.AVERAGE:
    case AGGREGATION.MAX:
    case AGGREGATION.MIN:
      return {
        min: Math.min(...bounds.map((b) => b.min)),
        max: Math.max(...bounds.map((b) => b.max)),
      };
    default:
      return { min: 0, max: 0 };
  }
}

/**
 * @param {import('./types.js').FormDefinition} form
 * @returns {import('./types.js').Diagnostic[]}
 */
export function validateForm(form) {
  const scores = form.scores || [];
  const { index, parent } = indexItems(form.questionnaire?.item || []);
  const byId = new Map(scores.map((s) => [s.id, s]));
  /** @type {import('./types.js').Diagnostic[]} */
  const out = [];
  const err = (code, msg) => out.push({ level: 'error', code, msg });
  const warn = (code, msg) => out.push({ level: 'warn', code, msg });

  // DANGLING_SOURCE
  for (const s of scores) {
    for (const src of s.sources || []) {
      if (src.scoreId && !byId.has(src.scoreId)) {
        err(DIAGNOSTIC_CODE.DANGLING_SOURCE, `Score "${s.id}" references missing score "${src.scoreId}".`);
      }
      if (src.linkId && !index[src.linkId]) {
        err(DIAGNOSTIC_CODE.DANGLING_SOURCE, `Score "${s.id}" references missing field "${src.linkId}".`);
      }
    }
  }

  // RANGE_STALE + BAND_GAP + BAND_OVERLAP
  for (const s of scores) {
    const computed = scoreRange(s, index, byId);
    if (s.range && (s.range.min !== computed.min || s.range.max !== computed.max)) {
      warn(
        DIAGNOSTIC_CODE.RANGE_STALE,
        `Score "${s.id}" stored range ${s.range.min}-${s.range.max} != computed ${computed.min}-${computed.max}.`,
      );
    }
    const range = s.range || computed;
    const bands = (s.interpretations || []).toSorted((a, b) => a.min - b.min);
    if (bands.length) {
      if (bands[0].min > range.min) {
        err(DIAGNOSTIC_CODE.BAND_GAP, `Score "${s.id}" leaves ${range.min}..${bands[0].min - 1} uncovered.`);
      }
      if (bands[bands.length - 1].max < range.max) {
        err(DIAGNOSTIC_CODE.BAND_GAP, `Score "${s.id}" leaves ${bands[bands.length - 1].max + 1}..${range.max} uncovered.`);
      }
      for (let i = 1; i < bands.length; i++) {
        const prev = bands[i - 1];
        const cur = bands[i];
        if (cur.min <= prev.max) {
          err(DIAGNOSTIC_CODE.BAND_OVERLAP, `Score "${s.id}" bands "${prev.label}" and "${cur.label}" overlap.`);
        } else if (cur.min > prev.max + 1) {
          err(DIAGNOSTIC_CODE.BAND_GAP, `Score "${s.id}" gap between "${prev.label}" and "${cur.label}".`);
        }
      }
    }
  }

  // COMPOSITE_DEPTH (also catches composite cycles via depth overflow)
  for (const s of scores) {
    const seen = new Set();
    const depth = (def, d) => {
      if (d > COMPOSITE_MAX_DEPTH || seen.has(def.id)) {
        err(DIAGNOSTIC_CODE.COMPOSITE_DEPTH, `Score "${s.id}" composite nesting too deep or cyclic.`);
        return;
      }
      seen.add(def.id);
      for (const src of def.sources || []) {
        if (src.scoreId && byId.has(src.scoreId)) depth(byId.get(src.scoreId), d + 1);
      }
      seen.delete(def.id);
    };
    depth(s, 0);
  }

  // CYCLE: section feeds a score that controls its own visibility.
  const branchTargets = new Set();
  for (const s of scores) {
    for (const band of s.interpretations || []) {
      for (const act of band.actions || []) {
        if (act.type === ACTION_TYPE.BRANCH) (act.reveal || []).forEach((t) => branchTargets.add(t));
      }
    }
  }
  const controlled = new Set(
    Object.keys(index).filter(
      (lid) => index[lid].type === 'group' && (index[lid].defaultVisibility === 'hidden' || branchTargets.has(lid)),
    ),
  );
  const adj = new Map();
  const indeg = new Map();
  const node = (n) => { if (!adj.has(n)) { adj.set(n, []); indeg.set(n, 0); } };
  const edge = (f, t) => { node(f); node(t); adj.get(f).push(t); indeg.set(t, indeg.get(t) + 1); };
  scores.forEach((s) => node(`score:${s.id}`));
  controlled.forEach((l) => node(`section:${l}`));
  for (const s of scores) {
    for (const src of s.sources || []) {
      if (src.scoreId) edge(`score:${src.scoreId}`, `score:${s.id}`);
      else if (src.linkId) {
        for (const anc of ancestorsOf(src.linkId, parent)) if (controlled.has(anc)) edge(`section:${anc}`, `score:${s.id}`);
      }
    }
    for (const band of s.interpretations || []) {
      for (const act of band.actions || []) {
        if (act.type === ACTION_TYPE.BRANCH) for (const t of act.reveal || []) if (controlled.has(t)) edge(`score:${s.id}`, `section:${t}`);
      }
    }
  }
  let visited = 0;
  const q = [...indeg.keys()].filter((n) => indeg.get(n) === 0);
  while (q.length) {
    const n = q.shift();
    visited++;
    for (const m of adj.get(n)) {
      indeg.set(m, indeg.get(m) - 1);
      if (indeg.get(m) === 0) q.push(m);
    }
  }
  if (visited < adj.size) {
    err(DIAGNOSTIC_CODE.CYCLE, 'A section feeds a score whose band controls that section’s visibility.');
  }

  // LOCKED_EDIT: handled at edit-time against a baseline; noted here for completeness.

  return out;
}

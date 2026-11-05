/**
 * Form scoring engine: the pure evaluate() function.
 *
 * Spec: docs/forms-scoring-engine.md. Build the dependency DAG, topologically
 * sort it, then walk nodes once. Because branch reveals always target nodes
 * downstream in the topological order, no recompute is ever needed.
 *
 * evaluate() is referentially transparent: no clock, no randomness, no I/O.
 */

import {
  AGGREGATION,
  MISSING_POLICY,
  SCORE_STATUS,
  ACTION_TYPE,
  OPERATOR,
  DIAGNOSTIC_CODE,
} from './types.js';
import {
  compare,
  contribution,
  isAnswered,
  optionPoints,
  indexItems,
  ancestorsOf,
} from './util.js';

/**
 * @param {import('./types.js').FormDefinition} form
 * @param {import('./types.js').Answers} answers
 * @returns {import('./types.js').EvaluationResult}
 */
export function evaluate(form, answers = {}) {
  const scores = form.scores || [];
  const triggers = form.criticalTriggers || [];
  const { index, parent } = indexItems(form.questionnaire?.item || []);

  /** @type {import('./types.js').Diagnostic[]} */
  const diagnostics = [];

  // Sections whose visibility can change: hidden-by-default, or revealed by a branch action.
  const branchTargets = new Set();
  for (const s of scores) {
    for (const band of s.interpretations || []) {
      for (const act of band.actions || []) {
        if (act.type === ACTION_TYPE.BRANCH) (act.reveal || []).forEach((t) => branchTargets.add(t));
      }
    }
  }
  const controlled = new Set();
  for (const lid of Object.keys(index)) {
    const it = index[lid];
    if (it.type === 'group' && (it.defaultVisibility === 'hidden' || branchTargets.has(lid))) {
      controlled.add(lid);
    }
  }

  // Reveals accumulated during the walk (monotonic: false -> true only).
  const revealed = new Set();

  // --- visibility, memoized; memo is cleared whenever `revealed` grows ---
  let visMemo = new Map();
  const visiting = new Set();
  const effectiveAnswer = (lid) => (isVisible(lid) ? answers[lid] : undefined);

  function itemEnabled(item) {
    const conds = item.enableWhen;
    if (!conds || conds.length === 0) return true;
    const results = conds.map((c) =>
      compare(effectiveAnswer(c.question), c.operator, c.answer),
    );
    return (item.enableBehavior === 'any')
      ? results.some(Boolean)
      : results.every(Boolean);
  }

  function isVisible(lid) {
    if (visMemo.has(lid)) return visMemo.get(lid);
    if (visiting.has(lid)) return false; // enableWhen cycle guard
    visiting.add(lid);

    let result = true;
    const item = index[lid];
    if (!item) {
      result = false;
    } else {
      const chain = [lid, ...ancestorsOf(lid, parent)];
      for (const node of chain) {
        // a hidden-default controlled section gates everything inside it
        if (controlled.has(node) && index[node].defaultVisibility === 'hidden' && !revealed.has(node)) {
          result = false;
          break;
        }
        if (!itemEnabled(index[node])) {
          result = false;
          break;
        }
      }
    }
    visiting.delete(lid);
    visMemo.set(lid, result);
    return result;
  }
  const invalidateVisibility = () => { visMemo = new Map(); };

  // --- dependency DAG over { score:<id>, section:<linkId> } ---
  const adj = new Map();
  const indeg = new Map();
  const addNode = (n) => { if (!adj.has(n)) { adj.set(n, []); indeg.set(n, 0); } };
  const addEdge = (from, to) => {
    addNode(from); addNode(to);
    adj.get(from).push(to);
    indeg.set(to, indeg.get(to) + 1);
  };
  scores.forEach((s) => addNode(`score:${s.id}`));
  controlled.forEach((lid) => addNode(`section:${lid}`));

  for (const s of scores) {
    for (const src of s.sources || []) {
      if (src.scoreId) {
        addEdge(`score:${src.scoreId}`, `score:${s.id}`); // child before parent
      } else if (src.linkId) {
        for (const anc of ancestorsOf(src.linkId, parent)) {
          if (controlled.has(anc)) addEdge(`section:${anc}`, `score:${s.id}`);
        }
      }
    }
    for (const band of s.interpretations || []) {
      for (const act of band.actions || []) {
        if (act.type === ACTION_TYPE.BRANCH) {
          for (const t of act.reveal || []) {
            if (controlled.has(t)) addEdge(`score:${s.id}`, `section:${t}`);
          }
        }
      }
    }
  }

  // Kahn topological sort.
  const order = [];
  const queue = [];
  for (const [n, d] of indeg) if (d === 0) queue.push(n);
  queue.sort(); // deterministic tie-break
  while (queue.length) {
    const n = queue.shift();
    order.push(n);
    const next = [];
    for (const m of adj.get(n)) {
      indeg.set(m, indeg.get(m) - 1);
      if (indeg.get(m) === 0) next.push(m);
    }
    next.sort();
    queue.push(...next);
  }

  const runtimeCycle = order.length < adj.size;
  if (runtimeCycle) {
    diagnostics.push({
      level: 'error',
      code: DIAGNOSTIC_CODE.CYCLE_AT_RUNTIME,
      msg: 'Dependency cycle detected; branch actions suppressed (fail-safe).',
    });
  }
  // On cycle, evaluate scores in definition order with reveals suppressed.
  const scoreOrder = runtimeCycle
    ? scores.map((s) => `score:${s.id}`)
    : order.filter((n) => n.startsWith('score:'));

  // --- walk ---
  /** @type {Object.<string, number|undefined>} */
  const scoreValues = {};
  /** @type {Object.<string, import('./types.js').ScoreResult>} */
  const results = {};
  const pending = []; // { act, source, order:[a,b,c] }
  const scoreById = new Map(scores.map((s) => [s.id, s]));

  let topoIdx = 0;
  for (const node of scoreOrder) {
    const s = scoreById.get(node.slice('score:'.length));
    if (!s) continue;
    const ti = topoIdx++;
    results[s.id] = processScore(s, ti);
  }

  function processScore(s, ti) {
    const mode = s.multiSelectMode || 'sum';
    const policy = s.missingPolicy || MISSING_POLICY.EXCLUDE;

    const applicable = []; // { src, item? }
    const answered = []; // { src, val, item? }
    for (const src of s.sources || []) {
      if (src.scoreId) {
        applicable.push({ src });
        const cv = scoreValues[src.scoreId];
        if (cv !== undefined) answered.push({ src, val: cv });
      } else if (src.linkId && isVisible(src.linkId)) {
        const item = index[src.linkId];
        applicable.push({ src, item });
        const a = answers[src.linkId];
        if (isAnswered(a)) answered.push({ src, item, val: contribution(item, a, mode) });
      }
    }

    const range = s.range || { min: 0, max: 0 };
    const answeredSrc = new Set(answered.map((x) => x.src));
    const requiredUnanswered = applicable.filter(
      (x) => x.item && x.item.required && !answeredSrc.has(x.src),
    ).length;

    let status;
    if (answered.length === 0) status = SCORE_STATUS.EMPTY;
    else status = requiredUnanswered === 0 ? SCORE_STATUS.COMPLETE : SCORE_STATUS.PARTIAL;

    let value;
    if (status !== SCORE_STATUS.EMPTY) value = aggregate(s, applicable, answered, policy);
    scoreValues[s.id] = value;

    const scoreable =
      status === SCORE_STATUS.COMPLETE ||
      (status === SCORE_STATUS.PARTIAL && s.showPartialScore);

    let band = null;
    if (scoreable && value !== undefined) {
      band = (s.interpretations || []).find((b) => value >= b.min && value <= b.max) || null;
      if (!band) {
        diagnostics.push({
          level: 'warn',
          code: DIAGNOSTIC_CODE.BAND_NO_MATCH,
          msg: `Score "${s.id}" value ${value} matched no band.`,
        });
      }
    }

    if (band && band.actions) {
      const bandOrder = s.interpretations.indexOf(band);
      let added = false;
      band.actions.forEach((act, ai) => {
        pending.push({ act, source: `score:${s.id}:band:${band.label}`, order: [ti, bandOrder, ai] });
        if (act.type === ACTION_TYPE.BRANCH && !runtimeCycle && Array.isArray(act.reveal)) {
          act.reveal.forEach((t) => {
            if (!revealed.has(t)) { revealed.add(t); added = true; }
          });
        }
      });
      if (added) invalidateVisibility();
    }

    return {
      id: s.id,
      value,
      status,
      answered: answered.filter((x) => x.src.linkId).length || answered.length,
      applicable: applicable.length,
      range,
      band,
    };
  }

  function aggregate(s, applicable, answered, policy) {
    const vals = answered.map((x) => x.val);
    switch (s.aggregation) {
      case AGGREGATION.SUM:
        return vals.reduce((a, b) => a + b, 0);
      case AGGREGATION.WEIGHTED_SUM:
        return answered.reduce((a, x) => a + (x.src.weight ?? 1) * x.val, 0);
      case AGGREGATION.AVERAGE: {
        const num = vals.reduce((a, b) => a + b, 0);
        const fieldApplicable = applicable.filter((x) => x.src.linkId).length;
        const denom = policy === MISSING_POLICY.AS_ZERO ? fieldApplicable : answered.length;
        return denom > 0 ? num / denom : 0;
      }
      case AGGREGATION.COUNT: {
        const pred = s.countPredicate || { operator: OPERATOR.GTE, value: 1 };
        return answered.filter((x) => compare(x.val, pred.operator, pred.value)).length;
      }
      case AGGREGATION.MAX:
        return Math.max(...vals);
      case AGGREGATION.MIN:
        return Math.min(...vals);
      case AGGREGATION.COMPOSITE:
        return vals.reduce((a, b) => a + b, 0); // SUM of child scores (v1)
      default:
        return 0;
    }
  }

  // --- post-walk: final visibility uses fully-populated `revealed` ---
  invalidateVisibility();

  /** @type {import('./types.js').TriggeredCritical[]} */
  const criticalsTriggered = [];
  triggers.forEach((t, idx) => {
    const a = answers[t.linkId];
    // For a numeric condition on a scored choice item, compare against the
    // selected option's score (so "Q9 > 0" means "any answer worth points"),
    // not the raw option text. String conditions still match the raw value.
    let cmp = a;
    if (typeof t.condition.value === 'number') {
      const item = index[t.linkId];
      if (item?.type === 'choice' && Array.isArray(item.answerOption)) {
        const pts = optionPoints(item.answerOption, a);
        if (typeof pts === 'number') cmp = pts;
      }
    }
    if (isVisible(t.linkId) && isAnswered(a) && compare(cmp, t.condition.operator, t.condition.value)) {
      criticalsTriggered.push({
        triggerId: t.id,
        linkId: t.linkId,
        value: a,
        alert: t.alert,
        severity: t.severity,
      });
      (t.actions || []).forEach((act, ai) => {
        pending.push({ act, source: `trigger:${t.id}`, order: [Number.MAX_SAFE_INTEGER, idx, ai] });
      });
    }
  });

  const actions = mergeActions(pending);

  const visibility = {};
  for (const lid of Object.keys(index)) visibility[lid] = isVisible(lid);

  return {
    visibility,
    scores: scores.flatMap((s) => {
      const result = results[s.id];
      return result ? [result] : [];
    }),
    criticalsTriggered,
    actions,
    diagnostics,
  };
}

/** Merge key per action type (spec §9). */
function mergeKey(act) {
  switch (act.type) {
    case ACTION_TYPE.FLAG:
      return `flag|${act.label}|${act.severity}`;
    case ACTION_TYPE.CARE_GAP:
      return `careGap|${act.ref}`;
    case ACTION_TYPE.ROUTE:
      return `route|${act.queue}`;
    case ACTION_TYPE.BRANCH:
      return `branch|${(act.reveal || []).slice().sort().join(',')}`;
    default:
      return JSON.stringify(act);
  }
}

/** Sort by (topoIdx, bandOrder, actionIdx), then dedupe; first wins, sources union. */
function mergeActions(pending) {
  const sorted = pending
    .slice()
    .sort((a, b) => {
      for (let i = 0; i < 3; i++) if (a.order[i] !== b.order[i]) return a.order[i] - b.order[i];
      return 0;
    });
  const byKey = new Map();
  for (const { act, source } of sorted) {
    const key = mergeKey(act);
    if (!byKey.has(key)) byKey.set(key, { ...act, source: [source] });
    else byKey.get(key).source.push(source);
  }
  return [...byKey.values()].map((a) => ({ ...a, source: a.source.join(',') }));
}

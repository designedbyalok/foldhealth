/**
 * Scoring: pure value helpers shared by the engine and the validator.
 * No state, no I/O. See docs/forms-scoring-engine.md.
 */

import { OPERATOR } from './types.js';

/**
 * Loose equality that bridges the string/number/boolean coercion gap between
 * stored answerOption values and submitted answers.
 * @param {*} a @param {*} b @returns {boolean}
 */
export function looseEq(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a === typeof b) return a === b;
  return String(a) === String(b);
}

/** True when a value counts as "answered". */
export function isAnswered(v) {
  if (v == null || v === '') return false;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

/**
 * Evaluate one comparison. `b` is ignored for `exists`.
 * @param {*} a @param {string} op @param {*} [b]
 */
export function compare(a, op, b) {
  switch (op) {
    case OPERATOR.EXISTS:
      return isAnswered(a);
    case OPERATOR.EQ:
      return looseEq(a, b);
    case OPERATOR.NE:
      return !looseEq(a, b);
    case OPERATOR.GT:
      return Number(a) > Number(b);
    case OPERATOR.LT:
      return Number(a) < Number(b);
    case OPERATOR.GTE:
      return Number(a) >= Number(b);
    case OPERATOR.LTE:
      return Number(a) <= Number(b);
    default:
      return false;
  }
}

/**
 * Points for a selected option value, or undefined if the value isn't an option.
 * @param {import('./types.js').AnswerOption[]} options @param {*} value
 * @returns {number|undefined}
 */
export function optionPoints(options, value) {
  const hit = (options || []).find((o) => looseEq(o.value, value));
  return hit && typeof hit.score === 'number' ? hit.score : undefined;
}

/**
 * The point contribution of a single item given its answer.
 * - choice/boolean: sum (or max) of selected options' points
 * - reverse-scored: min+max-raw using the item's declared range
 * - option-less numeric field: the raw numeric value (a pragmatic fallback;
 *   full range→points value-mapping is deferred past v1)
 * @param {import('./types.js').QItem} item
 * @param {*} answer
 * @param {('sum'|'max')} [multiSelectMode]
 * @returns {number}
 */
export function contribution(item, answer, multiSelectMode = 'sum') {
  const options = item.answerOption || [];
  let base;

  if (Array.isArray(answer)) {
    const pts = [];
    for (const v of answer) {
      const p = optionPoints(options, v);
      if (typeof p === 'number') pts.push(p);
    }
    if (pts.length === 0) base = 0;
    else base = multiSelectMode === 'max' ? Math.max(...pts) : pts.reduce((s, n) => s + n, 0);
  } else {
    const p = optionPoints(options, answer);
    if (typeof p === 'number') base = p;
    else if (options.length === 0 && answer != null && answer !== '' && !Number.isNaN(Number(answer))) {
      base = Number(answer);
    } else {
      base = 0;
    }
  }

  if (item.reverseScore && item.range) {
    base = item.range.min + item.range.max - base;
  }
  return base;
}

/**
 * Min/max possible contribution of an item across its options (after reverse).
 * Returns null when the item has no scorable options (e.g. free numeric).
 * @param {import('./types.js').QItem} item
 * @returns {{min:number,max:number}|null}
 */
export function itemBounds(item) {
  const pts = (item.answerOption || [])
    .map((o) => (typeof o.score === 'number' ? o.score : null))
    .filter((n) => n != null);
  if (pts.length === 0) return null;
  let min = Math.min(...pts);
  let max = Math.max(...pts);
  if (item.reverseScore && item.range) {
    const lo = item.range.min + item.range.max - max;
    const hi = item.range.min + item.range.max - min;
    min = lo;
    max = hi;
  }
  return { min, max };
}

/** Index an item tree into lookup maps. */
export function indexItems(items) {
  /** @type {Object.<string, import('./types.js').QItem>} */
  const index = {};
  /** @type {Object.<string, string|null>} */
  const parent = {};
  const order = [];
  const walk = (list, par) => {
    for (const it of list || []) {
      index[it.linkId] = it;
      parent[it.linkId] = par;
      order.push(it.linkId);
      if (it.item) walk(it.item, it.linkId);
    }
  };
  walk(items, null);
  return { index, parent, order };
}

/** Ancestor linkIds of an item, nearest first (excludes the item itself). */
export function ancestorsOf(linkId, parent) {
  const chain = [];
  let p = parent[linkId];
  while (p != null) {
    chain.push(p);
    p = parent[p];
  }
  return chain;
}

/**
 * Form scoring: data contracts.
 *
 * Plain-JS + JSDoc typedefs (this repo has no TypeScript). Editors pick these
 * up for autocomplete and inline checking. The frozen constant maps below are
 * the runtime source of truth for the string unions the engine and validators
 * branch on.
 *
 * Spec: docs/forms-scoring-engine.md (§2 data contracts).
 */

/* ------------------------------------------------------------------ *
 * Runtime enums (frozen: single source of truth for the unions)
 * ------------------------------------------------------------------ */

/** @enum {string} */
export const AGGREGATION = Object.freeze({
  SUM: 'SUM',
  AVERAGE: 'AVERAGE',
  COUNT: 'COUNT',
  MAX: 'MAX',
  MIN: 'MIN',
  WEIGHTED_SUM: 'WEIGHTED_SUM',
  COMPOSITE: 'COMPOSITE',
});

/** @enum {string} */
export const MISSING_POLICY = Object.freeze({
  EXCLUDE: 'exclude',
  AS_ZERO: 'as_zero',
});

/** @enum {string} */
export const SCORE_STATUS = Object.freeze({
  EMPTY: 'empty',
  PARTIAL: 'partial',
  COMPLETE: 'complete',
});

/** @enum {string} */
export const SEVERITY = Object.freeze({
  NEUTRAL: 'neutral',
  INFO: 'info',
  WARNING: 'warning',
  HIGH: 'high',
  CRITICAL: 'critical',
});

/** @enum {string} */
export const ACTION_TYPE = Object.freeze({
  FLAG: 'flag',
  CARE_GAP: 'careGap',
  ROUTE: 'route',
  BRANCH: 'branch',
});

/** Operators shared by enableWhen, critical triggers, and COUNT predicates. */
/** @enum {string} */
export const OPERATOR = Object.freeze({
  EQ: '=',
  NE: '!=',
  EXISTS: 'exists',
  GT: '>',
  LT: '<',
  GTE: '>=',
  LTE: '<=',
});

/** @enum {string} */
export const DIAGNOSTIC_CODE = Object.freeze({
  BAND_GAP: 'BAND_GAP',
  BAND_OVERLAP: 'BAND_OVERLAP',
  BAND_NO_MATCH: 'BAND_NO_MATCH',
  RANGE_STALE: 'RANGE_STALE',
  CYCLE: 'CYCLE',
  CYCLE_AT_RUNTIME: 'CYCLE_AT_RUNTIME',
  DANGLING_SOURCE: 'DANGLING_SOURCE',
  COMPOSITE_DEPTH: 'COMPOSITE_DEPTH',
  LOCKED_EDIT: 'LOCKED_EDIT',
});

/* ------------------------------------------------------------------ *
 * Questionnaire (the FHIR-shaped subset the engine actually reads)
 * ------------------------------------------------------------------ */

/**
 * @typedef {('string'|'text'|'boolean'|'choice'|'open-choice'|'integer'|'decimal'|'date'|'group'|'display')} QItemType
 */

/**
 * A selectable answer with an attached point value.
 * Serializes to/from the FHIR `itemWeight` / `ordinalValue` extension.
 * @typedef {Object} AnswerOption
 * @property {string|number|boolean} value
 * @property {number} [score]  Points contributed when this option is selected.
 */

/**
 * Skip-logic condition. `enableBehavior` on the parent item decides how
 * multiple conditions combine (all|any).
 * @typedef {Object} EnableWhen
 * @property {string} question                  linkId of the controlling item.
 * @property {OPERATOR[keyof OPERATOR]} operator
 * @property {string|number|boolean} [answer]   Omitted for the `exists` operator.
 */

/**
 * One questionnaire item. Groups nest via `item`. Only the fields the engine
 * consumes are typed here; the stored FHIR resource may carry more.
 * @typedef {Object} QItem
 * @property {string} linkId
 * @property {QItemType} type
 * @property {string} [text]
 * @property {boolean} [required]
 * @property {boolean} [repeats]
 * @property {boolean} [reverseScore]            Apply min+max-raw to this item's points.
 * @property {{min:number,max:number}} [range]   Per-item point range; required when reverseScore is set.
 * @property {AnswerOption[]} [answerOption]
 * @property {EnableWhen[]} [enableWhen]
 * @property {('all'|'any')} [enableBehavior]    Default 'all'.
 * @property {('shown'|'hidden')} [defaultVisibility]  For branch-controlled sections. Default 'shown'.
 * @property {QItem[]} [item]                    Nested items (groups/sections).
 */

/* ------------------------------------------------------------------ *
 * Scoring config
 * ------------------------------------------------------------------ */

/**
 * A contributor to a score. Field sources reference a `linkId`; composite
 * sources reference another score's `scoreId`. Exactly one is set.
 * @typedef {Object} ScoreSource
 * @property {string} [linkId]    Field source.
 * @property {string} [scoreId]   Composite source (another score's value).
 * @property {number} [weight]    Used by WEIGHTED_SUM (default 1).
 */

/**
 * Predicate for COUNT aggregation: an answer counts when its contribution
 * satisfies this. Defaults to `{ operator: '>=', value: 1 }`.
 * @typedef {Object} CountPredicate
 * @property {OPERATOR[keyof OPERATOR]} operator
 * @property {number} value
 */

/**
 * A single action attached to a band or critical trigger. Discriminated by
 * `type`; only the fields for that type are present.
 * @typedef {Object} ScoreAction
 * @property {ACTION_TYPE[keyof ACTION_TYPE]} type
 * @property {string}   [label]     flag: human label.
 * @property {SEVERITY[keyof SEVERITY]} [severity]  flag.
 * @property {string}   [ref]       careGap: care-gap definition ref.
 * @property {string}   [queue]     route: target queue id.
 * @property {string[]} [reveal]    branch: section linkIds to reveal (reveal-only in v1).
 */

/**
 * An interpretation band. Bands of one score must tile [range.min, range.max]
 * inclusively with no gaps or overlaps (enforced at author time).
 * @typedef {Object} Band
 * @property {number} min
 * @property {number} max
 * @property {string} label
 * @property {SEVERITY[keyof SEVERITY]} severity
 * @property {string} [message]
 * @property {ScoreAction[]} [actions]
 */

/**
 * A named score over a set of fields or child scores.
 * @typedef {Object} ScoreDef
 * @property {string} id
 * @property {string} label
 * @property {AGGREGATION[keyof AGGREGATION]} aggregation
 * @property {ScoreSource[]} sources
 * @property {MISSING_POLICY[keyof MISSING_POLICY]} [missingPolicy]  Default 'exclude'.
 * @property {boolean} [showPartialScore]   Allow band matching before complete. Default false.
 * @property {('sum'|'max')} [multiSelectMode]  How multi-select options combine. Default 'sum'.
 * @property {CountPredicate} [countPredicate]  COUNT only.
 * @property {{min:number,max:number}} range    Min/max possible score (computed, stored for validation).
 * @property {Band[]} interpretations
 * @property {boolean} [locked]   Validated instrument: points/cutoffs not editable.
 */

/**
 * Fires on a specific answer, independent of any score's total or completeness.
 * @typedef {Object} CriticalTrigger
 * @property {string} id
 * @property {string} linkId
 * @property {{operator: OPERATOR[keyof OPERATOR], value?: string|number|boolean}} condition
 * @property {string} alert
 * @property {SEVERITY[keyof SEVERITY]} severity
 * @property {ScoreAction[]} [actions]
 */

/**
 * The full form definition the engine evaluates.
 * @typedef {Object} FormDefinition
 * @property {{item: QItem[]}} questionnaire   FHIR Questionnaire (item tree).
 * @property {ScoreDef[]} scores
 * @property {CriticalTrigger[]} criticalTriggers
 */

/**
 * Filled-in answers: linkId -> value (or array for repeats/multi-select).
 * @typedef {Object.<string, (string|number|boolean|Array<string|number|boolean>)>} Answers
 */

/* ------------------------------------------------------------------ *
 * Evaluation output (§2)
 * ------------------------------------------------------------------ */

/**
 * @typedef {Object} ScoreResult
 * @property {string} id
 * @property {number} [value]      Present when status is partial|complete.
 * @property {SCORE_STATUS[keyof SCORE_STATUS]} status
 * @property {number} answered     Count of answered applicable sources.
 * @property {number} applicable   Count of visible (applicable) sources.
 * @property {{min:number,max:number}} range
 * @property {Band|null} band      Matched band, or null if suppressed/no match.
 */

/**
 * @typedef {Object} TriggeredCritical
 * @property {string} triggerId
 * @property {string} linkId
 * @property {string|number|boolean} value
 * @property {string} alert
 * @property {SEVERITY[keyof SEVERITY]} severity
 */

/**
 * A band/trigger action after merge, tagged with where it came from.
 * @typedef {ScoreAction & { source: string }} ResolvedAction
 */

/**
 * @typedef {Object} Diagnostic
 * @property {('info'|'warn'|'error')} level
 * @property {DIAGNOSTIC_CODE[keyof DIAGNOSTIC_CODE]} code
 * @property {string} msg
 */

/**
 * The pure result of evaluate(FormDefinition, Answers).
 * @typedef {Object} EvaluationResult
 * @property {Object.<string, boolean>} visibility   Final, post-branch.
 * @property {ScoreResult[]} scores
 * @property {TriggeredCritical[]} criticalsTriggered
 * @property {ResolvedAction[]} actions               Merged + deterministically ordered.
 * @property {Diagnostic[]} diagnostics
 */

export {};

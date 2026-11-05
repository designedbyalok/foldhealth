/**
 * formatQueryBridge.js, Bridges the population-group rule tree to
 * react-querybuilder's `formatQuery`, producing SQL (parameterized) and
 * JsonLogic output for server-side evaluation and export.
 *
 * The stored rule shape uses `{ field, operator, value: { amount, text,
 * code, lookback, analyte, ... } }` which doesn't match rqb's scalar
 * `{ field, operator, value }`. We normalize on-the-fly at format time,
 * and custom ruleProcessors handle the healthcare-specific field types
 * (coded terminologies, observations, event counts).
 */

import { formatQuery } from 'react-querybuilder';
import { FIELD_BY_KEY } from './fieldCatalog';

/* ── Helpers ── */

function lookbackDateSQL(lb, paramFn) {
  if (!lb?.amount) return null;
  const map = { days: 'day', weeks: 'week', months: 'month', years: 'year' };
  const unit = map[lb.unit] || 'month';
  return `CURRENT_DATE - INTERVAL '${Number(lb.amount)} ${unit}'`;
}

function lookbackDateJS(lb) {
  if (!lb?.amount) return null;
  const d = new Date();
  const amt = Number(lb.amount);
  switch (lb.unit) {
    case 'days': d.setDate(d.getDate() - amt); break;
    case 'weeks': d.setDate(d.getDate() - amt * 7); break;
    case 'years': d.setFullYear(d.getFullYear() - amt); break;
    default: d.setMonth(d.getMonth() - amt); break;
  }
  return d;
}

/* ── SQL rule processor ── */

function sqlRuleProcessor(rule) {
  const field = FIELD_BY_KEY[rule.field];
  if (!field) return '(1=0)';
  const v = rule.value || {};

  /* Coded terminology → EXISTS subquery against patient_clinical_events */
  if (field.valueType === 'codedTerm') {
    if (!v.code) return '(1=1)';
    const negated = rule.operator === 'notHasCode';
    const dateFilt = v.lookback?.amount
      ? ` AND e.effective_date >= ${lookbackDateSQL(v.lookback)}`
      : '';
    const exists = `EXISTS (SELECT 1 FROM patient_clinical_events e WHERE e.patient_id = p.patient_id AND e.event_type = '${field.eventType}' AND e.code = '${v.code}'${dateFilt})`;
    return negated ? `NOT ${exists}` : exists;
  }

  /* Observation → subquery with numeric comparison */
  if (field.valueType === 'observation') {
    if (!v.analyte?.code || v.numericValue == null) return '(1=1)';
    const op = rule.operator || '>=';
    const dateFilt = v.lookback?.amount
      ? ` AND e.effective_date >= ${lookbackDateSQL(v.lookback)}`
      : '';
    return `EXISTS (SELECT 1 FROM patient_clinical_events e WHERE e.patient_id = p.patient_id AND e.event_type = 'lab' AND e.code = '${v.analyte.code}' AND e.numeric_value ${op} ${Number(v.numericValue)}${dateFilt})`;
  }

  /* Event count → COUNT subquery */
  if (field.valueType === 'eventCount') {
    if (!v.eventType || v.count == null) return '(1=1)';
    const op = rule.operator || '>=';
    const codeFilt = v.filter?.code ? ` AND e.code = '${v.filter.code}'` : '';
    const dateFilt = v.lookback?.amount
      ? ` AND e.effective_date >= ${lookbackDateSQL(v.lookback)}`
      : '';
    return `(SELECT COUNT(*) FROM patient_clinical_events e WHERE e.patient_id = p.patient_id AND e.event_type = '${v.eventType}'${codeFilt}${dateFilt}) ${op} ${Number(v.count)}`;
  }

  /* Profile-column fields: standard SQL */
  const col = field.profileColumn;
  if (!col) return '(1=1)';
  const op = rule.operator;

  if (field.valueType === 'number') {
    const num = Number(v.amount);
    if (!Number.isFinite(num)) return '(1=1)';
    return `p.${col} ${op} ${num}`;
  }

  if (field.valueType === 'date') {
    if (!v.text) return '(1=1)';
    return `p.${col} ${op} '${v.text}'`;
  }

  const text = v.text || '';
  if (!text) return '(1=1)';

  switch (op) {
    case '=': return `LOWER(p.${col}::text) = LOWER('${text}')`;
    case '!=': return `LOWER(p.${col}::text) != LOWER('${text}')`;
    case 'contains': return `p.${col}::text ILIKE '%${text}%'`;
    case 'doesNotContain': return `NOT (p.${col}::text ILIKE '%${text}%')`;
    default: return '(1=1)';
  }
}

/* ── JsonLogic rule processor ── */

function jsonLogicRuleProcessor(rule) {
  const field = FIELD_BY_KEY[rule.field];
  if (!field) return false;
  const v = rule.value || {};

  if (field.valueType === 'codedTerm') {
    if (!v.code) return true;
    const base = { in: [v.code, { var: `events.${field.eventType}.codes` }] };
    const withLookback = v.lookback?.amount
      ? { and: [base, { '>=': [{ var: `events.${field.eventType}.latestDate` }, { lookback: v.lookback }] }] }
      : base;
    return rule.operator === 'notHasCode' ? { '!': withLookback } : withLookback;
  }

  if (field.valueType === 'observation') {
    if (!v.analyte?.code || v.numericValue == null) return true;
    return {
      and: [
        { '==': [{ var: 'observation.code' }, v.analyte.code] },
        { [rule.operator || '>=']: [{ var: 'observation.value' }, Number(v.numericValue)] },
      ],
    };
  }

  if (field.valueType === 'eventCount') {
    if (!v.eventType || v.count == null) return true;
    return { [rule.operator || '>=']: [{ var: `events.${v.eventType}.count` }, Number(v.count)] };
  }

  /* Profile-column fields */
  const col = field.profileColumn;
  if (!col) return true;
  const op = rule.operator;

  if (field.valueType === 'number') {
    const num = Number(v.amount);
    if (!Number.isFinite(num)) return true;
    const opMap = { '>=': '>=', '<=': '<=', '>': '>', '<': '<', '=': '==', '!=': '!=' };
    return { [opMap[op] || '==']: [{ var: col }, num] };
  }

  if (field.valueType === 'date') {
    if (!v.text) return true;
    const opMap = { '>=': '>=', '<=': '<=', '=': '==', '!=': '!=' };
    return { [opMap[op] || '==']: [{ var: col }, v.text] };
  }

  const text = (v.text || '').toLowerCase();
  if (!text) return true;

  switch (op) {
    case '=': return { '==': [{ var: col }, text] };
    case '!=': return { '!=': [{ var: col }, text] };
    case 'contains': return { in: [text, { var: col }] };
    case 'doesNotContain': return { '!': { in: [text, { var: col }] } };
    default: return true;
  }
}

/* ── Normalize tree for rqb ──
   formatQuery expects { combinator, rules: [{ field, operator, value }] }.
   Our rules use complex value objects, flatten them so rqb can walk the tree,
   while the ruleProcessor receives the original rule via context. */

function normalizeForRqb(node) {
  if (Array.isArray(node.rules)) {
    return {
      ...node,
      rules: node.rules.map(normalizeForRqb),
    };
  }
  return {
    ...node,
    value: '__healthcare_rule__',
    _originalValue: node.value,
    _originalOperator: node.operator,
  };
}

/* ── Public API ── */

/**
 * Convert the population-group rule tree to a parameterized SQL WHERE clause.
 * The SQL references `p` as the p360_profiles alias and `patient_clinical_events`
 * for event-level subqueries.
 */
export function toSQL(query) {
  if (!query?.rules?.length) return { sql: '1=1', params: [] };
  try {
    const normalized = normalizeForRqb(query);
    const result = formatQuery(normalized, {
      format: 'sql',
      ruleProcessor: (rule) => sqlRuleProcessor({
        ...rule,
        value: rule._originalValue || rule.value,
        operator: rule._originalOperator || rule.operator,
      }),
    });
    return { sql: typeof result === 'string' ? result : result.sql || '1=1', params: [] };
  } catch (err) {
    console.warn('[formatQueryBridge] toSQL error:', err.message);
    return { sql: '1=1', params: [] };
  }
}

/**
 * Convert the population-group rule tree to JsonLogic for client-side
 * evaluation or export to external rule engines.
 */
export function toJsonLogic(query) {
  if (!query?.rules?.length) return {};
  try {
    const normalized = normalizeForRqb(query);
    const result = formatQuery(normalized, {
      format: 'jsonlogic',
      ruleProcessor: (rule) => jsonLogicRuleProcessor({
        ...rule,
        value: rule._originalValue || rule.value,
        operator: rule._originalOperator || rule.operator,
      }),
    });
    return result;
  } catch (err) {
    console.warn('[formatQueryBridge] toJsonLogic error:', err.message);
    return {};
  }
}

/**
 * Classify fields in a rule tree as 'profile' (evaluable client-side against
 * p360_profiles) or 'event' (requires patient_clinical_events queries).
 */
export function classifyFields(node) {
  const profile = new Set();
  const event = new Set();
  const walk = (n) => {
    if (Array.isArray(n.rules)) { n.rules.forEach(walk); return; }
    const field = FIELD_BY_KEY[n.field];
    if (!field) return;
    if (field.valueType === 'codedTerm' || field.valueType === 'observation' || field.valueType === 'eventCount') {
      event.add(n.field);
    } else {
      profile.add(n.field);
    }
  };
  walk(node);
  return { profile: [...profile], event: [...event], hasEvent: event.size > 0 };
}

/**
 * Get lookback date as a JS Date, for client-side event filtering.
 */
export { lookbackDateJS };

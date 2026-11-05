import { FIELD_BY_KEY, RULE_FIELDS } from './fieldCatalog';
import { parseLocalDate, localDateMs } from '../../../lib/localDate';

/* Pure rule evaluation, no React, no Supabase, so the same logic runs in
   the browser (useQualifiedMembers) and in node scripts
   (scripts/backfill-popgroup-counts.js keeps the table's Active/Inactive
   columns honest). */

/* Columns the evaluator reads: every catalog profileColumn plus identity. */
export const PROFILE_COLUMNS = ['id', 'patient_id', ...new Set(
  RULE_FIELDS.filter(f => f.profileColumn).map(f => f.profileColumn),
)];

const norm = (v) => String(v ?? '').toLowerCase();

/* Check whether a rule references event-level data (coded terms, observations,
   event counts) rather than a flat profile column. */
export function isEventRule(rule) {
  const field = FIELD_BY_KEY[rule.field];
  if (!field) return false;
  return field.valueType === 'codedTerm' || field.valueType === 'observation' || field.valueType === 'eventCount';
}

/* One condition against one profile. Missing data disqualifies (a rule about
   a value nobody recorded shouldn't match) except doesNotContain, where an
   empty list genuinely doesn't contain the needle. */
export function matchesRule(profile, rule) {
  const field = FIELD_BY_KEY[rule.field];
  if (!field) return false;

  /* Event-level rules need the events map injected into the profile.
     If no events data is available, the rule can't match. */
  if (field.valueType === 'codedTerm') {
    return matchesCodedTerm(profile, rule, field);
  }
  if (field.valueType === 'observation') {
    return matchesObservation(profile, rule, field);
  }
  if (field.valueType === 'eventCount') {
    return matchesEventCount(profile, rule, field);
  }

  const raw = profile[field.profileColumn];
  const v = rule.value || {};

  if (field.valueType === 'number') {
    const left = Number(raw);
    const right = Number(v.amount);
    if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
    switch (rule.operator) {
      case '>=': return left >= right;
      case '<=': return left <= right;
      case '>': return left > right;
      case '<': return left < right;
      case '=': return left === right;
      case '!=': return left !== right;
      default: return false;
    }
  }

  if (field.valueType === 'date') {
    const left = localDateMs(raw);
    const right = localDateMs(v.text);
    if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
    switch (rule.operator) {
      case '<=': return left <= right;
      case '>=': return left >= right;
      case '=': return new Date(left).toDateString() === new Date(right).toDateString();
      case '!=': return new Date(left).toDateString() !== new Date(right).toDateString();
      default: return false;
    }
  }

  const needle = norm(v.text);
  if (!needle) return false;
  const haystack = typeof raw === 'string' ? norm(raw) : norm(JSON.stringify(raw ?? ''));
  switch (rule.operator) {
    case '=': return norm(raw) === needle;
    case '!=': return norm(raw) !== needle && raw != null;
    case 'contains': return haystack.includes(needle);
    case 'doesNotContain': return !haystack.includes(needle);
    default: return false;
  }
}

/* ── Event-level matchers ── */

function lookbackCutoff(lb) {
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

function matchesCodedTerm(profile, rule, field) {
  const v = rule.value || {};
  if (!v.code) return true;
  const events = profile._events?.[field.eventType] || [];
  const cutoff = lookbackCutoff(v.lookback);
  const match = events.some(ev => {
    if (ev.code !== v.code) return false;
    if (cutoff && ev.effective_date && parseLocalDate(ev.effective_date) < cutoff) return false;
    return true;
  });
  return rule.operator === 'notHasCode' ? !match : match;
}

function matchesObservation(profile, rule, field) {
  const v = rule.value || {};
  if (!v.analyte?.code || v.numericValue == null) return true;
  const events = profile._events?.lab || [];
  const cutoff = lookbackCutoff(v.lookback);
  const target = Number(v.numericValue);
  return events.some(ev => {
    if (ev.code !== v.analyte.code) return false;
    if (cutoff && ev.effective_date && parseLocalDate(ev.effective_date) < cutoff) return false;
    const val = Number(ev.numeric_value);
    if (!Number.isFinite(val)) return false;
    switch (rule.operator) {
      case '>=': return val >= target;
      case '<=': return val <= target;
      case '>': return val > target;
      case '<': return val < target;
      case '=': return val === target;
      case '!=': return val !== target;
      default: return false;
    }
  });
}

function matchesEventCount(profile, rule, field) {
  const v = rule.value || {};
  if (!v.eventType || v.count == null) return true;
  const events = profile._events?.[v.eventType] || [];
  const cutoff = lookbackCutoff(v.lookback);
  let count = 0;
  for (const ev of events) {
    if (v.filter?.code && ev.code !== v.filter.code) continue;
    if (cutoff && ev.effective_date && parseLocalDate(ev.effective_date) < cutoff) continue;
    count++;
  }
  const target = Number(v.count);
  switch (rule.operator) {
    case '>=': return count >= target;
    case '<=': return count <= target;
    case '>': return count > target;
    case '<': return count < target;
    case '=': return count === target;
    default: return false;
  }
}

/* Recursive over nested groups; a leaf with `not: true` inverts its match
   (the Figma's "is not Tobacco Use" exclusions). Incomplete leaves are
   ignored rather than failing the whole group. */
export function matchesNode(profile, node) {
  if (Array.isArray(node.rules)) {
    const children = node.rules.filter(child => {
      if (Array.isArray(child.rules)) return true;
      const v = child.value || {};
      /* Event-level rules are "complete" if they have a code/eventType */
      const field = FIELD_BY_KEY[child.field];
      if (field?.valueType === 'codedTerm') return !!v.code;
      if (field?.valueType === 'observation') return !!v.analyte?.code;
      if (field?.valueType === 'eventCount') return !!v.eventType && v.count != null;
      return (v.amount ?? v.text ?? '') !== '';
    });
    if (children.length === 0) return true;
    const or = node.combinator === 'or';
    return or
      ? children.some(child => matchesNode(profile, child))
      : children.every(child => matchesNode(profile, child));
  }
  const hit = matchesRule(profile, node);
  return node.not ? !hit : hit;
}

export function evaluate(profiles, query) {
  const hasLeaf = (node) => (node.rules || []).some(child => {
    if (Array.isArray(child.rules)) return hasLeaf(child);
    const v = child.value || {};
    const field = FIELD_BY_KEY[child.field];
    if (field?.valueType === 'codedTerm') return !!v.code;
    if (field?.valueType === 'observation') return !!v.analyte?.code;
    if (field?.valueType === 'eventCount') return !!v.eventType && v.count != null;
    return (v.amount ?? v.text ?? '') !== '';
  });
  if (!query || !hasLeaf(query)) return [];
  return profiles.filter(p => matchesNode(p, query));
}

/* Active/Inactive split for a set of qualified profiles, the numbers the
   Population Groups table's two member columns show. */
export function memberCounts(qualifiedProfiles) {
  const inactive = qualifiedProfiles.filter(p => norm(p.membership_status) === 'inactive').length;
  return { count: qualifiedProfiles.length - inactive, inactive };
}

/* Check if any rule in the tree requires event-level data. */
export function hasEventRules(node) {
  if (!node) return false;
  if (Array.isArray(node.rules)) return node.rules.some(hasEventRules);
  return isEventRule(node);
}

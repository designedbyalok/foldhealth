// Care plan review cadence (#131): how often a patient's care plan is
// reviewed, per program and per acuity, with a per-patient override and a
// post-discharge spike. Nothing here is stored: the cadence, the next due
// date and the overdue flag are worked out from the program's settings, the
// enrollment and the patient's discharges each time, so a spike ends on its
// own and a finished review moves the next due date straight away.
import { parseLocalDate } from '../../../../../../../lib/localDate.js';

export const CADENCE_UNITS = [
  { value: 'day', label: 'Days' },
  { value: 'week', label: 'Weeks' },
  { value: 'month', label: 'Months' },
];

export const ACUITY_LEVELS = ['High', 'Medium', 'Low'];

const DAYS_PER = { day: 1, week: 7, month: 30 };

const POST_DISCHARGE = { enabled: true, every: 1, unit: 'week', days: 30 };

/** A program's cadence settings when it has none saved. */
export function defaultCadence(code) {
  const base = { every: 1, unit: 'month', byAcuity: {}, overdueAfterDays: 7, postDischarge: POST_DISCHARGE };
  if (code === 'HICM') return { ...base, unit: 'week', overdueAfterDays: 2 };
  if (code === 'SNP') return { ...base, every: 3, byAcuity: { High: { every: 1, unit: 'month' } }, overdueAfterDays: 14 };
  if (code === 'CCM') return { ...base, byAcuity: { High: { every: 2, unit: 'week' } } };
  return base;
}

/** Saved settings over the program's defaults, so older rows read whole. */
export function withCadenceDefaults(code, saved) {
  const d = defaultCadence(code);
  if (!saved || typeof saved !== 'object') return d;
  return {
    ...d,
    ...saved,
    byAcuity: { ...(saved.byAcuity || d.byAcuity) },
    postDischarge: { ...d.postDischarge, ...(saved.postDischarge || {}) },
  };
}

/** "Weekly", "Every 2 weeks", "Monthly", "Quarterly", "Every 10 days". */
export function formatInterval({ every, unit } = {}) {
  const n = Number(every) || 1;
  if (n === 1) return { day: 'Daily', week: 'Weekly', month: 'Monthly' }[unit] || 'Monthly';
  if (unit === 'week' && n === 2) return 'Every 2 weeks';
  if (unit === 'month' && n === 3) return 'Quarterly';
  if (unit === 'month' && n === 12) return 'Yearly';
  return `Every ${n} ${unit}s`;
}

const approxDays = ({ every, unit }) => (Number(every) || 1) * (DAYS_PER[unit] || 30);

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function addInterval(date, { every, unit }) {
  const n = Number(every) || 1;
  const d = startOfDay(date);
  if (unit === 'day') d.setDate(d.getDate() + n);
  else if (unit === 'week') d.setDate(d.getDate() + 7 * n);
  else {
    // Month end stays month end: Jan 31 + 1 month is Feb 28, not Mar 3.
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + n);
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  }
  return d;
}

const addDays = (date, n) => { const d = startOfDay(date); d.setDate(d.getDate() + n); return d; };

/** "Very High" reads as High; anything unknown has no acuity rule. */
export function normalizeAcuity(acuity) {
  const a = String(acuity || '').trim().toLowerCase();
  if (a === 'very high' || a === 'high') return 'High';
  if (a === 'medium' || a === 'moderate') return 'Medium';
  if (a === 'low') return 'Low';
  return null;
}

/** Discharge dates from ADT clinical events (raw_meta.action = discharge). */
export function dischargeDates(clinicalEvents = []) {
  return clinicalEvents
    .filter(e => e.event_type === 'adt' && String(e.raw_meta?.action || '').toLowerCase() === 'discharge')
    .map(e => parseLocalDate(e.end_date || e.effective_date))
    .filter(Boolean);
}

/**
 * The cadence in force today and why: a post-discharge spike, the patient's
 * override, the program's rule for their acuity, or the program default.
 * During a spike the tighter of it and an override wins, so an override never
 * slackens follow-up straight after a discharge.
 */
export function resolveCadence({ config, acuity, override, discharges = [], today = new Date() }) {
  const level = normalizeAcuity(acuity);
  const rule = level && config.byAcuity?.[level];
  let pick = rule
    ? { every: rule.every, unit: rule.unit, source: 'acuity', sourceLabel: `${level} acuity` }
    : { every: config.every, unit: config.unit, source: 'program', sourceLabel: 'Program default' };
  if (override?.every && override?.unit) {
    pick = { every: override.every, unit: override.unit, source: 'override', sourceLabel: 'Patient override' };
  }
  const pd = config.postDischarge;
  if (pd?.enabled) {
    const now = startOfDay(today);
    const latest = discharges.filter(d => d <= now).sort((a, b) => b - a)[0];
    const until = latest && addDays(latest, Number(pd.days) || 0);
    const spike = { every: pd.every, unit: pd.unit };
    if (until && now < until && (pick.source !== 'override' || approxDays(spike) < approxDays(pick))) {
      pick = { ...spike, source: 'post_discharge', sourceLabel: 'Post-discharge', since: latest, until };
    }
  }
  return { ...pick, label: formatInterval(pick) };
}

/**
 * When the next review falls due: one interval after the last touch (the
 * last finished review, else the signed plan, else the enrollment). During a
 * post-discharge spike the discharge counts as a touch, so a long-quiet plan
 * is due a week after discharge rather than already overdue.
 */
export function nextReviewDue({ cadence, lastTouch }) {
  const last = parseLocalDate(lastTouch);
  const anchor = cadence.source === 'post_discharge' && (!last || last < cadence.since) ? cadence.since : last;
  return anchor ? addInterval(anchor, cadence) : null;
}

/** 'upcoming' before the due date, 'due' from it, 'overdue' N days after. */
export function reviewStatus({ due, overdueAfterDays = 0, today = new Date() }) {
  if (!due) return { state: 'unscheduled', daysOverdue: 0 };
  const now = startOfDay(today);
  if (now < due) return { state: 'upcoming', daysOverdue: 0 };
  const late = Math.round((now - due) / 86400000);
  return late >= (Number(overdueAfterDays) || 0) && late > 0
    ? { state: 'overdue', daysOverdue: late }
    : { state: 'due', daysOverdue: late };
}

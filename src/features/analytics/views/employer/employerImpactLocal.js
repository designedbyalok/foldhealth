/**
 * Employer Impact Report: in-browser stand-in for the Supabase functions,
 * used until `employer_impact_metrics` is seeded. It rolls up the same
 * generated rows `bun run seed` writes, the same way
 * `employer_impact_rollup` / `employer_impact_filters` do, so the report
 * looks identical before and after the seed.
 */
import { EMPLOYER_IMPACT_EMPLOYERS, employerImpactRows, employerImpactWeeklyRows } from './employerImpactSeed';

let cache = null;
let weeklyCache = null;

// The seed's year ends this month; so does this.
function rows() {
  if (!cache) {
    const now = new Date();
    const last = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}`;
    cache = employerImpactRows(lastMonth);
  }
  return cache;
}

/** Same shape as `employer_impact_filters()`. */
export function localEmployerImpactFilters() {
  const all = rows();
  const months = all.map(r => r.month.slice(0, 7)).sort();
  return {
    employers: EMPLOYER_IMPACT_EMPLOYERS.map(({ id, name }) => ({ id, name })),
    patientLocations: [...new Set(all.map(r => r.patient_location))].sort(),
    visitLocations: [...new Set(all.map(r => r.visit_location))].sort(),
    firstMonth: months[0],
    lastMonth: months[months.length - 1],
  };
}

function weeklyRows() {
  if (!weeklyCache) weeklyCache = employerImpactWeeklyRows(rows());
  return weeklyCache;
}

/** Same shape as `employer_impact_rollup()`: `[{ m, s, b, mo, v }]`. */
export function localEmployerImpactRollup(filters) {
  return rollup(rows(), r => r.month.slice(0, 7), filters);
}

/** Same shape as `employer_impact_weekly_rollup()`: `mo` is the week's Monday. */
export function localEmployerImpactWeeklyRollup(filters) {
  return rollup(weeklyRows(), r => r.week, filters);
}

function rollup(source, periodOf, { from, to, employer = null, scope = 'patient', location = null }) {
  const groups = new Map();
  for (const r of source) {
    const mo = periodOf(r);
    if (mo.slice(0, 7) < from || mo.slice(0, 7) > to) continue;
    if (employer && r.employer_id !== employer) continue;
    if (location && (scope === 'visit' ? r.visit_location : r.patient_location) !== location) continue;
    const key = `${r.metric}\u0000${r.series}\u0000${r.bucket}\u0000${mo}`;
    const prev = groups.get(key);
    if (!prev) { groups.set(key, { m: r.metric, s: r.series, b: r.bucket, mo, v: r.value }); continue; }
    if (r.series === 'max') prev.v = Math.max(prev.v, r.value);
    else if (r.series === 'min') prev.v = Math.min(prev.v, r.value);
    else prev.v += r.value;
  }
  return [...groups.values()];
}

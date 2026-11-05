import { annotateClaims, enrichPharmacyMember, parseMdy, todayMdy } from './pharmacyWorklist.utils';

// Pharmacy reports (status model spec, Reporting): the workflow feeds
// reports, not billing. All four read the pharmacy worklist members as
// stored, so they match the worklist row for row.
//   Productivity   outreaches, steps performed and locked actions, by coordinator
//   Outcomes       gaps closed, reversals, rework, safe and failed gaps, by
//                  measure, health plan or IPA (shared with health plans)
//   Provider groups  the same per provider group (IPA), as Richard sends today
//   Data quality   claims not matched, non–Part D claims, rows held for review

const DAY_MS = 86_400_000;

export const REPORT_PERIODS = ['Last 7 days', 'Last 30 days', 'Year to date'];

function periodStart(period) {
  const today = parseMdy(todayMdy());
  if (period === 'Last 7 days') return today - 6 * DAY_MS;
  if (period === 'Last 30 days') return today - 29 * DAY_MS;
  return Date.UTC(new Date(today).getUTCFullYear(), 0, 1);
}

const pct = (n, d) => (d ? Math.round((n / d) * 100) : null);

// One row per coordinator who logged work in the period, busiest first. A
// locked verification call is one locked action and one outreach for KPIs;
// its steps are the answers recorded per drug.
export function productivityReport(members, period = 'Last 30 days') {
  const from = periodStart(period);
  const rows = new Map();
  for (const m of members) {
    for (const c of m.callHistory || []) {
      if ((parseMdy(c.date) ?? 0) < from) continue;
      const by = c.by || 'Unknown';
      const r = rows.get(by) || { coordinator: by, outreaches: 0, reached: 0, locked: 0, steps: 0, members: new Set() };
      r.outreaches += 1;
      // A locked verification call reached the pharmacy, whatever it found.
      if (c.result === 'success' || c.locked) r.reached += 1;
      if (c.locked) {
        r.locked += 1;
        r.steps += (c.items || []).reduce((n, i) => n + (i.steps || []).length, 0);
      }
      r.members.add(m.id);
      rows.set(by, r);
    }
  }
  const list = [...rows.values()]
    .map(r => ({ ...r, members: r.members.size, reachRate: pct(r.reached, r.outreaches) }))
    .toSorted((a, b) => b.outreaches - a.outreaches || a.coordinator.localeCompare(b.coordinator));
  const sum = (k) => list.reduce((n, r) => n + r[k], 0);
  return {
    rows: list,
    totals: { outreaches: sum('outreaches'), reached: sum('reached'), locked: sum('locked'), steps: sum('steps'), reachRate: pct(sum('reached'), sum('outreaches')) },
  };
}

const OUTCOME_GROUP = {
  measure: { label: 'Measure', of: (m, g) => g.code },
  healthPlan: { label: 'Health Plan', of: (m) => m.healthPlan || 'No plan' },
  ipa: { label: 'IPA', of: (m) => m.ipa || 'No IPA' },
};
export const OUTCOME_GROUP_LABELS = Object.fromEntries(Object.entries(OUTCOME_GROUP).map(([k, v]) => [k, v.label]));

function emptyOutcome(group) {
  return { group, gaps: 0, closed: 0, met: 0, pending: 0, open: 0, failed: 0, excluded: 0, reversals: 0, rework: 0, pdcSum: 0, pdcCount: 0, belowTarget: 0 };
}

function addGap(r, g) {
  const s = g.status.gap;
  r.gaps += 1;
  if (s === 'Closed') r.closed += 1;
  else if (s === 'Met for Year') r.met += 1;
  else if (s === 'Pending Claim') r.pending += 1;
  else if (s === 'Failed for Year') r.failed += 1;
  else if (s === 'Excluded') r.excluded += 1;
  else r.open += 1;
  if (g.recon?.status === 'Claim reversed') r.reversals += 1;
  if (g.recon?.rework) r.rework += 1;
  if (g.pdc != null && s !== 'Excluded') {
    r.pdcSum += g.pdc;
    r.pdcCount += 1;
    if (g.pdc < 80) r.belowTarget += 1;
  }
}

// A gap counts as closed when it is Closed or Met for Year; Excluded gaps
// leave the count, as on the worklist's Progress.
function finishOutcome(r) {
  const counted = r.gaps - r.excluded;
  return { ...r, closedTotal: r.closed + r.met, closureRate: pct(r.closed + r.met, counted), avgPdc: r.pdcCount ? Math.round(r.pdcSum / r.pdcCount) : null };
}

// Rows of `enriched` members (enrichPharmacyMember) by measure, health plan
// or IPA, plus a total row. First Fill and Not Eligible gaps are not on the
// worklist, so not here either.
export function outcomesReport(enriched, groupBy = 'measure') {
  const { of } = OUTCOME_GROUP[groupBy];
  const groups = new Map();
  const total = emptyOutcome('All');
  const members = new Map();
  for (const m of enriched) {
    for (const g of m.gaps) {
      const key = of(m, g);
      const r = groups.get(key) || emptyOutcome(key);
      addGap(r, g);
      addGap(total, g);
      groups.set(key, r);
      members.set(key, (members.get(key) || new Set()).add(m.id));
    }
  }
  return {
    rows: [...groups.values()].map(r => ({ ...finishOutcome(r), members: members.get(r.group).size }))
      .toSorted((a, b) => a.group.localeCompare(b.group)),
    total: { ...finishOutcome(total), members: enriched.filter(m => m.gaps.length).length },
  };
}

// The data the claim feed sent that Fold could not use, one row per issue.
export function dataQualityReport(enriched) {
  const rows = [];
  for (const m of enriched) {
    for (const g of m.gaps) {
      if (g.recon?.status === 'Claim not matched') {
        rows.push({ memberId: m.id, member: m.name, code: g.code, issue: 'Claim not matched', date: g.recon.fillDate, detail: g.recon.detail });
      }
      for (const d of g.medications) {
        for (const c of annotateClaims(d.refills)) {
          if (c.effect === 'Not Part D') rows.push({ memberId: m.id, member: m.name, code: g.code, issue: 'Non–Part D claim', date: c.date, detail: `${d.name}: claim ${c.claimId || c.date} billed to ${c.coverage}` });
          if (c.effect === 'Invalid') rows.push({ memberId: m.id, member: m.name, code: g.code, issue: 'Held for review', date: c.date, detail: `${d.name}: claim ${c.claimId || c.date}, days supply ${c.daysSupply}` });
        }
      }
    }
  }
  const count = (issue) => rows.filter(r => r.issue === issue).length;
  return {
    rows: rows.toSorted((a, b) => (parseMdy(b.date) ?? 0) - (parseMdy(a.date) ?? 0)),
    counts: { notMatched: count('Claim not matched'), nonPartD: count('Non–Part D claim'), heldForReview: count('Held for review') },
  };
}

// Members as the reports see them, narrowed by health plan, IPA and measure.
export function reportMembers(members, { healthPlans = [], ipas = [], measures = [] } = {}) {
  return members
    .filter(m => (!healthPlans.length || healthPlans.includes(m.healthPlan)) && (!ipas.length || ipas.includes(m.ipa)))
    .map(m => enrichPharmacyMember(m))
    .map(m => (measures.length ? { ...m, gaps: m.gaps.filter(g => measures.includes(g.code)) } : m));
}

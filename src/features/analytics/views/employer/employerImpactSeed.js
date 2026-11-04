/**
 * Employer Impact Report: sample rows for `employer_impact_metrics`, used by
 * scripts/seed.js. Deterministic: every value comes from a seeded generator
 * keyed on its row, so re-seeding writes the same numbers and upserts are
 * no-ops.
 *
 * Metrics, series and buckets come from employerImpactConfig.js, the same
 * definitions the charts read. Four widgets are deliberately left without
 * rows (Reengagement, Patients Not Engaged, Video, Self-Scheduled) to match
 * the design, which shows them empty: they render as soon as rows exist.
 */
import { WEEKDAYS, HOURS, SAVINGS_CATEGORIES, SAVINGS_METRIC, WIDGETS } from './employerImpactConfig';
import { mondaysOf } from './employerImpactData';

export const EMPLOYER_IMPACT_EMPLOYERS = [
  { id: 'emp-northwind', name: 'Northwind Logistics', sort_order: 0 },
  { id: 'emp-brightline', name: 'Brightline Schools', sort_order: 1 },
  { id: 'emp-harbor', name: 'Harbor Manufacturing', sort_order: 2 },
];

// Where members live, and the clinic that sees them. Not a full cross
// product: members mostly use the clinic near them.
const LOCATION_PAIRS = [
  ['San Francisco, CA', 'Downtown Clinic'],
  ['Oakland, CA', 'Eastside Clinic'],
  ['San Jose, CA', 'Downtown Clinic'],
  ['San Jose, CA', 'Eastside Clinic'],
];

// Each employer's size relative to the others, and each pair's share.
const EMPLOYER_SCALE = { 'emp-northwind': 1.2, 'emp-brightline': 0.8, 'emp-harbor': 1 };
const PAIR_SCALE = [0.35, 0.25, 0.25, 0.15];

// Hourly shape of calls and visits: quiet overnight, busy late morning.
const HOUR_SHAPE = HOURS.map((_, h) => (h < 7 ? 0.25 : h < 9 ? 0.8 : h < 17 ? 1.4 : h < 20 ? 0.9 : 0.4));
const WEEKDAY_SHAPE = [0.6, 1.2, 1.1, 1.25, 0.7, 1.3, 0.8];

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** A stable pseudo-random number in [0, 1) for a given key. */
const rand = (key) => {
  let t = hash(key) + 0x6D2B79F5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
/** `base`, scaled, with ±`spread` noise; never negative. */
const vary = (key, base, spread = 0.25) => Math.max(0, Math.round(base * (1 - spread + rand(key) * spread * 2)));

/** The twelve months ending with `lastMonth` ('YYYY-MM'). */
function lastTwelveMonths(lastMonth) {
  const [y, m] = lastMonth.split('-').map(Number);
  return Array.from({ length: 12 }, (_, i) => {
    const total = y * 12 + (m - 1) - (11 - i);
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
  });
}

/**
 * @param {string} lastMonth – 'YYYY-MM'; the seed covers the year ending here
 * @returns {object[]} rows for employer_impact_metrics
 */
export function employerImpactRows(lastMonth) {
  const months = lastTwelveMonths(lastMonth);
  const rows = [];

  for (const emp of EMPLOYER_IMPACT_EMPLOYERS) {
    LOCATION_PAIRS.forEach(([patientLoc, visitLoc], pi) => {
      const scale = EMPLOYER_SCALE[emp.id] * PAIR_SCALE[pi];
      months.forEach((month, mi) => {
        // Gentle growth through the year, so trend lines have a direction.
        const growth = 0.8 + (mi / 11) * 0.4;
        const k = (...parts) => [emp.id, patientLoc, visitLoc, month, ...parts].join('|');
        const add = (metric, series, value, bucket = '') => rows.push({
          id: k(metric, series, bucket),
          employer_id: emp.id,
          patient_location: patientLoc,
          visit_location: visitLoc,
          month: `${month}-01`,
          metric, series, bucket,
          value,
        });
        const n = (metric, series, base, bucket = '', spread) =>
          add(metric, series, vary(k(metric, series, bucket), base * scale * growth, spread), bucket);

        // Overview
        n('active_members', 'employees', 110); n('active_members', 'spouse', 55); n('active_members', 'child', 45);
        n('active_members', 'one_off', 50); n('active_members', 'inactive', 35);
        n('membership_revenue', 'revenue', 1200, '', 0.1);
        n('new_memberships', 'employees', 120); n('new_memberships', 'dependents', 100);
        n('attrition', 'employees', 150); n('attrition', 'dependents', 90);

        // Engagement
        n('engaged_for_care', 'employee', 22); n('engaged_for_care', 'dependent', 18);
        n('engaged_for_care', 'spouse', 10); n('engaged_for_care', 'child', 14); n('engaged_for_care', 'not_engaged', 12);
        const members = 12000 * scale;
        [['3', 0.12], ['6', 0.2], ['12', 0.44]].forEach(([w, share]) => {
          add('not_engaged_window', 'total', Math.round(members), w);
          add('not_engaged_window', 'count', vary(k('ne', w), members * share, 0.08), w);
        });
        [['90', 0.5], ['180', 0.5], ['360', 0.28]].forEach(([w, share]) => {
          add('not_seen_window', 'total', Math.round(members), w);
          add('not_seen_window', 'count', vary(k('ns', w), members * share, 0.08), w);
        });
        n('office_hours', 'office', 170); n('office_hours', 'after', 110);
        n('engagement_stratification', 'voice', 150); n('engagement_stratification', 'messages', 110);
        n('app_logins', 'employee', 270);
        [['Diabetes Course Quiz 1', 400], ['Annual Wellness Survey', 250]].forEach(([form, base]) => {
          const sent = vary(k('sat-sent', form), base * scale, 0.15);
          const responded = Math.round(sent * (0.55 + rand(k('sat-r', form)) * 0.35));
          add('satisfaction', 'sent', sent, form);
          add('satisfaction', 'responded', responded, form);
          add('satisfaction', 'score_sum', Math.round(responded * (7 + rand(k('sat-s', form)) * 1.8)), form);
        });

        // Communication
        n('calls', 'outbound', 170); n('calls', 'inbound', 110);
        n('app_chats', 'practice', 170); n('app_chats', 'member', 110);
        n('sms', 'practice', 170); n('sms', 'member', 110);
        WEEKDAYS.forEach((d, i) => {
          n('calls_by_weekday', 'outbound', 25 * WEEKDAY_SHAPE[i], d);
          n('calls_by_weekday', 'inbound', 16 * WEEKDAY_SHAPE[i], d);
        });
        HOURS.forEach((h, i) => {
          n('calls_by_hour', 'outbound', 7 * HOUR_SHAPE[i], h);
          n('calls_by_hour', 'inbound', 12 * HOUR_SHAPE[i], h);
        });

        // Clinical visits
        n('visits_by_member_type', 'employees', 210); n('visits_by_member_type', 'dependents', 90);
        n('visits_modality', 'in_person', 230); n('visits_modality', 'video', 70);
        n('visits_by_appointment', 'visits', 6, 'MA Visit MT'); n('visits_by_appointment', 'visits', 5.5, 'Same Day MT');
        WEEKDAYS.forEach((d, i) => {
          n('visits_by_weekday', 'employees', 17 * WEEKDAY_SHAPE[i], d);
          n('visits_by_weekday', 'dependents', 11 * WEEKDAY_SHAPE[i], d);
        });
        HOURS.forEach((h, i) => {
          n('visits_by_hour', 'employees', 6 * HOUR_SHAPE[i], h);
          n('visits_by_hour', 'dependents', 14 * HOUR_SHAPE[i], h);
        });
        const visits = vary(k('dur-v'), 300 * scale, 0.2);
        add('visit_duration', 'visits', visits);
        add('visit_duration', 'total_minutes', Math.round(visits * (24 + rand(k('dur-m')) * 8)));
        add('visit_duration', 'max', 50 + Math.round(rand(k('dur-max')) * 25));
        add('visit_duration', 'min', 8 + Math.round(rand(k('dur-min')) * 6));

        // Clinical trends (ranked; a sixth or seventh entry proves the top-5 cut)
        const ranked = (metric, series, entries) =>
          entries.forEach(([label, base]) => n(metric, series, base / 12, label));
        ranked('top_medications', 'orders', [['Atorvastatin', 660], ['Levothyroxine', 630], ['Lisinopril', 500], ['Amlodipine', 480], ['Metformin', 265], ['Omeprazole', 180], ['Sertraline', 120]]);
        ranked('top_imaging', 'orders', [['CT Scan', 660], ['MRI', 630], ['Ultrasound', 500], ['PET Scan', 480], ['X-ray', 265], ['Mammogram', 150]]);
        ranked('top_labs', 'orders', [['HbA1c', 660], ['Lipid Panel', 630], ['CBC', 550], ['BMP', 360], ['Urinalysis', 240], ['TSH', 160]]);
        ranked('top_diagnoses', 'visits', [['Fever', 660], ['Headache', 630], ['Cold', 550], ['Cough', 360], ['UTIs', 240], ['Back Pain', 170]]);

        // Demographics (snapshots)
        [['16 - 30', 70], ['31 - 50', 250], ['> 51', 150]].forEach(([b, base]) => n('age', 'members', base, b, 0.1));
        [['Female', 100], ['Male', 108], ['Others', 98]].forEach(([b, base]) => n('gender', 'members', base, b, 0.1));
        ranked('top_conditions', 'members', [['Obesity', 7900], ['Hypertension', 7600], ['Diabetes', 6000], ['Anxiety', 5700], ['Seasonal Allergies', 3100], ['Asthma', 2200]]);
        ranked('top_chronic', 'members', [['Diabetes Type 2', 7900], ['Hypertension', 7600], ['Asthma', 6300], ['Arthritis', 5900], ['Cancer', 2200], ['COPD', 1500]]);

        // Cost savings: traditional vs. our cost per category. Imaging runs
        // slightly above traditional, as in the design, so the negative case shows.
        const COSTS = {
          visit: [675151, 48170], lab: [1161332, 43784], imaging: [97000, 100000],
          procedure: [1125721, 24532], medication: [926029, 24976], avoidable_visit: [912157, 40211],
        };
        SAVINGS_CATEGORIES.forEach(({ key }) => {
          const [trad, ours] = COSTS[key];
          add(SAVINGS_METRIC, 'traditional', vary(k('cs-t', key), (trad / 12) * scale, 0.05), key);
          add(SAVINGS_METRIC, 'ours', vary(k('cs-o', key), (ours / 12) * scale, 0.05), key);
        });
      });
    });
  }
  return rows;
}

// The metrics the time-series charts draw (plus the survey response rate):
// the only ones Month and Quarter read by week.
const WEEKLY_METRICS = new Set([...WIDGETS.filter(w => w.x === 'month').map(w => w.metric), 'satisfaction']);
const SNAPSHOT_METRICS = new Set(WIDGETS.filter(w => w.x === 'month' && w.agg === 'latest').map(w => w.metric));

/**
 * Rows for employer_impact_weekly_metrics, split from monthly rows: each
 * month's value spreads over the weeks it owns (their Mondays) with uneven,
 * seeded weights, so its weeks add up to it. Snapshots repeat the month's
 * level with a little drift. A survey's sent / responded / score split with
 * the same weights, so no week has more responses than sends.
 *
 * @param {object[]} monthlyRows – rows from employerImpactRows
 * @returns {object[]} rows for employer_impact_weekly_metrics
 */
export function employerImpactWeeklyRows(monthlyRows) {
  const out = [];
  for (const r of monthlyRows) {
    if (!WEEKLY_METRICS.has(r.metric)) continue;
    const weeks = mondaysOf(r.month.slice(0, 7));
    const base = [r.employer_id, r.patient_location, r.visit_location, r.metric, r.metric === 'satisfaction' ? '' : r.series, r.bucket].join('|');
    const weights = weeks.map(w => 0.7 + rand(`${base}|${w}`) * 0.6);
    const total = weights.reduce((a, b) => a + b, 0);
    let left = r.value;
    weeks.forEach((week, i) => {
      let value;
      if (SNAPSHOT_METRICS.has(r.metric)) value = vary(`${r.id}|${week}`, r.value, 0.04);
      // The last week takes what's left, so rounding never drifts the month.
      else if (i === weeks.length - 1) value = Math.max(0, left);
      else { value = Math.round((r.value * weights[i]) / total); left -= value; }
      out.push({
        id: [r.employer_id, r.patient_location, r.visit_location, week, r.metric, r.series, r.bucket].join('|'),
        employer_id: r.employer_id,
        patient_location: r.patient_location,
        visit_location: r.visit_location,
        week,
        metric: r.metric, series: r.series, bucket: r.bucket,
        value,
      });
    });
  }
  return out;
}

// Sample export history (History button), relative to `now` so the log
// always has recent entries. Also the stand-in until the table exists.
export function employerImpactExportRows(now = new Date()) {
  const daysAgo = (d, h) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - d, h, 15).toISOString();
  return [
    { id: 'eie-sample-1', format: 'pdf', employer: 'Northwind Logistics', time_frame: 'Quarter', date_range: 'Jul 2026 - Sep 2026', filename: 'employer-impact-report-2026-07-to-2026-09.pdf', exported_by: 'Devanshi Sharma', exported_at: daysAgo(1, 10) },
    { id: 'eie-sample-2', format: 'html', employer: 'Brightline Schools', time_frame: 'Quarter', date_range: 'Jul 2026 - Sep 2026', filename: 'employer-impact-report-2026-07-to-2026-09.html', exported_by: 'Alok Kumar', exported_at: daysAgo(3, 15) },
    { id: 'eie-sample-3', format: 'print', employer: 'Northwind Logistics', time_frame: 'Month', date_range: 'Aug 2026', filename: 'employer-impact-report-2026-08-to-2026-08.pdf', exported_by: 'Devanshi Sharma', exported_at: daysAgo(12, 11) },
    { id: 'eie-sample-4', format: 'pdf', employer: 'Harbor Manufacturing', time_frame: 'Year', date_range: 'Oct 2025 - Sep 2026', filename: 'employer-impact-report-2025-10-to-2026-09.pdf', exported_by: 'Alok Kumar', exported_at: daysAgo(40, 9) },
  ];
}

/**
 * Employer Impact Report: what every widget shows. Figma "Jan–Feb 2026"
 * 5618:10554.
 *
 * Plain data, no React, so the seed generator (scripts/seed.js) reads the
 * same metrics, series and buckets the UI draws, and a chart and its data
 * can only drift if this file does.
 *
 * Each widget reads rows of `employer_impact_metrics` under one `metric`:
 *   x       'month'  : one bar/point per month, regrouped by the Time Frame
 *           'weekday' | 'hour' | 'bucket': the row's `bucket` is the category
 *   agg     'sum'    : events (visits, calls, orders) add up over the range
 *           'latest' : snapshots (members, conditions) take the last month
 *   series  the row's `series`, in legend order; colours follow this order
 */

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// The two report views. Keys stay 'patient' / 'visit' because they pick
// which location column the SQL filters on.
export const LOCATION_SCOPES = ['patient', 'visit'];
export const SCOPE_OPTIONS = [
  { key: 'patient', label: 'All Locations' },
  { key: 'visit', label: 'By Location' },
];

// By Location is a clinic view: only its Clinical Visits section.
const VISIT_SECTIONS = new Set(['clinicalVisits']);

/** The sections a view shows. */
export const sectionsForScope = (scope) => (scope === 'visit' ? SECTIONS.filter(s => VISIT_SECTIONS.has(s.id)) : SECTIONS);

export const HOURS = Array.from({ length: 24 }, (_, h) =>
  `${String(h).padStart(2, '0')}-${String((h + 1) % 24).padStart(2, '0')}`);

// `subtitle` is each section's default subtitle in the printed report; the
// Print drawer lets it be edited or cleared.
export const SECTIONS = [
  { id: 'overview', title: 'Overview', subtitle: 'Membership size, revenue, growth and retention' },
  { id: 'costSavings', title: 'Cost Savings', heading: 'Cost savings comparison', subtitle: 'What care would have cost at traditional rates, against the actual cost' },
  { id: 'engagement', title: 'Engagement', subtitle: 'How actively members use care and how satisfied they are' },
  { id: 'communication', title: 'Communication', subtitle: 'How members reach the care team, by channel and time' },
  { id: 'clinicalVisits', title: 'Clinical Visits', subtitle: 'Visit volume, format, timing and length' },
  { id: 'clinicalTrends', title: 'Clinical Trends', subtitle: 'The most common prescriptions, orders and diagnoses' },
  { id: 'demographics', title: 'Demographics', subtitle: 'Who the members are and their most common health conditions' },
];

const MEMBER_MIX = [
  { key: 'employees', label: 'Employees' },
  { key: 'spouse', label: 'Spouse' },
  { key: 'child', label: 'Child' },
  { key: 'one_off', label: 'One-off' },
  { key: 'inactive', label: 'Inactive Members' },
];
const EMP_DEP = [
  { key: 'employees', label: 'Employees' },
  { key: 'dependents', label: 'Dependents' },
];
const OUT_IN = [
  { key: 'outbound', label: 'Outbound' },
  { key: 'inbound', label: 'Inbound' },
];
const PRACTICE_MEMBER = [
  { key: 'practice', label: 'Sent By Practice' },
  { key: 'member', label: 'Sent By Member' },
];

/**
 * `span` places the card on the section's six-column grid:
 * full 6 · twoThirds 4 · half 3 · third 2.
 */
export const WIDGETS = [
  // ── Overview ──
  { key: 'active_members', section: 'overview', span: 'half', type: 'stackedBar',
    title: 'Total Active Members', info: 'Members with active coverage at the end of each month, by member type.',
    metric: 'active_members', x: 'month', agg: 'latest', yLabel: 'No. of Members', xLabel: 'Months', series: MEMBER_MIX },
  { key: 'membership_revenue', section: 'overview', span: 'half', type: 'line', format: 'currency',
    title: 'Membership Revenue', info: 'Membership fees collected in each month.',
    metric: 'membership_revenue', x: 'month', agg: 'sum', yLabel: 'Membership Revenue', xLabel: 'Months',
    series: [{ key: 'revenue', label: 'Membership Revenue' }] },
  { key: 'new_memberships', section: 'overview', span: 'third', type: 'stackedBar',
    title: 'New Memberships', info: 'Members who enrolled in each month.',
    metric: 'new_memberships', x: 'month', agg: 'sum', yLabel: 'No. of Members', xLabel: 'Months', series: EMP_DEP },
  { key: 'attrition', section: 'overview', span: 'third', type: 'stackedBar',
    title: 'Attrition', info: 'Members whose coverage ended in each month.',
    metric: 'attrition', x: 'month', agg: 'sum', yLabel: 'No. of Members', xLabel: 'Months', series: EMP_DEP },
  { key: 'reengagement', section: 'overview', span: 'third', type: 'stackedBar',
    title: 'Reengagement of Inactive Members After Fold Automations',
    info: 'Inactive members who re-engaged after an automated Fold outreach.',
    metric: 'reengagement', x: 'month', agg: 'sum', yLabel: 'No. of Members', xLabel: 'Months', series: EMP_DEP },

  // ── Engagement ──
  { key: 'engaged_for_care', section: 'engagement', span: 'half', type: 'stackedBar',
    title: 'Engaged for Care', info: 'Members who had a care interaction in each month, with the monthly average.',
    metric: 'engaged_for_care', x: 'month', agg: 'sum', yLabel: 'No. of Members', xLabel: 'Months',
    series: [
      { key: 'employee', label: 'Employee' },
      { key: 'dependent', label: 'Dependent' },
      { key: 'spouse', label: 'Spouse' },
      { key: 'child', label: 'Child' },
      { key: 'not_engaged', label: 'Not engaged' },
    ],
    // Computed, not stored: the mean across the engaged member types in each
    // period, so it can't drift from the bars it sits on.
    line: { key: 'average', label: 'Average', meanOf: ['employee', 'dependent', 'spouse', 'child'] },
    stats: { metric: 'not_engaged_window', windows: ['3', '6', '12'], label: (w) => `Not engaged in last ${w} months` } },
  { key: 'not_engaged_for_care', section: 'engagement', span: 'half', type: 'stackedBar',
    title: 'Patients Not Engaged for Care', info: 'Members with no care interaction in each month.',
    metric: 'not_engaged_for_care', x: 'month', agg: 'sum', yLabel: 'No. of Members', xLabel: 'Months', series: EMP_DEP },
  { key: 'not_seen', section: 'engagement', span: 'third', type: 'stats',
    title: 'Patients Not Seen', info: 'Share of members without a visit in the window, as of the end of the range.',
    stats: { metric: 'not_seen_window', windows: ['90', '180', '360'], label: (w) => `Not seen in last ${w} days` } },
  { key: 'office_hours', section: 'engagement', span: 'third', type: 'stackedBar',
    title: 'Office-Hours Vs After Hours Engagement', info: 'Engagements inside and outside office hours.',
    metric: 'office_hours', x: 'month', agg: 'sum', yLabel: 'Total no. of engagement', xLabel: 'Months',
    series: [{ key: 'office', label: 'During Office Hours' }, { key: 'after', label: 'After Hours' }] },
  { key: 'engagement_stratification', section: 'engagement', span: 'third', type: 'line',
    title: 'Member Engagement Stratification', info: 'Engagements by channel in each month.',
    metric: 'engagement_stratification', x: 'month', agg: 'sum', yLabel: 'No. of engagement', xLabel: 'Months',
    series: [{ key: 'voice', label: 'Voice Calls' }, { key: 'messages', label: 'Messages' }] },
  { key: 'app_logins', section: 'engagement', span: 'half', type: 'stackedBar',
    title: 'Members Who Logged into App', info: 'Members who logged into the member app in each month.',
    metric: 'app_logins', x: 'month', agg: 'sum', yLabel: 'No. of Members', xLabel: 'Months',
    series: [{ key: 'employee', label: 'Employee' }] },
  // bucket: the survey's name. Series per month: sent, responded, score_sum
  // (so the average score is score_sum ÷ responded).
  { key: 'satisfaction', section: 'engagement', span: 'half', type: 'satisfaction',
    title: 'Member Satisfaction', info: 'Response rate and average score for a member survey.',
    metric: 'satisfaction', yLabel: '% of Responses', xLabel: 'Months' },

  // ── Communication ──
  { key: 'calls', section: 'communication', span: 'third', type: 'stackedBar',
    title: 'Telephone Calls (Inbound/Outbound)', info: 'Phone calls with members in each month.',
    metric: 'calls', x: 'month', agg: 'sum', yLabel: 'No. of Calls', xLabel: 'Months', series: OUT_IN },
  { key: 'video', section: 'communication', span: 'third', type: 'stackedBar',
    title: 'Video Communication', info: 'Video sessions with members in each month.',
    metric: 'video', x: 'month', agg: 'sum', yLabel: 'No. of Sessions', xLabel: 'Months', series: OUT_IN },
  { key: 'app_chats', section: 'communication', span: 'third', type: 'stackedBar',
    title: 'Member App Chats', info: 'In-app chat messages in each month.',
    metric: 'app_chats', x: 'month', agg: 'sum', yLabel: 'No. of App Chats', xLabel: 'Months', series: PRACTICE_MEMBER },
  { key: 'sms', section: 'communication', span: 'half', type: 'stackedBar',
    title: 'SMS', info: 'Text messages in each month.',
    metric: 'sms', x: 'month', agg: 'sum', yLabel: 'No. of SMS', xLabel: 'Months', series: PRACTICE_MEMBER },
  { key: 'calls_by_weekday', section: 'communication', span: 'half', type: 'stackedBar',
    title: 'Telephone Calls by Days of The Week', info: 'Phone calls over the range, by day of the week.',
    metric: 'calls_by_weekday', x: 'weekday', agg: 'sum', yLabel: 'No. of Calls', xLabel: 'Days of The Week', series: OUT_IN },
  { key: 'calls_by_hour', section: 'communication', span: 'full', type: 'stackedBar',
    title: 'Telephone Calls By Time of Day', info: 'Phone calls over the range, by hour of the day.',
    metric: 'calls_by_hour', x: 'hour', agg: 'sum', yLabel: 'No. of Calls', xLabel: 'Time of Day', series: OUT_IN },

  // ── Clinical Visits ──
  { key: 'visits_by_member_type', section: 'clinicalVisits', span: 'third', type: 'stackedBar',
    title: 'Visits by Member Type', info: 'Visits in each month, by member type.',
    metric: 'visits_by_member_type', x: 'month', agg: 'sum', yLabel: 'No. of Visits', xLabel: 'Months', series: EMP_DEP },
  { key: 'visits_modality', section: 'clinicalVisits', span: 'third', type: 'stackedBar',
    title: 'Visits: In Person Vs. Video', info: 'Visits in each month, in person and by video.',
    metric: 'visits_modality', x: 'month', agg: 'sum', yLabel: 'No. of Visits', xLabel: 'Months',
    series: [{ key: 'in_person', label: 'In-person' }, { key: 'video', label: 'Video' }] },
  { key: 'visits_by_appointment', section: 'clinicalVisits', span: 'third', type: 'hbar',
    title: 'Visits by Appointment Types', info: 'Visits over the range, by appointment type.',
    metric: 'visits_by_appointment', x: 'bucket', agg: 'sum', yLabel: 'Visit Type', xLabel: 'No. of Visits',
    series: [{ key: 'visits', label: 'Visits' }] },
  { key: 'visits_by_weekday', section: 'clinicalVisits', span: 'third', type: 'stackedBar',
    title: 'Visits by Day of the Week', info: 'Visits over the range, by day of the week.',
    metric: 'visits_by_weekday', x: 'weekday', agg: 'sum', yLabel: 'No. of Visits', xLabel: 'Days of The Week', series: EMP_DEP },
  { key: 'visits_by_hour', section: 'clinicalVisits', span: 'twoThirds', type: 'stackedBar',
    title: 'Visits By Time of Day', info: 'Visits over the range, by hour of the day.',
    metric: 'visits_by_hour', x: 'hour', agg: 'sum', yLabel: 'No. of Visits', xLabel: 'Time of Day', series: EMP_DEP },
  // Series stored per month: total_minutes, visits, max, min. The average is
  // total_minutes ÷ visits across the range, not an average of averages.
  // (Not "minutes": the rollup treats any series starting min… as a minimum.)
  { key: 'visit_duration', section: 'clinicalVisits', span: 'half', type: 'duration',
    title: 'Duration of Visits', info: 'In-person visit length over the range, in minutes.',
    metric: 'visit_duration', xLabel: 'Duration (in minutes)', series: [{ key: 'in_person', label: 'In-Person' }] },
  { key: 'self_scheduled', section: 'clinicalVisits', span: 'half', type: 'stackedBar',
    title: 'Self-Scheduled Appointments', info: 'Appointments members booked themselves, in each month.',
    metric: 'self_scheduled', x: 'month', agg: 'sum', yLabel: 'No. of Appointments', xLabel: 'Months', series: EMP_DEP },

  // ── Clinical Trends ── (top five over the range)
  { key: 'top_medications', section: 'clinicalTrends', span: 'half', type: 'hbar', top: 5,
    title: 'Top Prescribed Medication', info: 'Most-prescribed medications over the range.',
    metric: 'top_medications', x: 'bucket', agg: 'sum', yLabel: 'Medication', xLabel: 'No. of Orders',
    series: [{ key: 'orders', label: 'Medication' }] },
  { key: 'top_imaging', section: 'clinicalTrends', span: 'half', type: 'hbar', top: 5,
    title: 'Top Imaging Orders', info: 'Most-ordered imaging studies over the range.',
    metric: 'top_imaging', x: 'bucket', agg: 'sum', yLabel: 'Imaging Orders', xLabel: 'No. of Orders',
    series: [{ key: 'orders', label: 'Imaging Orders' }] },
  { key: 'top_labs', section: 'clinicalTrends', span: 'half', type: 'hbar', top: 5,
    title: 'Top Lab Orders', info: 'Most-ordered lab tests over the range.',
    metric: 'top_labs', x: 'bucket', agg: 'sum', yLabel: 'Lab Orders', xLabel: 'No. of Orders',
    series: [{ key: 'orders', label: 'Lab Orders' }] },
  { key: 'top_diagnoses', section: 'clinicalTrends', span: 'half', type: 'hbar', top: 5,
    title: 'Top Diagnoses from Visits', info: 'Most frequent visit diagnoses over the range.',
    metric: 'top_diagnoses', x: 'bucket', agg: 'sum', yLabel: 'Diagnosis', xLabel: 'No. of Visits For These Diagnosis',
    series: [{ key: 'visits', label: 'Diagnoses' }] },

  // ── Demographics ── (members as of the end of the range)
  { key: 'age', section: 'demographics', span: 'half', type: 'donut',
    title: 'Age', info: 'Active members by age band, at the end of the range.',
    metric: 'age', x: 'bucket', agg: 'latest', buckets: ['16 - 30', '31 - 50', '> 51'], series: [{ key: 'members', label: 'Members' }] },
  { key: 'gender', section: 'demographics', span: 'half', type: 'donut',
    title: 'Gender', info: 'Active members by gender, at the end of the range.',
    metric: 'gender', x: 'bucket', agg: 'latest', buckets: ['Female', 'Male', 'Others'], series: [{ key: 'members', label: 'Members' }] },
  { key: 'top_conditions', section: 'demographics', span: 'half', type: 'hbar', top: 5,
    title: 'Top Medical Conditions', info: 'Most common conditions among active members, at the end of the range.',
    metric: 'top_conditions', x: 'bucket', agg: 'latest', yLabel: 'Conditions', xLabel: 'No. of Members',
    series: [{ key: 'members', label: 'Conditions' }] },
  { key: 'top_chronic', section: 'demographics', span: 'half', type: 'hbar', top: 5,
    title: 'Top Chronic Medical Conditions', info: 'Most common chronic conditions among active members, at the end of the range.',
    metric: 'top_chronic', x: 'bucket', agg: 'latest', yLabel: 'Chronic Conditions', xLabel: 'No. of Members',
    series: [{ key: 'members', label: 'Chronic Conditions' }] },
];

// Cost savings cards: traditional vs. our cost for each category, summed
// over the range. Savings is computed, never stored.
export const SAVINGS_CATEGORIES = [
  { key: 'visit', title: 'Visit Savings', info: 'What visits would have cost at traditional rates, against what they cost here.' },
  { key: 'lab', title: 'Lab Savings', info: 'Lab work at traditional rates against our cost.' },
  { key: 'imaging', title: 'Imaging Savings', info: 'Imaging at traditional rates against our cost.' },
  { key: 'procedure', title: 'Procedure Savings', info: 'Procedures at traditional rates against our cost.' },
  { key: 'medication', title: 'Medication Savings', info: 'Medications at traditional rates against our cost.' },
  { key: 'avoidable_visit', title: 'Avoidable Visit Savings', info: 'ED and urgent-care visits avoided, at traditional rates, against our cost of care.' },
];
export const SAVINGS_METRIC = 'cost_savings'; // series: 'traditional' | 'ours'; bucket: category key

export const TIME_FRAMES = ['Month', 'Quarter', 'Year'];

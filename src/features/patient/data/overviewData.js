// Patient Overview: seed + row mappers for the overview-only data
// (Unity synopsis, health chart scores, highlights, suggested actions,
// vitals and gaps). One patient_overview row per member id, same shape as
// patient_monitoring. Everything else on the Overview (care programs, care
// plan, tasks, notes, appointments) reads its own existing table.
//
// The local seed only covers Annette Brave. Her chart is member 11089.
// The CCM and HCC worklist mocks identify that same demo patient as
// `#837261495203` and `M-6479-2697`. The overview lookup is by member id,
// so those screens stay empty unless the seed is keyed that way too.
// Other patients render each card's empty state until they have a row.

const ANNETTE_OVERVIEW = {
    memberId: '11089',
    synopsis: 'Annette is a 56-year-old woman with Type 2 Diabetes and Hypertension, both above target. HbA1c rose to 8.2% (goal under 7.0%) and blood pressure is 142/88 mmHg. She is enrolled in CCM and TCM following an ER visit for chest pain on 03/02/2025.',
    synopsisEmphasis: ['8.2%', '142/88 mmHg', 'CCM', 'TCM'],
    takeaways: [
      { tone: 'error', text: 'Glycemic control worsening: HbA1c 7.6% → 8.2% in 6 months' },
      { tone: 'warning', text: '2 missed PHQ-9 screenings; care plan adherence at 70%' },
      { tone: 'success', text: 'Lipid panel and BMP ordered; results pending' },
    ],
    sourcesCount: 14,
    generatedAt: '2025-05-10T09:42:00Z',
    healthScores: [
      { axis: 'Cardiometabolic', patient: 2.5, clinic: 2.7 },
      { axis: 'Cancer Risk', patient: 2.7, clinic: 2.3 },
      { axis: 'Immune Health', patient: 2.3, clinic: 2.5 },
      { axis: 'Performance', patient: 2.9, clinic: 2.2 },
      { axis: 'Gut Health', patient: 2.4, clinic: 2.8 },
      { axis: 'Neurocognitive', patient: 2.6, clinic: 2.6 },
      { axis: 'Musculoskeletal', patient: 2.8, clinic: 2.4 },
    ],
    healthScoreChange: 0.2,
    healthScoreSince: 'Jan',
    highlights: [
      { id: 'hl1', kind: 'encounter', title: 'ER visit: chest pain', date: '03/02/2025', source: 'Mercy General' },
      { id: 'hl2', kind: 'lab', title: 'HbA1c 8.2%, up from 7.6%', date: '12/31/2024', source: 'Quest Diagnostics' },
      { id: 'hl3', kind: 'medication', title: 'Metformin refill requested', date: '12/14/2024', source: 'CVS Pharmacy' },
      { id: 'hl4', kind: 'risk', title: 'Fall risk flagged in HRA', date: '11/17/2024', source: 'Moderate risk (22)' },
    ],
    suggestedActions: [
      { id: 'sa1', title: 'Order repeat HbA1c and lipid panel', reason: 'HbA1c 8.2% is above goal; last drawn 12/31/2024', cta: 'Order Lab', action: 'order-lab', status: 'open' },
      { id: 'sa2', title: 'Schedule Annual Wellness Visit with PCP', reason: 'AWV not completed in 2025; closes 2 open care gaps', cta: 'Schedule', action: 'schedule', status: 'open' },
      { id: 'sa3', title: 'Re-send PHQ-9 screening', reason: '2 screenings missed in the last 30 days', cta: 'Send Form', action: 'send-form', status: 'open' },
      { id: 'sa4', title: 'Review Metformin refill and adherence', reason: 'Refill request pending since 12/14/2024', cta: 'Review', action: 'review', status: 'open' },
    ],
    vitals: [
      { key: 'bp', label: 'Blood Pressure', value: '142/88', unit: 'mmHg', change: '3.5%', direction: 'up', tone: 'error', goalFrom: '140/90', goalTo: '120/80', sourceIcon: 'solar:stethoscope-linear', measuredAt: '05/08/2025', series: [128, 131, 129, 134, 132, 138, 142], diastolicSeries: [82, 84, 83, 86, 85, 87, 88] },
      { key: 'a1c', label: 'HbA1c', value: '8.2', unit: '%', change: '0.6', direction: 'up', tone: 'error', goalFrom: '8%', goalTo: '7%', sourceIcon: 'solar:test-tube-linear', measuredAt: '12/31/2024', series: [7.4, 7.5, 7.5, 7.6, 7.8, 8.0, 8.2] },
      { key: 'glucose', label: 'Blood Glucose', value: '165', unit: 'mg/dL', change: '3%', direction: 'down', tone: 'success', goalFrom: '180 mg/dL', goalTo: '140 mg/dL', sourceIcon: 'solar:test-tube-linear', measuredAt: '05/09/2025', series: [182, 178, 185, 174, 170, 168, 165] },
      { key: 'bmi', label: 'BMI', value: '29.0', unit: 'kg/m²', change: '0.4', direction: 'up', tone: 'warning', goalFrom: '29', goalTo: '25', sourceIcon: 'solar:scale-linear', measuredAt: '05/01/2025', series: [28.6, 28.6, 28.7, 28.7, 28.8, 28.9, 29.0] },
    ],
    vitalsSource: 'Synced from home BP cuff',
    gaps: [
      { id: 'g1', category: 'quality', code: 'EED', title: 'Diabetic eye exam', detail: 'Due 12/31/2025 • HEDIS 2025', status: 'Open', tone: 'error', cta: 'Create Task' },
      { id: 'g2', category: 'quality', code: 'HBD', title: 'HbA1c control (<8%)', detail: 'Last result 8.2% on 12/31/2024', status: 'At risk', tone: 'warning', cta: 'Order Lab' },
      { id: 'g3', category: 'quality', code: 'CBP', title: 'Controlling high blood pressure', detail: 'Last reading 142/88 mmHg on 05/08/2025', status: 'Open', tone: 'error', cta: 'Log Reading' },
      { id: 'g4', category: 'hcc', code: 'HCC 37', title: 'Diabetes with chronic complications (E11.65)', detail: 'Suspected • not documented this year', status: 'Open', tone: 'error', cta: 'Review' },
      { id: 'g5', category: 'hcc', code: 'HCC 48', title: 'Morbid obesity (E66.01)', detail: 'Recapture due • last coded 2024', status: 'Open', tone: 'warning', cta: 'Review' },
    ],
};

const ANNETTE_MEMBER_IDS = ['11089', '#837261495203', 'M-6479-2697'];

export const OVERVIEW_SEED = Object.fromEntries(
  ANNETTE_MEMBER_IDS.map(memberId => [memberId, { ...ANNETTE_OVERVIEW, memberId }]),
);

// Supabase row (snake_case) → app object. Used by the store's fetch.
export function mapOverviewRow(row) {
  return {
    memberId: row.member_id,
    synopsis: row.synopsis || '',
    synopsisEmphasis: row.synopsis_emphasis || [],
    takeaways: row.takeaways || [],
    sourcesCount: row.sources_count ?? null,
    generatedAt: row.generated_at || null,
    healthScores: row.health_scores || [],
    healthScoreChange: row.health_score_change ?? null,
    healthScoreSince: row.health_score_since || '',
    highlights: row.highlights || [],
    suggestedActions: row.suggested_actions || [],
    vitals: row.vitals || [],
    vitalsSource: row.vitals_source || '',
    gaps: row.gaps || [],
  };
}

// App object → Supabase row. Used by scripts/seed.js.
export function overviewToRow(o) {
  return {
    member_id: o.memberId,
    synopsis: o.synopsis ?? null,
    synopsis_emphasis: o.synopsisEmphasis ?? [],
    takeaways: o.takeaways ?? [],
    sources_count: o.sourcesCount ?? null,
    generated_at: o.generatedAt ?? null,
    health_scores: o.healthScores ?? [],
    health_score_change: o.healthScoreChange ?? null,
    health_score_since: o.healthScoreSince ?? null,
    highlights: o.highlights ?? [],
    suggested_actions: o.suggestedActions ?? [],
    vitals: o.vitals ?? [],
    vitals_source: o.vitalsSource ?? null,
    gaps: o.gaps ?? [],
  };
}

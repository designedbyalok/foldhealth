// Today: Next Best Action feed.
//
// The rows are real patients from the database (all_patients); this file only
// carries the *clinical scenario overlay* for the demo feed, the reason a
// patient is surfaced and the suggested next action. TodayView binds each
// scenario to a real all_patients record (name, age, id, PCP, payer) at render
// time, so every row opens that patient's real P360 profile on click.
//
// `reason` may contain a `{first}` token, replaced with the bound patient's
// first name. Reasons avoid gendered pronouns since the bound patient's gender
// is whatever the database says.

// Panel-level rollups for the header strip + Panel Pulse cards. These describe a
// care manager's whole panel, not the visible feed slice, so they are demo
// constants (the same way the prototype shows panel totals above a top-N list).
export const PANEL_TODAY = {
  touchesDone: 9,
  touchesPlanned: 24,
  minutesTotal: 104,
  minutesByProgram: [['CCM', 64], ['TCM', 18], ['BHI', 22]],
  atThreshold: 3,
  overdue: 1,
  pulse: {
    overdue: { count: 1, caption: 'TCM contact deadlines' },
    'due-today': { count: 10, caption: 'scheduled + rule-fired' },
    escalated: { count: 2, caption: 'Tara needs a human' },
    threshold: { count: 6, caption: 'CCM minutes · 10 days left' },
  },
  adherence: { total: 120, onTrack: 22, slipping: 48, offPlan: 50 },
};

// urgency drives the row's left accent + which Panel Pulse bucket it counts
// toward: overdue · escalated · threshold · due-today · rising · followup.
// `fallback*` identity is only used if the patient database has not loaded.
export const NBA_ITEMS = [
  {
    id: 'nba-1',
    programs: ['TCM', 'CCM'], riskTier: 'High',
    urgency: 'overdue', reasonIcon: 'solar:danger-triangle-linear',
    reason: 'Tara reached {first} 10:20 AM post-discharge (Mercy General 8/21 6:40 AM, CHF). Confused about the furosemide→torsemide switch. RN med rec needed by 5:00 PM.',
    suggestedAction: "Take over: Tara's transcript and the discharge diff are ready",
    isAgent: true, agentName: 'Tara', agentStatus: 'reached 10:20 AM, escalated', rank: 1,
    fallbackName: 'James Whitfield', fallbackAge: 72, fallbackPayer: 'Aetna MA', fallbackProvider: 'Dr. L. Chen',
  },
  {
    id: 'nba-2',
    programs: ['CCM', 'DM'], riskTier: 'High',
    urgency: 'threshold', reasonIcon: 'solar:hourglass-linear',
    reason: "6 min from 20-min CCM threshold · 10 days left in August · discharged St. Luke's 8/19, follow-up promised",
    suggestedAction: 'Call: CHF goal check-in due, interpreter not needed (bilingual daughter)',
    isAgent: false, agentName: null, agentStatus: null, rank: 2,
    fallbackName: 'Maria Delgado', fallbackAge: 67, fallbackPayer: 'Humana MA', fallbackProvider: 'Dr. A. Patel',
  },
  {
    id: 'nba-3',
    programs: ['BHI'], riskTier: 'Rising',
    urgency: 'escalated', reasonIcon: 'solar:graph-up-linear',
    reason: 'PHQ-9 up 1 to 15 after two improving weeks · week 9 of treatment · consultant review flagged',
    suggestedAction: 'Review with Dr. Feld, then schedule check-in',
    isAgent: false, agentName: null, agentStatus: null, rank: 3,
    fallbackName: 'Denise Carter', fallbackAge: 54, fallbackPayer: 'BCBS Commercial', fallbackProvider: 'Dr. R. Osei',
  },
  {
    id: 'nba-4',
    programs: ['CCM', 'BHI'], riskTier: 'High',
    urgency: 'due-today', reasonIcon: 'solar:routing-linear',
    reason: 'Cardiology follow-up unscheduled for 12 days · transportation barrier unresolved',
    suggestedAction: 'Arrange NEMT ride, then schedule cardiology',
    isAgent: true, agentName: 'Tara', agentStatus: 'ride confirmed, needs schedule', rank: 4,
    fallbackName: 'Gloria Simmons', fallbackAge: 78, fallbackPayer: 'UHC Dual SNP', fallbackProvider: 'Dr. A. Patel',
  },
  {
    id: 'nba-5',
    programs: ['CCM', 'DM'], riskTier: 'Rising',
    urgency: 'rising', reasonIcon: 'solar:graph-up-linear',
    reason: 'Home SpO2 89% reported Tuesday · COPD action plan review due',
    suggestedAction: 'Call: symptom check + inhaler technique review',
    isAgent: false, agentName: null, agentStatus: null, rank: 5,
    fallbackName: 'Earl Robinson', fallbackAge: 81, fallbackPayer: 'Humana MA', fallbackProvider: 'Dr. L. Chen',
  },
  {
    id: 'nba-6',
    programs: ['CCM', 'DM'], riskTier: 'Moderate',
    urgency: 'followup', reasonIcon: 'solar:phone-calling-linear',
    reason: 'No answer yesterday 2:10 PM · best-reach window (2 to 4 PM) open now',
    suggestedAction: 'Retry call: CKD lab results to review',
    isAgent: false, agentName: null, agentStatus: null, rank: 6,
    fallbackName: 'Ruth Delacroix', fallbackAge: 83, fallbackPayer: 'Original Medicare', fallbackProvider: 'Dr. R. Osei',
  },
  {
    id: 'nba-7',
    programs: ['CCM'], riskTier: 'Moderate',
    urgency: 'threshold', reasonIcon: 'solar:hourglass-linear',
    reason: '2 min from 20-min CCM threshold · interpreter line pre-booked 3:30 PM',
    suggestedAction: 'Quick check-in closes the month',
    isAgent: false, agentName: null, agentStatus: null, rank: 7,
    fallbackName: 'Lucille Tran', fallbackAge: 74, fallbackPayer: 'Humana MA', fallbackProvider: 'Dr. A. Patel',
  },
  {
    id: 'nba-8',
    programs: ['AWV'], riskTier: 'Moderate',
    urgency: 'followup', reasonIcon: 'solar:document-text-linear',
    reason: 'AWV 14 months overdue · 3 open gaps: colonoscopy, A1c, statin therapy',
    suggestedAction: 'Schedule AWV: HRA link ready to send',
    isAgent: false, agentName: null, agentStatus: null, rank: 8,
    fallbackName: 'Robert Nguyen', fallbackAge: 69, fallbackPayer: 'Aetna MA', fallbackProvider: 'Dr. L. Chen',
  },
  {
    id: 'nba-9',
    programs: ['CCM', 'DM'], riskTier: 'High',
    urgency: 'threshold', reasonIcon: 'solar:hourglass-linear',
    reason: 'CHF weight up 4 lbs in 3 days · 9 min from CCM threshold · no touch in 21 days',
    suggestedAction: 'Call: symptom check + daily weight review',
    isAgent: false, agentName: null, agentStatus: null, rank: 9,
    fallbackName: 'Harold Briggs', fallbackAge: 79, fallbackPayer: 'Wellcare MA', fallbackProvider: 'Dr. L. Chen',
  },
  {
    id: 'nba-10',
    programs: ['CCM', 'AWV'], riskTier: 'Rising',
    urgency: 'due-today', reasonIcon: 'solar:document-text-linear',
    reason: 'AWV due this month · 6 min from CCM threshold · combine in one visit',
    suggestedAction: 'Schedule combined CCM + AWV call',
    isAgent: false, agentName: null, agentStatus: null, rank: 10,
    fallbackName: 'Teresa Morales', fallbackAge: 70, fallbackPayer: 'Humana MA', fallbackProvider: 'Dr. A. Patel',
  },
];

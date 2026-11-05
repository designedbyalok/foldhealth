// Billing month = previous calendar month from today (May 24, 2026 → April 2026)
export const BILLING_MONTH = 'April 2026';
export const DATE_OF_SERVICE = '04/30/2026'; // Last day of billing month

// 36-month lookback cutoff = April 2023
// lastEncounterDate before 04/01/2023 → triggers "No Visit in Last 36 Months"

// CPT rules: from prod spec:
//   <2 chronic (any QMB)      → G0556  ($15)
//   2+ chronic, non-QMB       → G0557  ($50)
//   2+ chronic, QMB (dual)    → G0558  ($110)
export function getCptCode(isQmb, chronicCount) {
  if (chronicCount < 2) return 'G0556';
  return isQmb ? 'G0558' : 'G0557';
}

export const CPT_FEES = { G0556: 15, G0557: 50, G0558: 110 };

// Per-ICD problem status:
//   'chronic', confirmed chronic, counts toward CPT calc
//   'acute', documented but not (yet) marked chronic; user may mark chronic
//   'resolved', historical, treated & closed; not surfaced or billable
// Surfacing rule: a patient is surfaced only when at least one ICD has
// status !== 'resolved' AND icdCodes.length > 0. Otherwise Fold hides them
// entirely from the worklist (no attestation possible).
export function surfacesForAttestation(patient) {
  const nonResolved = (patient.icdCodes || []).filter(c => c.status !== 'resolved');
  return nonResolved.length > 0;
}

// Count how many ICDs a patient has as chronic (used for live CPT calc).
// Accepts an optional override map { [icdCode]: 'chronic' } so the UI can
// preview the effect of user marking without mutating the source data.
export function countChronic(patient, overrides = {}) {
  return (patient.icdCodes || []).filter(c => {
    const st = overrides[c.code] || c.status;
    return st === 'chronic';
  }).length;
}

export const APCM_PATIENTS = [
  // ── Eligible tab ──────────────────────────────────────────────────────────

  {
    id: 'ap1',
    name: 'Eleanor Ramirez',
    memberId: '18414',
    language: 'en',
    ehrId: '1234567',
    billingMonth: BILLING_MONTH,
    dateOfService: DATE_OF_SERVICE,
    isQmb: true,
    chronicConditionCount: 3,
    cptCode: 'G0558',
    icdCodes: [
      { code: 'I10',   description: 'Essential (primary) hypertension' },
      { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications' },
      { code: 'J44.1', description: 'COPD with acute exacerbation' },
    ],
    lastEncounterDate: '05/13/2022', // 47 months ago, outside 36-month window
    reasons: [
      'No Visit in Last 36 Months: Patient has no qualifying visit in the past 36 months, which is required to bill APCM services.',
      'Chronic Condition Not Selected: 3 conditions are currently selected but the chart may contain additional active chronic conditions not yet marked. Review and select all qualifying conditions before attesting.',
    ],
    renderingProvider: 'Dr. Sarah Chen',
    renderingProviderInitials: 'SC',
    comment: '',
    tab: 'eligible',
    billingStatus: 'pending',
    programId: 'PROG-001',
  },

  {
    id: 'ap2',
    name: 'Marcus Thompson',
    memberId: '18415',
    language: 'en',
    ehrId: '2345678',
    billingMonth: BILLING_MONTH,
    dateOfService: DATE_OF_SERVICE,
    isQmb: false,
    chronicConditionCount: 1,
    cptCode: 'G0556',
    icdCodes: [
      { code: 'I25.10', description: 'Atherosclerotic heart disease of native coronary artery' },
    ],
    lastEncounterDate: '12/04/2024', // 16 months ago, within window
    reasons: [
      'Chronic Condition Not Selected: Only I25.10 (Atherosclerotic heart disease) is marked as chronic. The chart may contain additional qualifying conditions, selecting them could change this patient\'s CPT code.',
    ],
    renderingProvider: 'Dr. Kevin Patel',
    renderingProviderInitials: 'KP',
    comment: '',
    tab: 'eligible',
    billingStatus: 'pending',
    programId: 'PROG-001',
  },

  {
    id: 'ap3',
    name: 'Lisa Chang',
    memberId: '18416',
    language: 'zh',
    ehrId: '3456789',
    billingMonth: BILLING_MONTH,
    dateOfService: DATE_OF_SERVICE,
    isQmb: true,
    chronicConditionCount: 1,
    cptCode: 'G0557',
    icdCodes: [
      { code: 'N18.3', description: 'Chronic kidney disease, stage 3 (moderate)' },
      { code: 'E78.5', description: 'Hyperlipidemia, unspecified' },
    ],
    lastEncounterDate: '04/02/2026', // 1 month ago, within window
    reasons: [
      'Chronic Condition Not Selected: Only 1 chronic condition is selected. E78.5 (Hyperlipidemia) is present in the chart, confirm whether it qualifies as chronic and select it to update the CPT code.',
      'Diagnosis Not Charted in Last 36 Months: E78.5 (Hyperlipidemia, unspecified) appears in claims history but may not have been explicitly documented on a qualifying visit note within the 36-month window.',
    ],
    renderingProvider: 'Dr. Sarah Chen',
    renderingProviderInitials: 'SC',
    comment: '',
    tab: 'eligible',
    billingStatus: 'pending',
    programId: 'PROG-002',
  },

  {
    id: 'ap4',
    name: 'David Okafor',
    memberId: '18417',
    language: 'en',
    ehrId: '4567890',
    billingMonth: BILLING_MONTH,
    dateOfService: DATE_OF_SERVICE,
    isQmb: false,
    chronicConditionCount: 2,
    cptCode: 'G0556',
    icdCodes: [
      { code: 'I50.9', description: 'Heart failure, unspecified' },
      { code: 'I10',   description: 'Essential (primary) hypertension' },
    ],
    lastEncounterDate: '11/08/2022', // 41 months ago, outside 36-month window
    reasons: [
      'No Visit in Last 36 Months: Patient has no qualifying visit in the past 36 months, which is required to bill APCM services.',
      'Diagnosis Not Charted in Last 36 Months: Heart failure (I50.9) cannot be confirmed as charted without a qualifying visit within the required 36-month window.',
      'Chronic Condition Not Selected: I50.9 (Heart failure) may not have been marked as chronic during enrollment. Verify the chronic condition flag is set correctly in Athena before attesting.',
    ],
    renderingProvider: 'Dr. Kevin Patel',
    renderingProviderInitials: 'KP',
    comment: '',
    tab: 'eligible',
    billingStatus: 'pending',
    programId: 'PROG-002',
  },

  {
    id: 'ap9',
    name: 'Sandra Nguyen',
    memberId: '10016',
    language: 'vi',
    ehrId: '9012345',
    billingMonth: BILLING_MONTH,
    dateOfService: DATE_OF_SERVICE,
    isQmb: true,
    chronicConditionCount: 2,
    cptCode: 'G0558',
    icdCodes: [
      { code: 'E11.65', description: 'Type 2 diabetes mellitus with hyperglycemia' },
      { code: 'I11.9',  description: 'Hypertensive heart disease without heart failure' },
    ],
    lastEncounterDate: '07/14/2025', // 9 months ago, within window
    reasons: [
      'Chronic Condition Not Selected: 2 conditions are selected for APCM billing. Review Athena for additional chronic diagnoses not yet flagged, selecting them may affect the CPT code assignment.',
    ],
    renderingProvider: 'Dr. Anita Rao',
    renderingProviderInitials: 'AR',
    comment: '',
    tab: 'eligible',
    billingStatus: 'pending',
    programId: 'PROG-001',
  },

  {
    id: 'ap10',
    name: 'Bernard Walsh',
    memberId: '18418',
    language: 'en',
    ehrId: '9123456',
    billingMonth: BILLING_MONTH,
    dateOfService: DATE_OF_SERVICE,
    isQmb: true,
    chronicConditionCount: 1,
    cptCode: 'G0557',
    icdCodes: [
      { code: 'C61', description: 'Malignant neoplasm of prostate' },
    ],
    lastEncounterDate: '07/20/2021', // 57 months ago, outside 36-month window
    reasons: [
      'No Visit in Last 36 Months: Patient has no qualifying visit in the past 36 months, which is required to bill APCM services.',
      'Chronic Condition Not Selected: Only C61 (Malignant neoplasm of prostate) is marked as chronic. Check the chart for additional qualifying conditions, selecting them would change the CPT code.',
      'Diagnosis Not Charted in Last 36 Months: C61 cannot be confirmed as charted without a qualifying visit within the required 36-month window.',
    ],
    renderingProvider: 'Dr. Kevin Patel',
    renderingProviderInitials: 'KP',
    comment: '',
    tab: 'eligible',
    billingStatus: 'pending',
    programId: 'PROG-003',
  },

  {
    id: 'ap11',
    name: 'Fatima Al-Hassan',
    memberId: '18419',
    language: 'ar',
    ehrId: '9234567',
    billingMonth: BILLING_MONTH,
    dateOfService: DATE_OF_SERVICE,
    isQmb: false,
    chronicConditionCount: 3,
    cptCode: 'G0556',
    icdCodes: [
      { code: 'M05.79', description: 'Rheumatoid arthritis with rheumatoid factor, multiple sites', documentedInLast36Months: true },
      { code: 'M06.09', description: 'Rheumatoid arthritis without rheumatoid factor, multiple sites', documentedInLast36Months: false },
      { code: 'M06.9',  description: 'Rheumatoid arthritis, unspecified', documentedInLast36Months: false },
      { code: 'E03.9',  description: 'Hypothyroidism, unspecified', documentedInLast36Months: true },
      { code: 'I10',    description: 'Essential (primary) hypertension', documentedInLast36Months: true },
    ],
    lastEncounterDate: '02/22/2025', // 14 months ago, within window
    reasons: [
      'Ambiguous ICD-10 from EMR Mapping: Athena\'s SNOMED round-trip returned three rheumatoid arthritis codes with near-identical descriptions: M05.79 (with rheumatoid factor), M06.09 (without rheumatoid factor), and M06.9 (unspecified). Only the variant documented on a qualifying visit (M05.79) is shown above.',
      'Chronic Condition Not Selected: Hypothyroidism (E03.9) and hypertension (I10) are confirmed chronic, but the rheumatoid arthritis code above is unresolved. Resolve the RA mapping and verify all qualifying conditions are flagged before attesting.',
    ],
    renderingProvider: 'Dr. Sarah Chen',
    renderingProviderInitials: 'SC',
    comment: '',
    tab: 'eligible',
    billingStatus: 'pending',
    programId: 'PROG-002',
  },

  {
    id: 'ap12',
    name: 'George Tanaka',
    memberId: '18420',
    language: 'en',
    ehrId: '9345678',
    billingMonth: BILLING_MONTH,
    dateOfService: DATE_OF_SERVICE,
    isQmb: true,
    chronicConditionCount: 4,
    cptCode: 'G0558',
    icdCodes: [
      { code: 'I48.0',  description: 'Paroxysmal atrial fibrillation' },
      { code: 'I10',    description: 'Essential (primary) hypertension' },
      { code: 'E11.9',  description: 'Type 2 diabetes mellitus without complications' },
      { code: 'N18.4',  description: 'Chronic kidney disease, stage 4 (severe)' },
    ],
    lastEncounterDate: '11/03/2025', // 5 months ago, within window
    reasons: [
      'Chronic Condition Not Selected: 4 conditions are currently selected. Athena may contain additional qualifying chronic diagnoses not yet marked for billing. A chart review before attesting is recommended.',
      'Diagnosis Not Charted in Last 36 Months: N18.4 (Chronic kidney disease, stage 4) must be explicitly documented on a qualifying visit note within the 36-month window.',
    ],
    renderingProvider: 'Dr. Anita Rao',
    renderingProviderInitials: 'AR',
    comment: '',
    tab: 'eligible',
    billingStatus: 'pending',
    programId: 'PROG-001',
  },

  {
    id: 'ap13',
    name: 'Cynthia Brooks',
    memberId: '18421',
    language: 'en',
    ehrId: '9456789',
    billingMonth: BILLING_MONTH,
    dateOfService: DATE_OF_SERVICE,
    isQmb: false,
    chronicConditionCount: 1,
    cptCode: 'G0556',
    icdCodes: [
      { code: 'N41.0', description: 'Acute prostatitis', documentedInLast36Months: false },
      { code: 'N41.1', description: 'Chronic prostatitis', documentedInLast36Months: true },
      { code: 'N41.9', description: 'Inflammatory disease of prostate, unspecified', documentedInLast36Months: false },
    ],
    lastEncounterDate: '02/28/2026', // 2 months ago, within window
    reasons: [
      'Ambiguous ICD-10 from EMR Mapping: Athena converts ICD-10 to SNOMED and back, which returned three overlapping prostate codes: N41.0 (acute), N41.1 (chronic), and N41.9 (unspecified). Only the variant documented on a qualifying visit (N41.1) is shown above.',
      'Chronic Condition Not Selected: Only the chronic variant N41.1 (Chronic prostatitis) qualifies for APCM. The chart may currently have the acute (N41.0) or unspecified (N41.9) code flagged, confirm N41.1 is selected as the chronic condition before billing.',
    ],
    renderingProvider: 'Dr. Kevin Patel',
    renderingProviderInitials: 'KP',
    comment: '',
    tab: 'eligible',
    billingStatus: 'pending',
    programId: 'PROG-003',
  },

  // ── New / Changes tab ─────────────────────────────────────────────────────

  {
    id: 'ap5',
    name: 'Maria Garcia',
    memberId: '18422',
    language: 'es',
    ehrId: '5678901',
    billingMonth: BILLING_MONTH,
    dateOfService: DATE_OF_SERVICE,
    isQmb: true,
    chronicConditionCount: 3,
    cptCode: 'G0558',
    // Maria is a Case A example: 1:many ambiguous mapping + chronic-not-selected
    // BUT she has encounter-documented Dx in the last 36 months, so the table
    // hides the un-documented variants (E11.8, E11.65) and only surfaces the
    // codes that were actually charted on a qualifying visit.
    icdCodes: [
      // Documented diabetes candidate: user must mark chronic (or resolve mapping first)
      { code: 'E11.9',  description: 'Type 2 diabetes mellitus without complications', documentedInLast36Months: true, status: 'acute' },
      { code: 'E11.8',  description: 'Type 2 diabetes mellitus with unspecified complications', documentedInLast36Months: false, status: 'acute' },
      { code: 'E11.65', description: 'Type 2 diabetes mellitus with hyperglycemia', documentedInLast36Months: false, status: 'acute' },
      // Reason text confirms these two are chronic, pre-marked.
      { code: 'I10',    description: 'Essential (primary) hypertension', documentedInLast36Months: true, status: 'chronic' },
      { code: 'E78.5',  description: 'Hyperlipidemia, unspecified', documentedInLast36Months: true, status: 'chronic' },
    ],
    lastEncounterDate: '01/14/2025', // 15 months ago, within window
    reasons: [
      'Ambiguous ICD-10 from EMR Mapping: Athena\'s SNOMED round-trip produced three Type 2 diabetes codes with overlapping descriptions: E11.9 (without complications), E11.8 (with unspecified complications), and E11.65 (with hyperglycemia). Only the variant documented on a qualifying visit (E11.9) is shown above.',
      'Chronic Condition Not Selected: Hypertension (I10) and hyperlipidemia (E78.5) are confirmed chronic. Resolve the diabetes mapping above and confirm all qualifying conditions are flagged before attesting.',
    ],
    renderingProvider: 'Dr. Sarah Chen',
    renderingProviderInitials: 'SC',
    comment: '',
    tab: 'new-changes',
    billingStatus: 'pending',
    programId: 'PROG-001',
  },

  {
    id: 'ap6',
    name: 'James Wilson',
    memberId: '11065',
    language: 'en',
    ehrId: '6789012',
    billingMonth: BILLING_MONTH,
    dateOfService: DATE_OF_SERVICE,
    isQmb: false,
    chronicConditionCount: 3,
    cptCode: 'G0556',
    icdCodes: [
      { code: 'J44.0',  description: 'COPD with acute lower respiratory infection', status: 'acute' },
      { code: 'F32.1',  description: 'Major depressive disorder, single episode, moderate', status: 'acute' },
      { code: 'E78.00', description: 'Pure hypercholesterolemia, unspecified', status: 'acute' },
    ],
    lastEncounterDate: '10/05/2022', // 42 months ago, outside 36-month window
    reasons: [
      'No Visit in Last 36 Months: Patient has no qualifying office visit in the past 36 months, which is required to bill APCM services.',
      'Chronic Condition Not Selected: 3 conditions are selected but the chronic condition flag may not be set correctly for all of them. Confirm each is marked as chronic in Athena before attesting.',
    ],
    renderingProvider: 'Dr. Kevin Patel',
    renderingProviderInitials: 'KP',
    comment: '',
    tab: 'new-changes',
    billingStatus: 'pending',
    programId: 'PROG-003',
  },

  {
    id: 'ap7',
    name: 'Priya Patel',
    memberId: '18423',
    language: 'hi',
    ehrId: '7890123',
    billingMonth: BILLING_MONTH,
    dateOfService: DATE_OF_SERVICE,
    isQmb: true,
    chronicConditionCount: 2,
    cptCode: 'G0558',
    icdCodes: [
      { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications', status: 'acute' },
      { code: 'I73.9', description: 'Peripheral vascular disease, unspecified', status: 'acute' },
    ],
    lastEncounterDate: '02/18/2023', // 38 months ago, outside 36-month window
    reasons: [
      'No Visit in Last 36 Months: Patient\'s most recent qualifying visit was over 36 months ago, which is required to bill APCM services.',
      'Diagnosis Not Charted in Last 36 Months: Type 2 diabetes (E11.9) appears in claims history but cannot be confirmed as charted without a qualifying visit within the 36-month window.',
      'Chronic Condition Not Selected: I73.9 (Peripheral vascular disease) was not previously billed as chronic for this patient. Selecting it now may update the CPT code.',
    ],
    renderingProvider: 'Dr. Anita Rao',
    renderingProviderInitials: 'AR',
    comment: '',
    tab: 'new-changes',
    billingStatus: 'pending',
    programId: 'PROG-002',
  },

  {
    id: 'ap8',
    name: 'Robert Kim',
    memberId: '18424',
    language: 'ko',
    ehrId: '8901234',
    billingMonth: BILLING_MONTH,
    dateOfService: DATE_OF_SERVICE,
    isQmb: false,
    chronicConditionCount: 2,
    cptCode: 'G0556',
    icdCodes: [
      { code: 'G47.33', description: 'Obstructive sleep apnea (adult)(pediatric)', status: 'acute' },
      { code: 'E66.01', description: 'Morbid (severe) obesity due to excess calories', status: 'acute' },
    ],
    lastEncounterDate: '09/12/2022', // 43 months ago, outside 36-month window
    reasons: [
      'No Visit in Last 36 Months: Patient has no qualifying visit in the past 36 months, which is required to bill APCM services.',
      'Chronic Condition Not Selected: Both G47.33 and E66.01 are new to this patient\'s APCM profile. Ensure the chronic condition toggle is enabled for each in Athena before submitting the claim.',
    ],
    renderingProvider: 'Dr. Anita Rao',
    renderingProviderInitials: 'AR',
    comment: '',
    tab: 'new-changes',
    billingStatus: 'pending',
    programId: 'PROG-003',
  },

  {
    id: 'ap14',
    name: 'Dorothy Mensah',
    memberId: '18425',
    language: 'en',
    ehrId: '9567890',
    billingMonth: BILLING_MONTH,
    dateOfService: DATE_OF_SERVICE,
    isQmb: true,
    chronicConditionCount: 2,
    cptCode: 'G0558',
    // Dorothy is a Case A example: 1:many ambiguous mapping + chronic-not-selected
    // with a recent encounter that documented I10 (and E11.9). The renovascular /
    // secondary hypertension variants from the SNOMED round-trip are hidden.
    icdCodes: [
      // Documented HTN candidate: user marks chronic to trigger CPT recalc.
      { code: 'I10',   description: 'Essential (primary) hypertension', documentedInLast36Months: true, status: 'acute' },
      { code: 'I15.0', description: 'Renovascular hypertension', documentedInLast36Months: false, status: 'acute' },
      { code: 'I15.9', description: 'Secondary hypertension, unspecified', documentedInLast36Months: false, status: 'acute' },
      // Reason text confirms T2DM is already chronic, pre-marked.
      { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications', documentedInLast36Months: true, status: 'chronic' },
    ],
    lastEncounterDate: '04/25/2026', // 5 days ago, within window
    reasons: [
      'Ambiguous ICD-10 from EMR Mapping: Athena\'s SNOMED round-trip returned three hypertension codes with similar descriptions: I10 (essential/primary), I15.0 (renovascular), and I15.9 (secondary, unspecified). Only the variant documented on a qualifying visit (I10) is shown above.',
      'Chronic Condition Not Selected: Type 2 diabetes (E11.9) is confirmed chronic. Resolve the hypertension mapping above before attesting, the wrong variant could affect billing eligibility.',
    ],
    renderingProvider: 'Dr. Sarah Chen',
    renderingProviderInitials: 'SC',
    comment: '',
    tab: 'new-changes',
    billingStatus: 'pending',
    programId: 'PROG-001',
  },

  {
    id: 'ap15',
    name: 'Alejandro Cruz',
    memberId: '18426',
    language: 'es',
    ehrId: '9678901',
    billingMonth: BILLING_MONTH,
    dateOfService: DATE_OF_SERVICE,
    isQmb: false,
    chronicConditionCount: 1,
    cptCode: 'G0556',
    // Alejandro is a Case C example: 1:many ambiguous mapping AND none of the
    // candidate ICDs were documented on a qualifying encounter in the last 36
    // months. Fold surfaces the patient for visibility but DISABLES attestation
    // until the provider documents a chronic condition in Athena.
    icdCodes: [
      { code: 'K21.0',  description: 'Gastro-esophageal reflux disease with esophagitis', documentedInLast36Months: false, status: 'acute' },
      { code: 'K21.00', description: 'GERD with esophagitis, without bleeding', documentedInLast36Months: false, status: 'acute' },
      { code: 'K21.9',  description: 'Gastro-esophageal reflux disease without esophagitis', documentedInLast36Months: false, status: 'acute' },
    ],
    lastEncounterDate: '08/30/2025', // 8 months ago, visit happened, but no qualifying Dx was charted
    reasons: [
      'Ambiguous ICD-10 from EMR Mapping: Athena\'s SNOMED conversion returned three GERD codes with overlapping descriptions: K21.0 (with esophagitis), K21.00 (with esophagitis, without bleeding), and K21.9 (without esophagitis). The correct ICD-10 for APCM billing cannot be unambiguously identified.',
      'Diagnosis Not Charted in Last 36 Months: None of the candidate GERD codes were documented on a qualifying visit within the 36-month window required for APCM eligibility.',
      'Chronic Condition Not Selected: Attestation is blocked until the provider documents a qualifying chronic condition in Athena. Fold cannot resolve the ambiguous mapping without a charted Dx in the encounter window.',
    ],
    renderingProvider: 'Dr. Kevin Patel',
    renderingProviderInitials: 'KP',
    comment: '',
    tab: 'new-changes',
    billingStatus: 'pending',
    programId: 'PROG-002',
  },

  {
    id: 'ap16',
    name: 'Helen Park',
    memberId: '18427',
    language: 'ko',
    ehrId: '9789012',
    billingMonth: BILLING_MONTH,
    dateOfService: DATE_OF_SERVICE,
    isQmb: true,
    chronicConditionCount: 5,
    cptCode: 'G0558',
    icdCodes: [
      { code: 'I48.19', description: 'Other persistent atrial fibrillation', status: 'acute' },
      { code: 'I50.32', description: 'Chronic diastolic heart failure', status: 'acute' },
      { code: 'E11.9',  description: 'Type 2 diabetes mellitus without complications', status: 'acute' },
      { code: 'N18.3',  description: 'Chronic kidney disease, stage 3 (moderate)', status: 'acute' },
      { code: 'I10',    description: 'Essential (primary) hypertension', status: 'acute' },
    ],
    lastEncounterDate: '05/07/2023', // 23 months ago, within window
    reasons: [
      'Diagnosis Not Charted in Last 36 Months: Chronic diastolic heart failure (I50.32) exists in claims history but hasn\'t been charted on a qualifying visit within the 36-month window required for APCM eligibility.',
      'Chronic Condition Not Selected: Patient has 5 selected conditions but Athena may contain additional qualifying diagnoses not yet flagged for billing. Review all conditions before attesting.',
    ],
    renderingProvider: 'Dr. Anita Rao',
    renderingProviderInitials: 'AR',
    comment: '',
    tab: 'new-changes',
    billingStatus: 'pending',
    programId: 'PROG-003',
  },

  {
    id: 'ap17',
    name: 'Thomas Adeyemi',
    memberId: '18428',
    language: 'en',
    ehrId: '9890123',
    billingMonth: BILLING_MONTH,
    dateOfService: DATE_OF_SERVICE,
    isQmb: false,
    chronicConditionCount: 2,
    cptCode: 'G0556',
    icdCodes: [
      { code: 'M54.5',  description: 'Low back pain', status: 'acute' },
      { code: 'M17.11', description: 'Primary osteoarthritis, right knee', status: 'acute' },
    ],
    lastEncounterDate: '12/20/2022', // 40 months ago, outside 36-month window
    reasons: [
      'No Visit in Last 36 Months: Patient\'s most recent qualifying visit was over 36 months ago, which is required to bill APCM services.',
      'Chronic Condition Not Selected: Both M54.5 and M17.11 are new to this patient\'s APCM profile. Ensure the chronic condition toggle is enabled for each in Athena before submitting the claim.',
    ],
    renderingProvider: 'Dr. Sarah Chen',
    renderingProviderInitials: 'SC',
    comment: '',
    tab: 'new-changes',
    billingStatus: 'pending',
    programId: 'PROG-002',
  },

  // ── Unresolved-mapping demo: provider marked a diagnosis chronic in EHR
  // but Fold's SNOMED round-trip returned multiple SNOMED concepts, each of
  // which mapped back to multiple ICDs. No single ICD can be picked, so we
  // show the description only. These entries carry `code: null` and are
  // excluded from the CPT chronic count until the provider resolves the
  // mapping in Athena. Matches the screenshot user shared.
  {
    id: 'ap20',
    name: 'Stuart Curtis',
    memberId: '18429',
    language: 'en',
    ehrId: '49818',
    billingMonth: BILLING_MONTH,
    dateOfService: DATE_OF_SERVICE,
    isQmb: false,
    chronicConditionCount: 1,
    cptCode: 'G0556',
    icdCodes: [
      {
        code: null,
        description: 'Esophagitis',
        documentedInLast36Months: true,
        status: 'chronic',
      },
    ],
    lastEncounterDate: '06/17/2026',
    reasons: [
      'Unresolved ICD Mapping: Athena marked Esophagitis chronic, but the EHR ICD fanned out to multiple SNOMED concepts and each mapped back to multiple ICDs. Fold cannot confidently pick a single ICD to bill. Provider must resolve the mapping in Athena before this patient can be attested.',
    ],
    renderingProvider: 'Dr. Meredith Grey',
    renderingProviderInitials: 'MG',
    comment: '',
    tab: 'new-changes',
    billingStatus: 'pending',
    programId: 'PROG-002',
  },
  {
    id: 'ap21',
    name: 'Eleanor Snyder',
    memberId: '18430',
    language: 'en',
    ehrId: '49819',
    billingMonth: BILLING_MONTH,
    dateOfService: DATE_OF_SERVICE,
    isQmb: false,
    chronicConditionCount: 1,
    cptCode: 'G0556',
    icdCodes: [
      {
        code: null,
        description: 'Postmenopausal osteopenia',
        documentedInLast36Months: false,
        status: 'chronic',
      },
    ],
    lastEncounterDate: '07/01/2021', // 60 months ago, outside 36mo window
    reasons: [
      'No Visit in Last 36 Months: Patient\'s most recent qualifying visit was over 36 months ago, which is required to bill APCM services.',
      'Unresolved ICD Mapping: Athena marked Postmenopausal osteopenia chronic, but the EHR ICD fanned out to multiple SNOMED concepts and each mapped back to multiple ICDs. Fold cannot confidently pick a single ICD to bill.',
    ],
    renderingProvider: 'Dr. Hange Zoe',
    renderingProviderInitials: 'HZ',
    comment: '',
    tab: 'new-changes',
    billingStatus: 'pending',
    programId: 'PROG-003',
  },

  // ── Rule 1 demo: no ICDs/problems at all. Must NOT surface. ──────────────
  {
    id: 'ap18',
    name: 'Nora Whitfield',
    memberId: '18431',
    language: 'en',
    ehrId: '9901234',
    billingMonth: BILLING_MONTH,
    dateOfService: DATE_OF_SERVICE,
    isQmb: true,
    chronicConditionCount: 0,
    cptCode: 'G0557',
    icdCodes: [],
    lastEncounterDate: '03/12/2026',
    reasons: [],
    renderingProvider: 'Dr. Sarah Chen',
    renderingProviderInitials: 'SC',
    comment: '',
    tab: 'new-changes',
    billingStatus: 'pending',
    programId: 'PROG-001',
  },

  // ── Rule 3 demo: all conditions resolved. Must NOT surface. ──────────────
  {
    id: 'ap19',
    name: 'Vincent Okonkwo',
    memberId: '18432',
    language: 'en',
    ehrId: '9912345',
    billingMonth: BILLING_MONTH,
    dateOfService: DATE_OF_SERVICE,
    isQmb: false,
    chronicConditionCount: 0,
    cptCode: 'G0556',
    icdCodes: [
      { code: 'J20.9', description: 'Acute bronchitis, unspecified', status: 'resolved' },
      { code: 'S93.401A', description: 'Sprain of unspecified ligament of right ankle, initial encounter', status: 'resolved' },
    ],
    lastEncounterDate: '04/02/2026',
    reasons: [],
    renderingProvider: 'Dr. Kevin Patel',
    renderingProviderInitials: 'KP',
    comment: '',
    tab: 'new-changes',
    billingStatus: 'pending',
    programId: 'PROG-002',
  },
];

export const LANG_MAP = {
  en: 'English', es: 'Spanish', zh: 'Chinese', ko: 'Korean',
  vi: 'Vietnamese', hi: 'Hindi', bn: 'Bengali', ar: 'Arabic',
};

// Snapshot of every ICD's status at module load time. Used by the row to
// compute the *baseline* CPT/fee so the UI can show "was $X → now $Y" when
// the user marks or unmarks chronic during the session.
const INITIAL_STATUS_MAP = Object.fromEntries(
  APCM_PATIENTS.map(p => [
    p.id,
    Object.fromEntries((p.icdCodes || []).map(c => [c.code, c.status])),
  ])
);

export function initialStatusOf(patientId, icdCode) {
  return INITIAL_STATUS_MAP[patientId]?.[icdCode];
}

// Compute the ICD codes actually visible in the row (matches ApcmBillingRow).
// Excludes resolved codes always, and, for Case A/C patients (1:many ambig +
// chronic-not-selected): hides the candidate codes that weren't documented
// on a qualifying visit. Filters + bulk actions should key off this same set
// so they never target something the user can't see or act on.
export function visibleIcdsOf(patient) {
  const isAmbiguous = patient.reasons?.some(r => r.startsWith('Ambiguous ICD-10 from EMR Mapping'));
  const chronicNotSelected = patient.reasons?.some(r => r.startsWith('Chronic Condition Not Selected'));
  const nonResolved = (patient.icdCodes || []).filter(c => c.status !== 'resolved');
  return (isAmbiguous && chronicNotSelected)
    ? nonResolved.filter(c => c.documentedInLast36Months !== false)
    : nonResolved;
}

export const PROVIDERS = [...new Set(APCM_PATIENTS.map(p => p.renderingProvider))];

export const CPT_CODES = ['G0556', 'G0557', 'G0558'];

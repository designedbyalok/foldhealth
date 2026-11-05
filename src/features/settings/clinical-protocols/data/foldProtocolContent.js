/* Fold clinical protocols: the care pathways Fold ships with every account,
   stored as Active, read-only clinical protocols (organization "Fold") next to
   the client's own in Care Plan Library > Clinical Protocols. Each also seeds
   a starter care plan template linked to it.

   Each entry is a recommended GBI set plus decision logic and recheck
   cadence for one condition:
     - goals, interventions and barriers name rows of the shared Care Plan
       Library by exact title (the seed resolves them to ids), so a starter
       template never invents a library item. Interventions name the goal they
       serve (goalTitle) and barriers the goals they block (goalTitles).
     - thresholds, decisionRules and cadence use the clinical protocol shapes
       (lib/protocolSchema.js). `source` says what each item rests on: a named
       guideline, or Fold care-management practice where the guideline sets
       no rule.

   These are care-management scaffolding, not orders: actions route decisions
   to the treating clinician. Bump `version` on any clinical change and
   regenerate supabase/fold_protocols_seed.sql (scripts/genFoldProtocolsSeed.mjs). */

const FOLD = 'Fold care-management practice';
const ADA = 'ADA Standards of Care in Diabetes (2026)';
const HF = '2022 AHA/ACC/HFSA Guideline for the Management of Heart Failure';
const AHA_HF_SELF_CARE = 'AHA heart failure self-care guidance';
const GOLD = 'GOLD Report (2025)';
const KDIGO = 'KDIGO 2024 Clinical Practice Guideline for CKD';
const KDIGO_BP = 'KDIGO 2021 Guideline for Blood Pressure in CKD';
const HTN = '2025 AHA/ACC Guideline for High Blood Pressure in Adults';
const LIPID = '2018 AHA/ACC Guideline on the Management of Blood Cholesterol';

export const FOLD_PROTOCOL_CONTENT = [
  {
    id: 'diabetes',
    name: 'Type 2 Diabetes',
    condition: 'Diabetes',
    version: '2026.1',
    summary: 'Glycemic control toward an individualized A1C goal, hypoglycemia prevention and routine complication screening for adults with type 2 diabetes.',
    sources: [ADA],
    // Common: what every patient with type 2 diabetes gets, at any A1C.
    goals: [
      { title: 'Reduce episodes of hypoglycemia' },
      { title: 'Improve diabetes medication adherence' },
      { title: 'Complete routine diabetes monitoring' },
      { title: 'Improve renal risk monitoring' },
    ],
    interventions: [
      { title: 'Hypoglycemia education', goalTitle: 'Reduce episodes of hypoglycemia' },
      { title: 'Hypoglycemia review', goalTitle: 'Reduce episodes of hypoglycemia' },
      { title: 'Medication adherence education', goalTitle: 'Improve diabetes medication adherence' },
      { title: 'Diabetes monitoring checklist', goalTitle: 'Complete routine diabetes monitoring' },
      { title: 'Renal monitoring', goalTitle: 'Improve renal risk monitoring' },
    ],
    barriers: [
      { title: 'Hypoglycemia risk', goalTitles: ['Reduce episodes of hypoglycemia'] },
      { title: 'Medication adherence difficulty', goalTitles: ['Improve diabetes medication adherence'] },
      { title: 'Lab access issue', goalTitles: ['Complete routine diabetes monitoring', 'Improve renal risk monitoring'] },
    ],
    // By the latest A1C, against the thresholds below (ADA goal < 7% for most
    // adults; Fold flags 9% or above). Checked in order, first match wins.
    categories: [
      {
        id: 'diabetes-a1c-9-plus',
        name: 'A1C 9% or above',
        match: 'all',
        criteria: [{ type: 'lab', lab: 'hba1c', op: '>=', value: 9, withinDays: 180 }],
        goals: [
          { title: 'Improve A1C control', priority: 'high' },
          { title: 'Monitor blood glucose consistently' },
          { title: 'Maintain glucose within target range' },
        ],
        interventions: [
          { title: 'Diabetes education', goalTitle: 'Improve A1C control' },
          { title: 'A1C follow-up', goalTitle: 'Improve A1C control' },
          { title: 'Diabetes nutrition coaching', goalTitle: 'Improve A1C control' },
          { title: 'Glucose monitoring support', goalTitle: 'Monitor blood glucose consistently' },
          { title: 'Glucose pattern review', goalTitle: 'Maintain glucose within target range' },
        ],
        barriers: [
          { title: 'Limited progress toward A1C target', priority: 'high', goalTitles: ['Improve A1C control'] },
          { title: 'Diabetes self-management complexity', goalTitles: ['Improve A1C control', 'Monitor blood glucose consistently'] },
          { title: 'Glucose-monitoring difficulty', goalTitles: ['Monitor blood glucose consistently'] },
        ],
      },
      {
        id: 'diabetes-a1c-7-to-9',
        name: 'A1C 7% to 8.9%',
        match: 'all',
        criteria: [{ type: 'lab', lab: 'hba1c', op: '>=', value: 7, withinDays: 180 }],
        goals: [
          { title: 'Improve A1C control' },
          { title: 'Monitor blood glucose consistently' },
        ],
        interventions: [
          { title: 'Diabetes education', goalTitle: 'Improve A1C control' },
          { title: 'A1C follow-up', goalTitle: 'Improve A1C control' },
          { title: 'Diabetes nutrition coaching', goalTitle: 'Improve A1C control' },
          { title: 'Glucose monitoring support', goalTitle: 'Monitor blood glucose consistently' },
        ],
        barriers: [
          { title: 'Limited progress toward A1C target', goalTitles: ['Improve A1C control'] },
          { title: 'Glucose-monitoring difficulty', goalTitles: ['Monitor blood glucose consistently'] },
        ],
      },
      {
        id: 'diabetes-a1c-at-goal',
        name: 'A1C below 7% (at goal)',
        match: 'all',
        criteria: [{ type: 'lab', lab: 'hba1c', op: '<', value: 7, withinDays: 365 }],
        goals: [{ title: 'Maintain glucose within target range' }],
        interventions: [{ title: 'Glucose pattern review', goalTitle: 'Maintain glucose within target range' }],
        barriers: [],
      },
    ],
    thresholds: [
      { measure: 'A1C', comparator: '<', value: 7, unit: '%', label: 'Goal for most nonpregnant adults', action: 'Individualize: a less stringent goal (such as < 8%) fits limited life expectancy or high hypoglycemia risk.', source: ADA },
      { measure: 'A1C', comparator: '>=', value: 9, unit: '%', label: 'Well above goal', action: 'Flag to the treating clinician for treatment review and step up outreach.', source: FOLD },
      { measure: 'CGM time in range (70–180 mg/dL)', comparator: '>', value: 70, unit: '%', label: 'Goal for most adults using CGM', source: ADA },
      { measure: 'Blood glucose', comparator: '<', value: 70, unit: 'mg/dL', label: 'Level 1 hypoglycemia', action: 'Treat with 15 g fast-acting carbohydrate, recheck in 15 minutes, log the event.', source: ADA },
      { measure: 'Blood glucose', comparator: '<', value: 54, unit: 'mg/dL', label: 'Level 2 hypoglycemia', action: 'Same-day notice to the treating clinician; review glucose-lowering medicines.', source: ADA },
      { measure: 'Blood pressure', comparator: '<', value: 130, unit: 'mmHg systolic (and < 80 diastolic)', label: 'BP goal in diabetes', source: ADA },
      { measure: 'Urine albumin-to-creatinine ratio', comparator: '>=', value: 30, unit: 'mg/g', label: 'Albuminuria', action: 'Follow the Chronic Kidney Disease protocol alongside this one.', source: ADA },
    ],
    decisionRules: [
      { when: 'A1C is above the individualized goal at a scheduled check', then: 'Notify the treating clinician for treatment intensification review (avoid therapeutic inertia), recheck A1C in 3 months and move check-ins to every 2 weeks until the plan is updated.', source: ADA },
      { when: 'Level 2 or level 3 (severe) hypoglycemia is reported', then: 'Notify the treating clinician the same day, review insulin and sulfonylurea use, and confirm glucagon is prescribed and the household knows how to use it.', source: ADA },
      { when: 'eGFR < 60 mL/min/1.73m² or urine albumin-to-creatinine ratio ≥ 30 mg/g', then: 'Flag for clinician review of kidney-protective therapy (SGLT2 inhibitor and ACE inhibitor or ARB) and start the Chronic Kidney Disease protocol.', source: ADA },
      { when: 'A1C is at goal on two consecutive checks with a stable regimen', then: 'Space A1C to every 6 months and check-ins to monthly.', source: ADA },
    ],
    cadence: [
      { activity: 'A1C', kind: 'lab', times: 1, every: 3, unit: 'month', appliesWhen: 'Not at goal or therapy changed', source: ADA },
      { activity: 'A1C', kind: 'lab', times: 1, every: 6, unit: 'month', appliesWhen: 'At goal with a stable regimen', source: ADA },
      { activity: 'Urine albumin-to-creatinine ratio and eGFR', kind: 'lab', times: 1, every: 1, unit: 'year', source: ADA },
      { activity: 'Comprehensive foot exam', kind: 'visit', times: 1, every: 1, unit: 'year', source: ADA },
      { activity: 'Dilated eye exam', kind: 'visit', times: 1, every: 1, unit: 'year', appliesWhen: 'Every 1–2 years when there is no retinopathy and glycemia is at goal', source: ADA },
      { activity: 'Care-manager check-in', kind: 'check_in', times: 1, every: 1, unit: 'month', source: FOLD },
    ],
  },
  {
    id: 'heart-failure',
    name: 'Heart Failure',
    condition: 'Heart failure',
    version: '2026.1',
    summary: 'Daily self-monitoring, early recognition of decompensation, guideline-directed medical therapy follow-through and early follow-up after a hospital stay.',
    sources: [HF, AHA_HF_SELF_CARE],
    goals: [
      { title: 'Improve heart failure symptom control' },
      { title: 'Monitor daily weight for heart failure' },
      { title: 'Improve recognition of warning signs' },
      { title: 'Maintain sodium consumption' },
      { title: 'Improve overall medication adherence' },
      { title: 'Complete post-discharge follow-up' },
      { title: 'Prevent avoidable readmission' },
    ],
    interventions: [
      { title: 'Daily weight monitoring', goalTitle: 'Monitor daily weight for heart failure' },
      { title: 'Heart-failure symptom review', goalTitle: 'Improve heart failure symptom control' },
      { title: 'Escalation coordination', goalTitle: 'Improve heart failure symptom control' },
      { title: 'Warning-sign education', goalTitle: 'Improve recognition of warning signs' },
      { title: 'Nutrition risk counseling', goalTitle: 'Maintain sodium consumption' },
      { title: 'Medication adherence education', goalTitle: 'Improve overall medication adherence' },
      { title: 'Refill support', goalTitle: 'Improve overall medication adherence' },
      { title: 'Medication review', goalTitle: 'Improve overall medication adherence' },
      { title: 'Post-discharge outreach', goalTitle: 'Complete post-discharge follow-up' },
      { title: 'Readmission-risk review', goalTitle: 'Prevent avoidable readmission' },
    ],
    barriers: [
      { title: 'Weight-monitoring inconsistency', goalTitles: ['Monitor daily weight for heart failure'] },
      { title: 'Scale or equipment access', goalTitles: ['Monitor daily weight for heart failure'] },
      { title: 'Difficulty recognizing cardiac symptoms', goalTitles: ['Improve recognition of warning signs', 'Improve heart failure symptom control'] },
      { title: 'Difficulty following fluid/sodium plan', goalTitles: ['Maintain sodium consumption'] },
      { title: 'Medication adherence difficulty', goalTitles: ['Improve overall medication adherence'] },
      { title: 'High readmission risk', goalTitles: ['Prevent avoidable readmission'] },
    ],
    thresholds: [
      { measure: 'Weight gain in 24 hours', comparator: '>', value: 2, unit: 'lb', label: 'Possible fluid retention', action: 'Same-day call to the care team; notify the heart failure clinician.', source: AHA_HF_SELF_CARE },
      { measure: 'Weight gain in 7 days', comparator: '>', value: 5, unit: 'lb', label: 'Possible fluid retention', action: 'Same-day call to the care team; notify the heart failure clinician.', source: AHA_HF_SELF_CARE },
      { measure: 'Systolic blood pressure', comparator: '<', value: 90, unit: 'mmHg', label: 'Low with symptoms', action: 'If dizzy or lightheaded, notify the clinician the same day before the next dose.', source: FOLD },
      { measure: 'Resting heart rate', comparator: '>', value: 100, unit: 'bpm', label: 'Tachycardia', action: 'Ask about symptoms and notify the clinician the same day.', source: FOLD },
    ],
    decisionRules: [
      { when: 'Chest pain, severe shortness of breath, fainting or confusion', then: 'Direct the patient to call 911.', source: FOLD },
      { when: 'Worsening breathlessness, orthopnea, new or increased swelling, or a weight-gain threshold is crossed', then: 'Notify the heart failure clinician the same day and follow their diuretic instructions; recheck symptoms within 48 hours.', source: AHA_HF_SELF_CARE },
      { when: 'Discharged after a heart failure hospital stay', then: 'Schedule a clinician follow-up within 7 days, reconcile medicines and move check-ins to weekly for 30 days.', source: HF },
      { when: 'Reduced ejection fraction (HFrEF) and not on all four medicine classes (ARNI/ACE inhibitor/ARB, evidence-based beta blocker, MRA, SGLT2 inhibitor)', then: 'Flag to the treating clinician for guideline-directed therapy review.', source: HF },
    ],
    cadence: [
      { activity: 'Weight, before breakfast after voiding', kind: 'measurement', times: 1, every: 1, unit: 'day', source: AHA_HF_SELF_CARE },
      { activity: 'Symptom check-in', kind: 'check_in', times: 1, every: 1, unit: 'week', appliesWhen: 'First 30 days after discharge or a medicine change', source: FOLD },
      { activity: 'Symptom check-in', kind: 'check_in', times: 1, every: 1, unit: 'month', appliesWhen: 'Stable', source: FOLD },
      { activity: 'Potassium and kidney function', kind: 'lab', times: 1, every: 1, unit: 'week', appliesWhen: 'Within 1 week of starting or changing an ACE inhibitor, ARB, ARNI or MRA', source: HF },
      { activity: 'Medication review', kind: 'medication_review', times: 1, every: 3, unit: 'month', source: FOLD },
    ],
  },
  {
    id: 'copd',
    name: 'COPD',
    condition: 'COPD',
    version: '2026.1',
    summary: 'Symptom and exacerbation control through inhaler technique, a written action plan, tobacco cessation, oxygen where indicated and vaccination.',
    sources: [GOLD],
    goals: [
      { title: 'Improve COPD symptom control' },
      { title: 'Reduce respiratory exacerbations' },
      { title: 'Improve inhaler technique' },
      { title: 'Improve inhaler adherence' },
      { title: 'Monitor oxygen saturation for COPD' },
      { title: 'Reduce tobacco exposure' },
      { title: 'Complete immunization review' },
    ],
    interventions: [
      { title: 'Respiratory symptom monitoring', goalTitle: 'Improve COPD symptom control' },
      { title: 'Respiratory action-plan education', goalTitle: 'Reduce respiratory exacerbations' },
      { title: 'Exacerbation prevention', goalTitle: 'Reduce respiratory exacerbations' },
      { title: 'Inhaler education', goalTitle: 'Improve inhaler technique' },
      { title: 'Inhaler teach-back', goalTitle: 'Improve inhaler technique' },
      { title: 'Medication adherence education', goalTitle: 'Improve inhaler adherence' },
      { title: 'Oxygen-use support', goalTitle: 'Monitor oxygen saturation for COPD' },
      { title: 'Tobacco-use counseling', goalTitle: 'Reduce tobacco exposure' },
      { title: 'Tobacco cessation resources', goalTitle: 'Reduce tobacco exposure' },
      { title: 'Immunization review', goalTitle: 'Complete immunization review' },
    ],
    barriers: [
      { title: 'Respiratory symptom burden', goalTitles: ['Improve COPD symptom control'] },
      { title: 'Difficulty following action plan', goalTitles: ['Reduce respiratory exacerbations'] },
      { title: 'Incorrect inhaler technique', goalTitles: ['Improve inhaler technique'] },
      { title: 'Inhaler adherence difficulty', goalTitles: ['Improve inhaler adherence'] },
      { title: 'Oxygen equipment issue', goalTitles: ['Monitor oxygen saturation for COPD'] },
      { title: 'Tobacco cessation difficulty', goalTitles: ['Reduce tobacco exposure'] },
    ],
    thresholds: [
      { measure: 'Resting SpO2', comparator: '<=', value: 88, unit: '%', label: 'Severe resting hypoxemia', action: 'Flag to the clinician for long-term oxygen evaluation (confirm with arterial blood gas).', source: GOLD },
      { measure: 'SpO2 on supplemental oxygen', comparator: 'between', value: 88, value2: 92, unit: '%', label: 'Target range', source: GOLD },
      { measure: 'COPD Assessment Test (CAT)', comparator: '>=', value: 10, unit: 'points', label: 'High symptom burden', action: 'Review inhaler regimen and technique with the clinician.', source: GOLD },
      { measure: 'Moderate or severe exacerbations in 12 months', comparator: '>=', value: 2, label: 'High exacerbation risk', action: 'Flag for clinician review of maintenance therapy; one exacerbation leading to a hospital stay counts the same.', source: GOLD },
    ],
    decisionRules: [
      { when: 'More breathlessness, more sputum or a change in sputum color', then: 'Start the written action plan and notify the clinician the same day.', source: GOLD },
      { when: 'Severe breathlessness at rest, confusion or blue lips', then: 'Direct the patient to call 911.', source: FOLD },
      { when: 'Discharged after an exacerbation hospital stay', then: 'Schedule follow-up within 30 days, re-check inhaler technique, and refer to pulmonary rehabilitation.', source: GOLD },
      { when: 'The patient smokes', then: 'Offer cessation counseling and pharmacotherapy referral at every contact.', source: GOLD },
    ],
    cadence: [
      { activity: 'Inhaler technique teach-back', kind: 'check_in', times: 1, every: 3, unit: 'month', appliesWhen: 'And at every inhaler change', source: GOLD },
      { activity: 'Symptom score (CAT or mMRC)', kind: 'measurement', times: 1, every: 3, unit: 'month', source: FOLD },
      { activity: 'Spirometry', kind: 'lab', times: 1, every: 1, unit: 'year', source: GOLD },
      { activity: 'Immunization review (influenza, RSV, pneumococcal, COVID-19)', kind: 'other', times: 1, every: 1, unit: 'year', source: GOLD },
      { activity: 'Care-manager check-in', kind: 'check_in', times: 1, every: 1, unit: 'month', source: FOLD },
    ],
  },
  {
    id: 'ckd',
    name: 'Chronic Kidney Disease',
    condition: 'Chronic kidney disease',
    version: '2026.1',
    summary: 'Risk-based kidney monitoring, blood pressure control, kidney-protective therapy review, safe medicine use and timely nephrology referral.',
    sources: [KDIGO, KDIGO_BP],
    goals: [
      { title: 'Maintain kidney function monitoring' },
      { title: 'Maintain individualized renal-protection plan' },
      { title: 'Maintain blood pressure within target' },
      { title: 'Improve overall medication adherence' },
      { title: 'Improve completion of recommended labs' },
      { title: 'Improve understanding of condition' },
    ],
    interventions: [
      { title: 'Lab tracking', goalTitle: 'Maintain kidney function monitoring' },
      { title: 'Renal monitoring', goalTitle: 'Maintain kidney function monitoring' },
      { title: 'Lab completion follow-up', goalTitle: 'Improve completion of recommended labs' },
      { title: 'Renal risk-factor support', goalTitle: 'Maintain individualized renal-protection plan' },
      { title: 'Medication review', goalTitle: 'Maintain individualized renal-protection plan' },
      { title: 'Blood pressure monitoring', goalTitle: 'Maintain blood pressure within target' },
      { title: 'Medication adherence education', goalTitle: 'Improve overall medication adherence' },
      { title: 'Chronic kidney disease education', goalTitle: 'Improve understanding of condition' },
    ],
    barriers: [
      { title: 'Kidney-monitoring complexity', goalTitles: ['Maintain kidney function monitoring'] },
      { title: 'Lab access issue', goalTitles: ['Improve completion of recommended labs'] },
      { title: 'Polypharmacy', goalTitles: ['Maintain individualized renal-protection plan'] },
      { title: 'Difficulty controlling condition', goalTitles: ['Maintain blood pressure within target'] },
      { title: 'Medication adherence difficulty', goalTitles: ['Improve overall medication adherence'] },
      { title: 'Limited health literacy', goalTitles: ['Improve understanding of condition'] },
    ],
    thresholds: [
      { measure: 'eGFR', comparator: '<', value: 60, unit: 'mL/min/1.73m²', label: 'CKD G3a or worse when present 3 months or more', source: KDIGO },
      { measure: 'Urine albumin-to-creatinine ratio', comparator: '>=', value: 30, unit: 'mg/g', label: 'Moderately increased albuminuria (A2)', source: KDIGO },
      { measure: 'eGFR', comparator: '<', value: 30, unit: 'mL/min/1.73m²', label: 'G4 to G5', action: 'Refer to nephrology.', source: KDIGO },
      { measure: 'Urine albumin-to-creatinine ratio', comparator: '>=', value: 300, unit: 'mg/g', label: 'Severely increased albuminuria (A3)', action: 'Refer to nephrology.', source: KDIGO },
      { measure: 'Systolic blood pressure', comparator: '<', value: 120, unit: 'mmHg', label: 'Goal when tolerated (standardized office reading)', source: KDIGO_BP },
    ],
    decisionRules: [
      { when: 'eGFR falls 25% or more from baseline, or progression is rapid', then: 'Notify the treating clinician and refer to nephrology.', source: KDIGO },
      { when: 'eGFR ≥ 20 and type 2 diabetes, heart failure, or urine albumin-to-creatinine ratio ≥ 200 mg/g', then: 'Flag for clinician review of SGLT2 inhibitor therapy.', source: KDIGO },
      { when: 'Albuminuria and an ACE inhibitor or ARB is started or the dose changes', then: 'Check potassium and creatinine within 2–4 weeks.', source: KDIGO },
      { when: 'A new medicine is started or an over-the-counter NSAID is in use', then: 'Medication review for kidney dosing and nephrotoxic drugs; tell the patient to avoid NSAIDs unless the clinician approves.', source: KDIGO },
    ],
    cadence: [
      { activity: 'eGFR and urine albumin-to-creatinine ratio', kind: 'lab', times: 1, every: 1, unit: 'year', appliesWhen: 'Low risk: G1–G2 with A1', source: KDIGO },
      { activity: 'eGFR and urine albumin-to-creatinine ratio', kind: 'lab', times: 2, every: 1, unit: 'year', appliesWhen: 'Moderate risk: G3a or A2', source: KDIGO },
      { activity: 'eGFR and urine albumin-to-creatinine ratio', kind: 'lab', times: 3, every: 1, unit: 'year', appliesWhen: 'High risk: G3b or worse, or A3 (4 or more a year at very high risk)', source: KDIGO },
      { activity: 'Medication review', kind: 'medication_review', times: 1, every: 6, unit: 'month', source: FOLD },
      { activity: 'Care-manager check-in', kind: 'check_in', times: 1, every: 1, unit: 'month', source: FOLD },
    ],
  },
  {
    id: 'hypertension',
    name: 'Hypertension',
    condition: 'Hypertension',
    version: '2026.1',
    summary: 'Blood pressure to goal through validated home monitoring, medication follow-through, DASH-style eating, sodium reduction and activity.',
    sources: [HTN],
    goals: [
      { title: 'Maintain blood pressure within target' },
      { title: 'Monitor blood pressure consistently' },
      { title: 'Improve medication adherence for hypertension' },
      { title: 'Follow DASH eating pattern' },
      { title: 'Maintain sodium consumption' },
      { title: 'Reduce cardiovascular risk through activity' },
    ],
    interventions: [
      { title: 'Blood pressure monitoring', goalTitle: 'Monitor blood pressure consistently' },
      { title: 'BP technique education', goalTitle: 'Monitor blood pressure consistently' },
      { title: 'BP trend follow-up', goalTitle: 'Maintain blood pressure within target' },
      { title: 'BP care-plan review', goalTitle: 'Maintain blood pressure within target' },
      { title: 'Hypertension education', goalTitle: 'Maintain blood pressure within target' },
      { title: 'Medication adherence education', goalTitle: 'Improve medication adherence for hypertension' },
      { title: 'Refill support', goalTitle: 'Improve medication adherence for hypertension' },
      { title: 'Nutrition coaching', goalTitle: 'Follow DASH eating pattern' },
      { title: 'Nutrition risk counseling', goalTitle: 'Maintain sodium consumption' },
      { title: 'Activity coaching', goalTitle: 'Reduce cardiovascular risk through activity' },
    ],
    barriers: [
      { title: 'Persistent abnormal readings', goalTitles: ['Maintain blood pressure within target'] },
      { title: 'Inconsistent self-monitoring', goalTitles: ['Monitor blood pressure consistently'] },
      { title: 'Difficulty using monitoring equipment', goalTitles: ['Monitor blood pressure consistently'] },
      { title: 'Medication adherence difficulty', goalTitles: ['Improve medication adherence for hypertension'] },
      { title: 'Nutrition challenges', goalTitles: ['Follow DASH eating pattern', 'Maintain sodium consumption'] },
      { title: 'Limited physical activity', goalTitles: ['Reduce cardiovascular risk through activity'] },
    ],
    thresholds: [
      { measure: 'Blood pressure', comparator: '<', value: 130, unit: 'mmHg systolic (and < 80 diastolic)', label: 'Goal for most adults', action: 'Encourage systolic < 120 when tolerated.', source: HTN },
      { measure: 'Blood pressure', comparator: '>=', value: 140, unit: 'mmHg systolic (or ≥ 90 diastolic)', label: 'Stage 2', action: 'Flag to the treating clinician if not already on a plan to reach goal.', source: HTN },
      { measure: 'Blood pressure', comparator: '>', value: 180, unit: 'mmHg systolic (or > 120 diastolic)', label: 'Severe', action: 'Recheck after 5 minutes of rest; with chest pain, shortness of breath, weakness, vision or speech change call 911; without symptoms notify the clinician the same day.', source: HTN },
    ],
    decisionRules: [
      { when: 'A blood pressure medicine is started or changed', then: 'Monthly follow-up until blood pressure is at goal.', source: HTN },
      { when: 'Home average is above goal for 2 consecutive reviews', then: 'Check cuff technique and adherence first, then flag to the treating clinician for treatment review.', source: FOLD },
      { when: 'Above goal on 3 or more medicines including a diuretic', then: 'Flag for resistant hypertension evaluation, including screening for primary aldosteronism.', source: HTN },
      { when: 'Blood pressure is at goal on 2 consecutive reviews', then: 'Space check-ins to every 3 months.', source: HTN },
    ],
    cadence: [
      { activity: 'Home blood pressure (2 readings, morning and evening)', kind: 'measurement', times: 2, every: 1, unit: 'day', appliesWhen: 'For the 7 days before each review, or daily while medicines are being adjusted', source: HTN },
      { activity: 'Care-manager check-in', kind: 'check_in', times: 1, every: 1, unit: 'month', appliesWhen: 'Until at goal', source: HTN },
      { activity: 'Care-manager check-in', kind: 'check_in', times: 1, every: 3, unit: 'month', appliesWhen: 'At goal', source: HTN },
      { activity: 'Basic metabolic panel (potassium, creatinine)', kind: 'lab', times: 1, every: 1, unit: 'year', appliesWhen: 'And 2–4 weeks after starting or changing a diuretic, ACE inhibitor or ARB', source: FOLD },
    ],
  },
  {
    id: 'dyslipidemia',
    name: 'Dyslipidemia',
    condition: 'Hyperlipidemia',
    version: '2026.1',
    summary: 'Risk-based statin therapy follow-through, LDL-C response checks, side-effect support and heart-healthy lifestyle.',
    sources: [LIPID],
    goals: [
      { title: 'Improve lipid management' },
      { title: 'Improve overall medication adherence' },
      { title: 'Reduce saturated fat intake' },
      { title: 'Reduce cardiovascular risk through activity' },
      { title: 'Improve weight management' },
    ],
    interventions: [
      { title: 'Lipid-management follow-up', goalTitle: 'Improve lipid management' },
      { title: 'Lab tracking', goalTitle: 'Improve lipid management' },
      { title: 'Medication adherence education', goalTitle: 'Improve overall medication adherence' },
      { title: 'Refill support', goalTitle: 'Improve overall medication adherence' },
      { title: 'Nutrition coaching', goalTitle: 'Reduce saturated fat intake' },
      { title: 'Activity plan', goalTitle: 'Reduce cardiovascular risk through activity' },
      { title: 'Activity coaching', goalTitle: 'Reduce cardiovascular risk through activity' },
      { title: 'Weight-management coaching', goalTitle: 'Improve weight management' },
    ],
    barriers: [
      { title: 'Limited understanding of lipid management', goalTitles: ['Improve lipid management'] },
      { title: 'Medication side effects', goalTitles: ['Improve overall medication adherence'] },
      { title: 'Medication adherence difficulty', goalTitles: ['Improve overall medication adherence'] },
      { title: 'Nutrition challenges', goalTitles: ['Reduce saturated fat intake'] },
      { title: 'Limited physical activity', goalTitles: ['Reduce cardiovascular risk through activity'] },
      { title: 'Weight-management difficulty', goalTitles: ['Improve weight management'] },
    ],
    thresholds: [
      { measure: 'LDL-C', comparator: '>=', value: 190, unit: 'mg/dL', label: 'Severe hypercholesterolemia', action: 'Flag for high-intensity statin review (ages 20–75).', source: LIPID },
      { measure: 'LDL-C on maximally tolerated statin, with clinical ASCVD', comparator: '>=', value: 70, unit: 'mg/dL', label: 'Very high risk above threshold', action: 'Flag for clinician review of adding a non-statin (such as ezetimibe).', source: LIPID },
      { measure: '10-year ASCVD risk', comparator: '>=', value: 7.5, unit: '%', label: 'Intermediate or higher risk', action: 'Prompt a statin discussion with the clinician if not on one.', source: LIPID },
      { measure: 'Triglycerides (fasting)', comparator: '>=', value: 500, unit: 'mg/dL', label: 'Severe hypertriglyceridemia', action: 'Flag to the clinician the same week.', source: LIPID },
    ],
    decisionRules: [
      { when: 'Diabetes, age 40–75, and not on a statin', then: 'Flag for moderate-intensity statin review regardless of estimated risk.', source: LIPID },
      { when: 'LDL-C falls less than expected after a statin start or change (under 50% on high-intensity, 30–49% on moderate-intensity)', then: 'Review adherence first, then flag to the treating clinician for intensification review.', source: LIPID },
      { when: 'Muscle aches or weakness on a statin', then: 'Ask the patient not to stop on their own; notify the clinician to assess statin-associated muscle symptoms.', source: LIPID },
    ],
    cadence: [
      { activity: 'Lipid panel', kind: 'lab', times: 1, every: 3, unit: 'month', appliesWhen: '4–12 weeks after starting or changing lipid therapy', source: LIPID },
      { activity: 'Lipid panel', kind: 'lab', times: 1, every: 1, unit: 'year', appliesWhen: 'Stable on therapy (every 3–12 months as needed)', source: LIPID },
      { activity: 'Adherence and refill check', kind: 'medication_review', times: 1, every: 1, unit: 'month', source: FOLD },
      { activity: 'Lifestyle coaching check-in', kind: 'check_in', times: 1, every: 1, unit: 'month', source: FOLD },
    ],
  },
];

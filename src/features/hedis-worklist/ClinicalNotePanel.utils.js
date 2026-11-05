import { derivedPatch, needsTelehealthConsent, requiredKeys } from '../../lib/noteTemplateRules';

export const CURRENT_USER = 'Isabeth Partida Fra';
export const GENDER_LABEL = { M: 'Male', F: 'Female', O: 'Other' };

// Gaps closed from their own tracker, not a visit note: CIS-CMB10 closes
// from recorded immunizations. Never listed in the clinical note.
export const NOTELESS_GAP_CODES = new Set(['CIS-CMB10']);

// Open gaps a clinical note can cover.
export const noteOpenGaps = (gaps) => (gaps || []).filter(g =>
  !NOTELESS_GAP_CODES.has(g.code) && g.status !== 'Completed' && !String(g.status).startsWith('Closed'));

export const MEASURE_NAMES = {
  CBP:        'Controlling Blood Pressure',
  COL:        'Colorectal Cancer Screening',
  'COA-FS':   'Care for Older Adults: Functional Status',
  'COA-M':    'Care for Older Adults: Medication Review',
  BCS:        'Breast Cancer Screening',
  DM:         'Diabetes HbA1c Control',
  ABA:        'Adult BMI Assessment',
  FUH:        'Follow-Up After Hospitalization',
  AMR:        'Asthma Medication Ratio',
  KED:        'Kidney Health Evaluation',
  EED:        'Eye Exam for Patients With Diabetes',
  GSD3:       'Glycemic Status Assessment (HbA1c > 9%)',
  OMW:        'Osteoporosis Management in Women',
  BPD:        'Blood Pressure Documentation',
  CCS:        'Cervical Cancer Screening',
  CHL:        'Chlamydia Screening',
  'CIS-CMB10': 'Childhood Immunization Status (Combo 10)',
  COB:        'Care for Older Adults: Body / BMI',
  DEV:        'Developmental Screening (First 3 Years)',
  IMACMB2:    'Immunizations for Adolescents (Combo 2)',
  LSC:        'Lead Screening in Children',
  POLYACH:    'Polypharmacy: Anticholinergic Meds',
  PPC1A:      'Prenatal Care: Timeliness',
  PPC2A:      'Postpartum Care',
  SUPD:       'Statin Use in Persons with Diabetes',
  TRCEA:      'Transitions of Care: Engagement',
  TRCMA:      'Transitions of Care: Med Reconciliation',
  W30A:       'Well-Child First 15 Months',
  W30B:       'Well-Child 15–30 Months',
  WCV:        'Well-Care Visit (Children/Adolescents)',
  APE:        'Adult Preventive Exam',
  FMC:        'Follow-Up After ED Visit for Mental Illness',
  MRP:        'Medication Reconciliation Post-Discharge',
  'DSF-A':    'Depression Screening (PHQ-2)',
  'DSF-B':    'Depression Follow-Up (PHQ-9)',
};

// Notes saved against an earlier template: { from: old key, to: new key,
// map }. Only fills a new field that's still empty; old keys are kept.
export const LEGACY_GAP_FIELDS = {
  LSC: [
    { from: 'leadLevel', to: 'resultValue', map: (v) => v },
    { from: 'testType', to: 'procedurePerformed', map: (v) => (v === 'capillary' ? true : undefined) },
  ],
};

// Saved gap data as the current template reads it: legacy fields mapped,
// then derived values (Result, care plan) filled in. Used wherever a note's
// payload is loaded, so the next save persists the upgraded shape.
export function savedGapData(code, data) {
  if (!data || typeof data !== 'object') return data;
  const out = { ...data };
  for (const { from, to, map } of LEGACY_GAP_FIELDS[code] || []) {
    const v = data[from] == null || data[from] === '' ? undefined : map(data[from]);
    if ((out[to] === '' || out[to] == null) && v !== undefined) out[to] = v;
  }
  const t = GAP_TEMPLATES[code];
  return t ? { ...out, ...derivedPatch(t, out) } : out;
}

// CPT billed on provider sign-off (SSD capable), keyed by gap code. LSC
// bills 83655 whatever the result.
export const MEASURE_CPT = {
  LSC: '83655',
};

export const EED_EXAM_TYPES = [
  { value: 'dilated', label: 'Dilated retinal eye exam' },
  { value: 'non-dilated', label: 'Non-dilated retinal eye exam' },
  { value: 'fundus-photo', label: 'Fundus photography' },
];

export const EED_LATERALITIES = [
  { value: 'both', label: 'Both eyes' },
  { value: 'left', label: 'Left eye' },
  { value: 'right', label: 'Right eye' },
];

export const EED_EVIDENCE_TYPES = [
  'Completed Eye Exam (Retinal or Dilated) in the calendar year',
  'Negative Eye Exam (Retinal or Dilated) prior year',
  'Patient-reported only (no chart documentation)',
];

export const EED_EXAM_RESULTS = [
  'Negative - no retinopathy',
  'Mild non-proliferative DR',
  'Moderate / severe NPDR',
  'Proliferative DR',
];

export const EED_FOLLOW_UP_OPTIONS = [
  { key: 'referOphthalmology', label: 'Refer to ophthalmology' },
  { key: 'laserTreatment',     label: 'Laser treatment recommended' },
  { key: 'antiVegf',            label: 'Anti-VEGF therapy discussed' },
  { key: 'annualScheduled',    label: 'Annual follow-up scheduled' },
];

// CBP (Controlling Blood Pressure): Location where the BP reading was taken.
export const CBP_LOCATIONS = [
  { value: 'outpatient', label: 'Outpatient visit' },
  { value: 'telehealth', label: 'Telehealth visit' },
  { value: 'clinic',     label: 'Clinic' },
  { value: 'home',       label: 'Home' },
];

// Yes / No radio pattern used for the medication + monitoring questions.
export const CBP_YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no',  label: 'No' },
];

// Yes + "Patient denies" pattern used for the three symptom-severity blocks.
export const CBP_SYMPTOM_OPTIONS = [
  { value: 'yes',     label: 'Yes' },
  { value: 'denies',  label: 'Patient denies any symptoms at this time' },
];

// ── Generic gap templates ────────────────────────────────────────────────
// One entry per HEDIS gap code that doesn't have its own bespoke component
// (CBP + EED still ship their own hand-crafted forms above). Each template
// is a flat list of field descriptors that `GenericEvidenceForm` renders in
// the standard Fold layout. Field descriptor shape:
//   { key, label, type, options?, required?, placeholder?, description?,
//     column? }
// Types: 'text' | 'number' | 'date' | 'select' | 'radio' | 'checkbox'.
// `column: 2` opts the field into a 2-up grid row (must appear in pairs).
const YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

export const GAP_TEMPLATES = {
  BCS: [
    { key: 'screeningDate', label: 'Screening Date', type: 'date', required: true, column: 2 },
    { key: 'modality', label: 'Modality', type: 'select', required: true, column: 2,
      options: [
        { value: 'mammogram', label: 'Mammography' },
        { value: 'tomo', label: 'Digital breast tomosynthesis' },
        { value: 'mri', label: 'Breast MRI' },
      ] },
    { key: 'result', label: 'Result', type: 'select', required: true,
      options: [
        { value: 'negative', label: 'Negative' },
        { value: 'positive', label: 'Positive: further workup needed' },
        { value: 'inconclusive', label: 'Inconclusive' },
      ] },
    { key: 'facility', label: 'Facility Name', type: 'text', placeholder: 'Enter facility name' },
    { key: 'nextDue', label: 'Next Screening Due', type: 'date' },
    { key: 'patientEducated', label: 'Reviewed screening recommendations with patient', type: 'checkbox' },
  ],
  GSD3: [
    { key: 'a1cValue', label: 'HbA1c Value (%)', type: 'number', required: true, column: 2, placeholder: '9.2' },
    { key: 'a1cDate', label: 'HbA1c Draw Date', type: 'date', required: true, column: 2 },
    { key: 'diabetesType', label: 'Diabetes Type', type: 'select',
      options: [
        { value: 't1', label: 'Type 1' },
        { value: 't2', label: 'Type 2' },
        { value: 'gestational', label: 'Gestational' },
      ] },
    { key: 'currentManagement', label: 'Current Management', type: 'radio',
      options: [
        { value: 'insulin', label: 'Insulin' },
        { value: 'oral', label: 'Oral agents' },
        { value: 'both', label: 'Insulin + oral agents' },
        { value: 'lifestyle', label: 'Lifestyle only' },
      ] },
    { key: 'planUpdated', label: 'Treatment plan updated at this visit?', type: 'radio', options: YES_NO, required: true },
    { key: 'notes', label: 'Additional Notes', type: 'text', placeholder: 'Enter notes' },
  ],
  DM: [
    { key: 'a1cValue', label: 'HbA1c Value (%)', type: 'number', required: true, column: 2, placeholder: '7.2' },
    { key: 'a1cDate', label: 'HbA1c Draw Date', type: 'date', required: true, column: 2 },
    { key: 'diabetesType', label: 'Diabetes Type', type: 'select', required: true, column: 2,
      options: [
        { value: 't1', label: 'Type 1' },
        { value: 't2', label: 'Type 2' },
        { value: 'gestational', label: 'Gestational' },
        { value: 'other', label: 'Other / Secondary' },
      ] },
    { key: 'currentManagement', label: 'Current Management', type: 'radio', required: true, column: 2,
      options: [
        { value: 'insulin', label: 'Insulin' },
        { value: 'oral', label: 'Oral agents' },
        { value: 'both', label: 'Insulin + oral agents' },
        { value: 'lifestyle', label: 'Lifestyle only' },
      ] },
    { key: 'lastEyeExamDate', label: 'Last Dilated Eye Exam Date', type: 'date', column: 2 },
    { key: 'lastFootExamDate', label: 'Last Comprehensive Foot Exam Date', type: 'date', column: 2 },
    { key: 'bpSystolic', label: 'Systolic BP (mmHg)', type: 'number', column: 2, placeholder: '128' },
    { key: 'bpDiastolic', label: 'Diastolic BP (mmHg)', type: 'number', column: 2, placeholder: '82' },
    { key: 'nephropathyScreened', label: 'Nephropathy screening completed (uACR/eGFR)?', type: 'radio', options: YES_NO, required: true },
    { key: 'planUpdated', label: 'Diabetes management plan updated at this visit?', type: 'radio', options: YES_NO, required: true },
    { key: 'counselingProvided', label: 'Diabetes self-management education/counseling provided', type: 'checkbox' },
    { key: 'notes', label: 'Additional Notes', type: 'text', placeholder: 'Enter clinical notes' },
  ],
  OMW: [
    { key: 'fractureDate', label: 'Fracture Date', type: 'date', required: true, column: 2 },
    { key: 'fractureSite', label: 'Fracture Site', type: 'select', required: true, column: 2,
      options: [
        { value: 'hip', label: 'Hip' },
        { value: 'spine', label: 'Spine' },
        { value: 'wrist', label: 'Wrist' },
        { value: 'other', label: 'Other' },
      ] },
    { key: 'bmdDone', label: 'BMD test completed?', type: 'radio', options: YES_NO, required: true },
    { key: 'bmdDate', label: 'BMD Test Date', type: 'date' },
    { key: 'pharmacotherapy', label: 'Pharmacotherapy started?', type: 'radio', options: YES_NO },
    { key: 'medicationName', label: 'Medication Name', type: 'text', placeholder: 'e.g., Alendronate 70mg weekly' },
  ],
  COL: [
    { key: 'modality', label: 'Screening Modality', type: 'select', required: true,
      options: [
        { value: 'fit', label: 'FIT (annually)' },
        { value: 'fit-dna', label: 'FIT-DNA / Cologuard (every 3y)' },
        { value: 'colonoscopy', label: 'Colonoscopy (every 10y)' },
        { value: 'sigmoidoscopy', label: 'Flexible sigmoidoscopy (every 5y)' },
        { value: 'ct-colonography', label: 'CT colonography (every 5y)' },
      ] },
    { key: 'screeningDate', label: 'Screening Date', type: 'date', required: true, column: 2 },
    { key: 'nextDue', label: 'Next Screening Due', type: 'date', column: 2 },
    { key: 'result', label: 'Result', type: 'select', required: true,
      options: [
        { value: 'negative', label: 'Negative' },
        { value: 'positive', label: 'Positive: follow-up needed' },
        { value: 'inconclusive', label: 'Inconclusive' },
      ] },
    { key: 'notes', label: 'Additional Notes', type: 'text' },
  ],
  KED: [
    { key: 'egfrValue', label: 'eGFR Value (mL/min/1.73m²)', type: 'number', required: true, column: 2, placeholder: '82' },
    { key: 'egfrDate', label: 'eGFR Test Date', type: 'date', required: true, column: 2 },
    { key: 'uacrValue', label: 'uACR Value (mg/g)', type: 'number', required: true, column: 2, placeholder: '14' },
    { key: 'uacrDate', label: 'uACR Test Date', type: 'date', required: true, column: 2 },
    { key: 'ckdStage', label: 'CKD Stage', type: 'select',
      options: [
        { value: 'no-ckd', label: 'No CKD' },
        { value: 'stage-1', label: 'Stage 1' },
        { value: 'stage-2', label: 'Stage 2' },
        { value: 'stage-3a', label: 'Stage 3a' },
        { value: 'stage-3b', label: 'Stage 3b' },
        { value: 'stage-4', label: 'Stage 4' },
        { value: 'stage-5', label: 'Stage 5' },
      ] },
    { key: 'nephrologyReferral', label: 'Nephrology referral placed?', type: 'radio', options: YES_NO },
  ],
  'COA-FS': [
    { key: 'assessmentDate', label: 'Assessment Date', type: 'date', required: true },
    { key: 'adlStatus', label: 'ADL Status', type: 'select', required: true, column: 2,
      options: [
        { value: 'independent', label: 'Independent' },
        { value: 'assistance', label: 'Requires assistance' },
        { value: 'dependent', label: 'Dependent' },
      ] },
    { key: 'iadlStatus', label: 'IADL Status', type: 'select', required: true, column: 2,
      options: [
        { value: 'independent', label: 'Independent' },
        { value: 'assistance', label: 'Requires assistance' },
        { value: 'dependent', label: 'Dependent' },
      ] },
    { key: 'cognitiveStatus', label: 'Cognitive Status', type: 'select',
      options: [
        { value: 'alert', label: 'Alert & oriented' },
        { value: 'mild', label: 'Mild impairment' },
        { value: 'moderate', label: 'Moderate impairment' },
        { value: 'severe', label: 'Severe impairment' },
      ] },
    { key: 'fallRisk', label: 'Fall risk identified?', type: 'radio', options: YES_NO },
    { key: 'notes', label: 'Additional Notes', type: 'text' },
  ],
  'COA-M': [
    { key: 'reviewDate', label: 'Medication Review Date', type: 'date', required: true, column: 2 },
    { key: 'medCount', label: 'Number of Medications', type: 'number', required: true, column: 2 },
    { key: 'anyChanges', label: 'Any changes made?', type: 'radio', options: YES_NO, required: true },
    { key: 'deprescribing', label: 'Deprescribing performed?', type: 'radio', options: YES_NO },
    { key: 'reconciledInEhr', label: 'Reconciled list posted to EHR', type: 'checkbox' },
    { key: 'notes', label: 'Notes', type: 'text' },
  ],
  BPD: [
    { key: 'bpDate', label: 'BP Reading Date', type: 'date', required: true, column: 2 },
    { key: 'systolic', label: 'Systolic (mmHg)', type: 'number', required: true, column: 2, placeholder: '128' },
    { key: 'diastolic', label: 'Diastolic (mmHg)', type: 'number', required: true, column: 2, placeholder: '82' },
    { key: 'position', label: 'Position', type: 'radio',
      options: [
        { value: 'sitting', label: 'Sitting' },
        { value: 'standing', label: 'Standing' },
        { value: 'supine', label: 'Supine' },
      ] },
    { key: 'method', label: 'Method', type: 'radio',
      options: [
        { value: 'manual', label: 'Manual' },
        { value: 'automated', label: 'Automated' },
      ] },
  ],
  CCS: [
    { key: 'screeningDate', label: 'Screening Date', type: 'date', required: true, column: 2 },
    { key: 'modality', label: 'Modality', type: 'select', required: true, column: 2,
      options: [
        { value: 'pap', label: 'Pap only' },
        { value: 'hpv', label: 'HPV only' },
        { value: 'cotest', label: 'Co-test (Pap + HPV)' },
      ] },
    { key: 'result', label: 'Result', type: 'select', required: true,
      options: [
        { value: 'normal', label: 'Normal' },
        { value: 'abnormal', label: 'Abnormal' },
        { value: 'insufficient', label: 'Insufficient sample' },
      ] },
    { key: 'nextDue', label: 'Next Screening Due', type: 'date' },
  ],
  CHL: [
    { key: 'screeningDate', label: 'Screening Date', type: 'date', required: true, column: 2 },
    { key: 'testType', label: 'Test Type', type: 'select', required: true, column: 2,
      options: [
        { value: 'urine-naat', label: 'Urine NAAT' },
        { value: 'vaginal-swab', label: 'Vaginal swab' },
        { value: 'other', label: 'Other' },
      ] },
    { key: 'result', label: 'Result', type: 'radio', required: true,
      options: [
        { value: 'negative', label: 'Negative' },
        { value: 'positive', label: 'Positive' },
      ] },
    { key: 'treatmentGiven', label: 'Treatment provided?', type: 'radio', options: YES_NO },
  ],
  'CIS-CMB10': [
    { key: 'assessmentDate', label: 'Assessment Date', type: 'date', required: true },
    { key: 'upToDate', label: 'All required immunizations up to date?', type: 'radio', options: YES_NO, required: true },
    { key: 'missingCount', label: 'Number of Missing Immunizations', type: 'number', column: 2 },
    { key: 'catchupDate', label: 'Catch-up Plan Date', type: 'date', column: 2 },
    { key: 'catchupPlan', label: 'Catch-up Plan', type: 'text', placeholder: 'e.g., DTaP #4 at next visit' },
  ],
  COB: [
    { key: 'assessmentDate', label: 'Assessment Date', type: 'date', required: true, column: 2 },
    { key: 'bmiValue', label: 'BMI', type: 'number', required: true, column: 2, placeholder: '24.5' },
    { key: 'bmiCategory', label: 'BMI Category', type: 'select',
      options: [
        { value: 'underweight', label: 'Underweight (<18.5)' },
        { value: 'normal', label: 'Normal (18.5–24.9)' },
        { value: 'overweight', label: 'Overweight (25–29.9)' },
        { value: 'obese', label: 'Obese (≥30)' },
      ] },
    { key: 'weightCounseling', label: 'Weight counseling provided?', type: 'radio', options: YES_NO },
  ],
  DEV: [
    { key: 'screeningDate', label: 'Screening Date', type: 'date', required: true, column: 2 },
    { key: 'toolUsed', label: 'Tool Used', type: 'select', required: true, column: 2,
      options: [
        { value: 'asq3', label: 'ASQ-3' },
        { value: 'asq-se', label: 'ASQ:SE-2' },
        { value: 'mchat-r', label: 'M-CHAT-R' },
        { value: 'peds', label: 'PEDS' },
        { value: 'other', label: 'Other standardized tool' },
      ] },
    { key: 'score', label: 'Score', type: 'text', placeholder: 'e.g., 45' },
    { key: 'result', label: 'Result', type: 'select', required: true,
      options: [
        { value: 'typical', label: 'Typical development' },
        { value: 'at-risk', label: 'At risk: monitor' },
        { value: 'concern', label: 'Concern: refer' },
      ] },
    { key: 'referral', label: 'Referral placed?', type: 'radio', options: YES_NO },
  ],
  IMACMB2: [
    { key: 'assessmentDate', label: 'Assessment Date', type: 'date', required: true },
    { key: 'meningococcal', label: 'Meningococcal complete?', type: 'radio', options: YES_NO, required: true, column: 2 },
    { key: 'tdap', label: 'Tdap complete?', type: 'radio', options: YES_NO, required: true, column: 2 },
    { key: 'hpv', label: 'HPV complete?', type: 'radio', options: YES_NO, required: true },
    { key: 'catchupPlan', label: 'Missing Vaccine Plan', type: 'text', placeholder: 'Enter catch-up plan' },
  ],
  // LSC (Phase 2): the Coordinator documents a capillary blood lead test
  // the phlebotomist performed. Result follows Result Value (derive), and
  // the matching care plan block shows off Result (showWhen). Rules live in
  // src/lib/noteTemplateRules.js. Care plan copy is verbatim from Astrana.
  LSC: [
    { key: 'location', label: 'Location', type: 'radio', required: true, consentWhen: 'telehealth',
      options: [
        { value: 'telehealth', label: 'Telehealth visit' },
        { value: 'outpatient', label: 'Outpatient visit' },
        { value: 'clinic', label: 'Clinic' },
        { value: 'home', label: 'Home' },
      ] },
    { key: 'performedBy', label: 'Performed by', type: 'user-select', role: 'Phlebotomist',
      required: true, placeholder: 'Select from these Phlebotomists' },
    { key: 'procedurePerformed', label: 'Procedure Performed', type: 'checkbox', required: true,
      checkboxLabel: 'Meridian Leadcare II – Capillary Blood Lead Test' },
    { key: 'resultValue', label: 'Result Value', type: 'number', unit: 'mcg/dL', required: true, placeholder: 'Enter value' },
    { key: 'result', label: 'Result', type: 'radio', required: true, readOnly: true,
      description: 'Selected automatically from Result Value.',
      derive: { from: 'resultValue', threshold: 3.5, below: 'negative', atOrAbove: 'positive' },
      options: [
        { value: 'negative', label: 'If <3.5 (Negative result)' },
        { value: 'positive', label: 'If ≥3.5 (Positive result)' },
      ] },
    { key: 'carePlanNegative', type: 'content', title: 'Care plan for values <3.5',
      showWhen: { field: 'result', equals: 'negative' },
      bullets: [
        'Provided lead exposure prevention with parent/caregiver.',
        'Provided potential environmental sources of lead exposure and measures to reduce exposure, including handwashing, wet cleaning of household surfaces, avoidance of lead-containing products, and ensuring adequate dietary iron and calcium intake.',
        'Reinforced continue routine preventive care with parent/caregiver and has no further questions.',
        'May follow-up with PCP in 2 weeks if needed. Result will be communicated to PCP office.',
      ] },
    { key: 'carePlanPositive', type: 'content', title: 'Care Plan for values >=3.5',
      showWhen: { field: 'result', equals: 'positive' },
      bullets: [
        'Positive capillary blood lead screening reviewed with parent/caregiver. Confirmatory venous blood lead test is required, and a lab requisition order will be sent directly to the laboratory.',
        'Provided lead exposure prevention and reviewed potential environmental sources of lead exposure and measures to reduce exposure, including handwashing, wet cleaning of household surfaces, avoidance of lead-containing products, and ensuring adequate dietary iron and calcium intake.',
        'Follow-up will occur after venous blood lead results are available. Care team will reach out to parent/caregiver in 2 weeks for follow-up.',
        'Reinforced continue routine preventive care with parent/caregiver and has no further questions.',
        'Follow-up with PCP if needed. Result will be communicated to PCP office.',
        'Parent/caregiver understands the importance of timely confirmatory testing and agrees with the plan.',
      ] },
  ],
  POLYACH: [
    { key: 'reviewDate', label: 'Review Date', type: 'date', required: true, column: 2 },
    { key: 'anticholinergicCount', label: 'Number of anticholinergic medications', type: 'number', required: true, column: 2 },
    { key: 'deprescribingAttempted', label: 'Deprescribing attempted?', type: 'radio', options: YES_NO, required: true },
    { key: 'deprescribedMeds', label: 'Deprescribed Medications', type: 'text', placeholder: 'e.g., Diphenhydramine 25mg' },
    { key: 'patientEducated', label: 'Patient educated on anticholinergic risks', type: 'checkbox' },
  ],
  PPC1A: [
    { key: 'firstVisitDate', label: 'First Prenatal Visit Date', type: 'date', required: true, column: 2 },
    { key: 'trimester', label: 'Trimester at First Visit', type: 'select', required: true, column: 2,
      options: [
        { value: '1st', label: '1st trimester' },
        { value: '2nd', label: '2nd trimester' },
        { value: '3rd', label: '3rd trimester' },
      ] },
    { key: 'edd', label: 'Estimated Due Date', type: 'date', column: 2 },
    { key: 'provider', label: 'Provider', type: 'text', placeholder: 'Enter provider name', column: 2 },
  ],
  PPC2A: [
    { key: 'deliveryDate', label: 'Delivery Date', type: 'date', required: true, column: 2 },
    { key: 'visitDate', label: 'Postpartum Visit Date', type: 'date', required: true, column: 2 },
    { key: 'daysBetween', label: 'Days Delivery → Visit', type: 'number', column: 2 },
    { key: 'depressionScreen', label: 'Depression screening completed?', type: 'radio', options: YES_NO, column: 2 },
    { key: 'contraceptionCounseling', label: 'Contraception counseling provided?', type: 'radio', options: YES_NO },
  ],
  SUPD: [
    { key: 'prescriptionDate', label: 'Prescription Date', type: 'date', required: true, column: 2 },
    { key: 'statinName', label: 'Statin Name', type: 'text', required: true, column: 2, placeholder: 'e.g., Atorvastatin 40mg' },
    { key: 'intensity', label: 'Statin Intensity', type: 'select', required: true,
      options: [
        { value: 'low', label: 'Low intensity' },
        { value: 'moderate', label: 'Moderate intensity' },
        { value: 'high', label: 'High intensity' },
      ] },
    { key: 'adherenceAssessed', label: 'Adherence assessed?', type: 'radio', options: YES_NO },
  ],
  TRCEA: [
    { key: 'dischargeDate', label: 'Discharge Date', type: 'date', required: true, column: 2 },
    { key: 'engagementDate', label: 'Engagement Date', type: 'date', required: true, column: 2 },
    { key: 'engagementType', label: 'Engagement Type', type: 'select', required: true,
      options: [
        { value: 'in-person', label: 'In-person visit' },
        { value: 'phone', label: 'Phone call' },
        { value: 'video', label: 'Video visit' },
        { value: 'home', label: 'Home visit' },
      ] },
    { key: 'provider', label: 'Provider', type: 'text', placeholder: 'Enter provider name' },
  ],
  TRCMA: [
    { key: 'dischargeDate', label: 'Discharge Date', type: 'date', required: true, column: 2 },
    { key: 'reconciliationDate', label: 'Reconciliation Date', type: 'date', required: true, column: 2 },
    { key: 'medsReconciled', label: 'Medications reconciled?', type: 'radio', options: YES_NO, required: true },
    { key: 'discrepancies', label: 'Discrepancies Identified', type: 'text', placeholder: 'Describe any discrepancies' },
    { key: 'provider', label: 'Reconciling Provider', type: 'text', placeholder: 'Enter provider name' },
  ],
  W30A: [
    { key: 'visitDate', label: 'Visit Date', type: 'date', required: true, column: 2 },
    { key: 'ageAtVisit', label: 'Age at Visit', type: 'text', column: 2, placeholder: 'e.g., 4 months' },
    { key: 'visitNumber', label: 'Visit Number in Period', type: 'number', column: 2 },
    { key: 'provider', label: 'Provider', type: 'text', required: true, column: 2, placeholder: 'Enter provider name' },
    { key: 'anticipatoryGuidance', label: 'Anticipatory guidance provided', type: 'checkbox' },
  ],
  W30B: [
    { key: 'visitDate', label: 'Visit Date', type: 'date', required: true, column: 2 },
    { key: 'ageAtVisit', label: 'Age at Visit', type: 'text', column: 2, placeholder: 'e.g., 18 months' },
    { key: 'visitNumber', label: 'Visit Number in Period', type: 'number', column: 2 },
    { key: 'provider', label: 'Provider', type: 'text', required: true, column: 2, placeholder: 'Enter provider name' },
    { key: 'devScreeningCompleted', label: 'Developmental screening completed?', type: 'radio', options: YES_NO },
  ],
  WCV: [
    { key: 'visitDate', label: 'Visit Date', type: 'date', required: true, column: 2 },
    { key: 'provider', label: 'Provider', type: 'text', required: true, column: 2, placeholder: 'Enter provider name' },
    { key: 'bmiDocumented', label: 'BMI or BMI percentile documented?', type: 'radio', options: YES_NO },
    { key: 'guidanceTopics', label: 'Anticipatory Guidance Topics', type: 'text', placeholder: 'e.g., nutrition, physical activity, safety' },
  ],
  APE: [
    { key: 'visitDate', label: 'Visit Date', type: 'date', required: true, column: 2 },
    { key: 'provider', label: 'Provider', type: 'text', required: true, column: 2, placeholder: 'Enter provider name' },
    { key: 'bmi', label: 'BMI', type: 'number', column: 2, placeholder: '24.5' },
    { key: 'bp', label: 'Blood Pressure', type: 'text', column: 2, placeholder: '124/78' },
    { key: 'screeningsOffered', label: 'Screenings Offered', type: 'text', placeholder: 'e.g., colorectal, depression, tobacco use' },
  ],
  FMC: [
    { key: 'edDischargeDate', label: 'ED Discharge Date', type: 'date', required: true },
    { key: 'sevenDayFollowUp', label: '7-day follow-up completed?', type: 'radio', options: YES_NO, required: true, column: 2 },
    { key: 'sevenDayDate', label: '7-day Follow-up Date', type: 'date', column: 2 },
    { key: 'thirtyDayFollowUp', label: '30-day follow-up completed?', type: 'radio', options: YES_NO, required: true, column: 2 },
    { key: 'thirtyDayDate', label: '30-day Follow-up Date', type: 'date', column: 2 },
    { key: 'provider', label: 'Follow-up Provider', type: 'text', placeholder: 'Enter provider name' },
  ],
  MRP: [
    { key: 'dischargeDate', label: 'Discharge Date', type: 'date', required: true, column: 2 },
    { key: 'reconciliationDate', label: 'Reconciliation Date', type: 'date', required: true, column: 2 },
    { key: 'medCount', label: 'Medications Reconciled', type: 'number', column: 2 },
    { key: 'provider', label: 'Reconciling Provider', type: 'text', required: true, column: 2, placeholder: 'Enter provider name' },
    { key: 'discrepancies', label: 'Discrepancies Identified', type: 'text', placeholder: 'Describe any discrepancies' },
  ],
};

// MANDATORY_FIELDS keeps CBP + EED's hand-crafted lists; everything under
// GAP_TEMPLATES derives its required fields from the template's `required`
// flags via `mandatoryFieldsFor` below.
export const MANDATORY_FIELDS = {
  EED: ['evidenceType', 'examType', 'examDate', 'examiningProvider', 'examResult', 'icd10', 'patientCounseledOn'],
  CBP: ['bpDate', 'systolic', 'diastolic', 'location'],
  // DSF-A / DSF-B: Location + telehealth consent (when telehealth) +
  // provider + a saved PHQ-2 score are the minimum before Submit for
  // Review. Date of Service is intentionally NOT listed here, it
  // lives on the note-level shared DOS card (v.dateOfService), not
  // in the per-gap payload, and useClinicalNotePanel's submit path
  // already blocks on a missing DOS. Location/consent/performedBy
  // stay per-gap, so they're what the isMandatoryComplete check reads.
  // DSF-B additionally needs a saved PHQ-9 score and the "All components
  // of care plan completed" acknowledgement, OR the standing Decline
  // checkbox (Decline short-circuits the sign-off queue entirely,
  // see plan Section 6).
  'DSF-A': ['location', 'telehealthConsent', 'performedBy', 'phq2ScoreSaved'],
  // DSF-B inherits visit context (Location / consent / provider) from
  // the paired DSF-A note that opened it, so those fields aren't asked
  // twice on the DSF-B surface. PHQ-9 completeness alone gates the
  // sign-off queue: the care plan panel is static reference text with
  // an optional Outreach Notes textarea, so it doesn't need its own
  // acknowledgement tick.
  'DSF-B': ['phq9ScoreSaved'],
};

function mandatoryFieldsFor(code, data) {
  if (MANDATORY_FIELDS[code]) return MANDATORY_FIELDS[code];
  return requiredKeys(GAP_TEMPLATES[code], data);
}

function defaultTemplateData(code) {
  const t = GAP_TEMPLATES[code];
  if (!t) return {};
  const out = { evidenceLabel: `${code} Evidence` };
  for (const f of t) {
    if (f.type === 'content') continue;
    out[f.key] = f.type === 'checkbox' ? false : '';
  }
  return out;
}

export function defaultGapData(code) {
  switch (code) {
    case 'CBP':
      return {
        evidenceLabel: 'CBP Evidence',
        bpDate: '',
        systolic: '',
        diastolic: '',
        location: '',
        selfMonitors: '',
        takingMeds: '',
        symptomsLow: '',
        symptomsMid: '',
        symptomsHigh: '',
      };
    case 'EED':
      return {
        evidenceLabel: 'EED Evidence',
        evidenceType: '',
        examType: '',
        examDate: '',
        examiningProvider: '',
        npi: '',
        examResult: '',
        laterality: '',
        icd10: '',
        followUp: { referOphthalmology: false, laserTreatment: false, antiVegf: false, annualScheduled: false },
        nextExamDue: '',
        patientCounseledOn: '',
      };
    case 'DSF-A':
      return {
        evidenceLabel: 'DSF-A Evidence',
        // Date of Service and telehealth consent live on the note-level
        // shared DOS card (v.dateOfService / v.audioOnly / v.audioVideo).
        // DSF-A only owns its Location radio + Performed by + PHQ-2.
        location: '',                    // 'telehealth' | 'home'
        performedBy: '',
        phq2: { item1: null, item2: null, totalScore: null, savedAt: null, locked: false, outcome: null },
        decline: false,
        carePlan: { allCompleted: false, outreachNotes: '' },
      };
    case 'DSF-B':
      return {
        evidenceLabel: 'DSF-B Evidence',
        location: '',
        performedBy: '',
        phq9: { items: [null, null, null, null, null, null, null, null, null], totalScore: null, band: null, subMildAnswer: null, savedAt: null, locked: false },
        decline: false,
        carePlan: { allCompleted: false, outreachNotes: '' },
      };
    default:
      return defaultTemplateData(code);
  }
}

// Derived-flag lookup used only by DSF-A / DSF-B where the "mandatory"
// entries are computed from nested payload state (telehealth consent is
// really "Location=Home OR audio-only/audio-video consent ticked in the
// shared DOS card"; phq2ScoreSaved reads the nested `phq2.locked`; etc.).
// Kept here so the derivation lives next to the MANDATORY_FIELDS list it
// feeds. `noteContext` carries the note-level audioOnly/audioVideo flags
// that the shared DOS card owns, DSF-A doesn't duplicate that block.
function dsfDerivedFlag(field, data, noteContext) {
  switch (field) {
    case 'telehealthConsent':
      return data.location === 'home'
        || !!noteContext?.audioOnly
        || !!noteContext?.audioVideo;
    case 'phq2ScoreSaved': {
      // Negative PHQ-2 (total < 3) has no explicit Save step so it
      // counts as scored once both items carry a numeric answer.
      // Positive PHQ-2 (total >= 3) MUST commit through the Save
      // Score button so the reviewer can't sign a note that hasn't
      // opened the paired DSF-B gap yet.
      const p = data.phq2 || {};
      if (p.item1 == null || p.item2 == null) return false;
      const total = Number(p.item1) + Number(p.item2);
      return total < 3 || !!p.savedAt;
    }
    case 'phq9ScoreSaved': {
      // Decline short-circuits the sign-off queue (see plan Section 6)
      // so a declined DSF-B counts as complete regardless of PHQ-9
      // state. Otherwise the reviewer needs all 9 items answered AND
      // the explicit Save Score commit that stamps `savedAt`. Without
      // requiring `savedAt`, Sign & Save unlocks the moment the last
      // radio is ticked, letting a reviewer sign a note whose score
      // was never committed to the record.
      if (data.decline) return true;
      const p = data.phq9 || {};
      const items = p.items || [];
      if (items.length !== 9 || !items.every(v => v != null)) return false;
      return !!p.savedAt;
    }
    default:
      return null; // caller falls back to the raw truthy check
  }
}

export function isMandatoryComplete(code, data, noteContext) {
  let req = mandatoryFieldsFor(code, data);
  // Standalone DSF-B (no paired DSF-A on the same note) has to collect
  // its own visit context: Location, Performed by, and the telehealth
  // consent that normally rides on the shared DOS card. The paired
  // flow keeps inheriting from the DSF-A carrier, so the base list
  // stays lean and only widens when this note is DSF-B-only.
  if (code === 'DSF-B') {
    const pairedCodes = noteContext?.activeGaps?.map(g => g.code) || [];
    const hasDsfA = pairedCodes.includes('DSF-A');
    if (!hasDsfA) {
      req = ['location', 'telehealthConsent', 'performedBy', ...req];
    }
  }
  if (!req.length || !data) return false;
  // Templated gaps with `consentWhen` (e.g. LSC Location = Telehealth)
  // need the shared DOS card's telehealth consent, like DSF-A.
  if (needsTelehealthConsent(GAP_TEMPLATES[code], data)
    && !noteContext?.audioOnly && !noteContext?.audioVideo) return false;
  const isDsf = code === 'DSF-A' || code === 'DSF-B';
  return req.every(f => {
    if (isDsf) {
      const derived = dsfDerivedFlag(f, data, noteContext);
      if (derived !== null) return derived;
    }
    return !!data[f];
  });
}

export function mergeSavedGapsIntoState(prev, gapsPayload, { includeManualOff = false } = {}) {
  const next = { ...prev };
  for (const [code, data] of Object.entries(gapsPayload || {})) {
    const patch = savedGapData(code, data);
    if (next[code] !== undefined) {
      next[code] = { ...next[code], ...patch };
    } else {
      next[code] = {
        ...(includeManualOff ? { manuallyOff: false } : {}),
        ...defaultGapData(code),
        ...patch,
      };
    }
  }
  return next;
}

export function mergeGapsFromNotes(prev, notes) {
  const next = { ...prev };
  const gapsSeen = new Set();
  for (const n of notes) {
    const gapsPayload = n.payload?.gaps;
    if (!gapsPayload) continue;
    for (const [code, data] of Object.entries(gapsPayload)) {
      if (gapsSeen.has(code)) continue;
      gapsSeen.add(code);
      if (next[code]) next[code] = { ...next[code], ...savedGapData(code, data) };
      else next[code] = { ...defaultGapData(code), ...savedGapData(code, data) };
    }
  }
  return next;
}

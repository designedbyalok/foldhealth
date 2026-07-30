// Confidence Score, Evidence Factors, and MEAT note data per ICD code.
// Ported from /Users/ketanp/Downloads/HCC/hcc_worklist_v2.tsx (lines 175–253).

export const CONFIDENCE_DATA = {
  'N18.32': { score: 85, status: 'Ready to Close', evidence: [
    { text: 'eGFR: 37 mL/min/1.73m² → 38 mL/min/1.73m²' },
    { text: 'UACR 115 mg/g (01/15/26) indicating macroalbuminuria.' },
    { text: 'Currently on lisinopril 20mg daily.' },
    { text: 'eGFR has remained stable between 38–42 over the past 14 months.' },
  ] },
  'E11.319': { score: 78, status: 'Ready to Close', evidence: [
    { text: 'HbA1c 8.4% (02/10/2026) — consistently above target.' },
    { text: 'Ophthalmology visit 01/20/2026: mild non-proliferative DR confirmed.' },
    { text: 'Currently on metformin 1000mg BID + insulin glargine 20U nightly.' },
    { text: 'Diabetic retinopathy noted in retinal imaging report.' },
  ] },
  'F32.1': { score: 72, status: 'High Confidence', evidence: [
    { text: 'PHQ-9 score 14 (01/25/2026) — moderate severity.' },
    { text: 'Patient on sertraline 100mg daily for 6+ months.' },
    { text: 'Psychiatry follow-up 12/15/2025: single episode confirmed.' },
    { text: 'DSM-5 criteria met per behavioral health note.' },
  ] },
  'I50.43': { score: 91, status: 'Ready to Close', evidence: [
    { text: 'Echo 01/08/2026: EF 30%, combined systolic and diastolic failure.' },
    { text: 'BNP 820 pg/mL (01/10/2026) — elevated, consistent with decompensation.' },
    { text: 'Carvedilol 12.5mg BID + lisinopril 10mg daily active.' },
    { text: 'Cardiology note 01/12/2026 documents acute-on-chronic exacerbation.' },
  ] },
  'G47.33': { score: 80, status: 'Ready to Close', evidence: [
    { text: 'Sleep study (12/20/2025): AHI 28 events/hr — moderate-severe OSA.' },
    { text: 'CPAP therapy initiated, compliance report 72% usage.' },
    { text: 'BMI 34.2 — risk factor documented in chart.' },
    { text: 'Pulmonology referral note confirms ongoing active diagnosis.' },
  ] },
};

const DEFAULT_CONFIDENCE = {
  score: 70,
  status: 'High Confidence',
  evidence: [
    { text: 'Diagnosis documented in most recent clinical note.' },
    { text: 'Active medication consistent with condition.' },
    { text: 'Follow-up appointment scheduled for ongoing management.' },
  ],
};

export const getConfidence = (code) => CONFIDENCE_DATA[code] || DEFAULT_CONFIDENCE;

/**
 * DB-preferring variant of getConfidence — pass the `hccGapConfidence`
 * store slice (a { code: { score, status, evidence, factors, meatNote } }
 * map) as `dbMap`. Returns the DB row when the code is seeded, otherwise
 * falls back to the JS mock. This lets IcdRow read a single source that
 * works while the seed rolls out to every environment.
 */
export const getConfidenceFromDb = (dbMap, code) => {
  const hit = dbMap?.[code];
  if (hit && (Array.isArray(hit.evidence) && hit.evidence.length)) return hit;
  return CONFIDENCE_DATA[code] || DEFAULT_CONFIDENCE;
};

/**
 * Deterministic per-field confidence score for an encounter.
 *
 * Real OCR returns a confidence per extracted field. The mock produces
 * a stable score in [50, 99] by hashing (patientName, dos, fieldName)
 * so the same field on the same encounter always reads the same value
 * across renders (and across reloads given identical input).
 *
 * Fields that come back missing (errors[]) get a 0 so the tier chip
 * flips to Low.
 */
export function getFieldConfidence(enc, fieldName) {
  const errors = enc?.errors || [];
  // Map UI field name → the error key used by mockOcr.annotateErrors.
  const ERROR_KEY = { dos: 'dos', provider: 'provider', pos: 'pos', dob: 'dob' };
  const errKey = ERROR_KEY[fieldName];
  if (errKey && errors.includes(errKey)) return 0;

  const key = `${enc?.patient?.name || ''}|${enc?.dos || ''}|${fieldName}`;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) & 0xffffffff;
  const ah = Math.abs(h);
  const bucket = ah % 10;
  // ~55% high, ~30% medium, ~15% low — matches the per-encounter
  // distribution in mockOcr.gradedMatchConfidence so the two views feel
  // visually consistent.
  if (bucket < 5) return 85 + (ah % 15);          // 85-99
  if (bucket < 8) return 65 + ((ah >> 4) % 20);   // 65-84
  return 50 + ((ah >> 8) % 12);                    // 50-61
}

/**
 * Score-tier color mapping. Higher confidence → success green; mid → amber;
 * lower → secondary orange; sub-35 → muted grey.
 */
export function getScoreStyle(score) {
  // Amber/orange tiers use dark text — white on brand-yellow/orange fails WCAG AA.
  if (score >= 75) return { color: 'var(--neutral-0)',   bg: 'var(--status-success)', label: 'Auto-Surface' };
  if (score >= 55) return { color: 'var(--neutral-500)', bg: 'var(--status-warning)', label: 'Clinical Review' };
  if (score >= 35) return { color: 'var(--neutral-500)', bg: 'var(--secondary-300)',  label: 'Batch Review' };
  return                 { color: 'var(--neutral-0)',   bg: 'var(--neutral-200)',    label: 'Suppressed' };
}

// ── Evidence-scoring factor bars (for the confidence drill-down panel) ──
const DEFAULT_FACTORS = [
  { label: 'Confidence Base',   value: 40, color: '#8C5AE2' },
  { label: 'Evidence Strength', value: 70, color: '#8C5AE2' },
  { label: 'Recency Decay',     value: 20, color: '#8C5AE2' },
  { label: 'Fold-Unique',       value: 24, color: '#1E9DAE' },
  { label: 'Med Stacking',      value: 30, color: '#1E9DAE' },
  { label: 'LLM Evidence',      value: 25, color: '#D9A50B' },
  { label: 'Comorbidity',       value: 20, color: '#8C5AE2' },
];

export const EVIDENCE_FACTORS = {
  'E11.22':  [ {label:'Confidence Base',value:42,color:'#8C5AE2'}, {label:'Evidence Strength',value:78,color:'#8C5AE2'}, {label:'Recency Decay',value:18,color:'#8C5AE2'}, {label:'Fold-Unique',value:26,color:'#1E9DAE'}, {label:'Med Stacking',value:34,color:'#1E9DAE'}, {label:'LLM Evidence',value:30,color:'#D9A50B'}, {label:'Comorbidity',value:22,color:'#8C5AE2'} ],
  'G47.33':  [ {label:'Confidence Base',value:38,color:'#8C5AE2'}, {label:'Evidence Strength',value:65,color:'#8C5AE2'}, {label:'Recency Decay',value:22,color:'#8C5AE2'}, {label:'Fold-Unique',value:30,color:'#1E9DAE'}, {label:'Med Stacking',value:28,color:'#1E9DAE'}, {label:'LLM Evidence',value:20,color:'#D9A50B'}, {label:'Comorbidity',value:18,color:'#8C5AE2'} ],
  'I48.91':  [ {label:'Confidence Base',value:50,color:'#8C5AE2'}, {label:'Evidence Strength',value:82,color:'#8C5AE2'}, {label:'Recency Decay',value:14,color:'#8C5AE2'}, {label:'Fold-Unique',value:20,color:'#1E9DAE'}, {label:'Med Stacking',value:40,color:'#1E9DAE'}, {label:'LLM Evidence',value:35,color:'#D9A50B'}, {label:'Comorbidity',value:28,color:'#8C5AE2'} ],
  'I50.23':  [ {label:'Confidence Base',value:55,color:'#8C5AE2'}, {label:'Evidence Strength',value:88,color:'#8C5AE2'}, {label:'Recency Decay',value:12,color:'#8C5AE2'}, {label:'Fold-Unique',value:22,color:'#1E9DAE'}, {label:'Med Stacking',value:45,color:'#1E9DAE'}, {label:'LLM Evidence',value:40,color:'#D9A50B'}, {label:'Comorbidity',value:32,color:'#8C5AE2'} ],
  'J45.50':  [ {label:'Confidence Base',value:35,color:'#8C5AE2'}, {label:'Evidence Strength',value:60,color:'#8C5AE2'}, {label:'Recency Decay',value:20,color:'#8C5AE2'}, {label:'Fold-Unique',value:18,color:'#1E9DAE'}, {label:'Med Stacking',value:25,color:'#1E9DAE'}, {label:'LLM Evidence',value:22,color:'#D9A50B'}, {label:'Comorbidity',value:15,color:'#8C5AE2'} ],
};

export const getEvidenceFactors = (code) => EVIDENCE_FACTORS[code] || DEFAULT_FACTORS;

export const getEvidenceFactorsFromDb = (dbMap, code) => {
  const hit = dbMap?.[code];
  if (hit && Array.isArray(hit.factors) && hit.factors.length) return hit.factors;
  return EVIDENCE_FACTORS[code] || DEFAULT_FACTORS;
};

// ── MEAT (Monitor / Evaluate / Assess / Treat) summary per ICD ────────────
export const MEAT_NOTE_DATA = {
  'N18.32': 'CKD Stage 3b (N18.32) is actively managed with quarterly labs and nephrology follow-up. Most recent eGFR 37 mL/min, creatinine 2.0 mg/dL, UACR 115 mg/g (01/15/2026), reflecting slow progressive decline with macroalbuminuria. Assessed as high risk for progression given diabetes and declining eGFR trajectory, continued on lisinopril 20mg daily for renoprotection. CMP repeated every 3 months.',
  'E11.319': 'Type 2 DM with diabetic retinopathy (E11.319) is monitored with annual ophthalmology visits and quarterly HbA1c checks. Most recent HbA1c 8.4% (02/10/2026). Ophthalmology confirmed mild non-proliferative retinopathy on 01/20/2026 retinal imaging. Current regimen: metformin 1000mg BID, insulin glargine 20U nightly. Patient counseled on glucose control and eye care adherence.',
  'F32.1': 'Major Depressive Disorder, single episode, moderate (F32.1) managed with pharmacotherapy and outpatient behavioral health follow-up. PHQ-9 score 14 as of 01/25/2026. Patient on sertraline 100mg daily with reported partial response. Psychiatry last seen 12/15/2025, noted stable mood with residual low energy. No suicidal ideation. Next follow-up scheduled in 4 weeks.',
  'I50.43': 'Acute-on-chronic combined systolic and diastolic heart failure (I50.43) actively managed by cardiology. Echo 01/08/2026 shows EF 30% with biventricular dysfunction. BNP 820 pg/mL on 01/10/2026. Patient admitted briefly for decompensation and stabilized. Current regimen: carvedilol 12.5mg BID, lisinopril 10mg, furosemide 40mg daily. Daily weight monitoring in place.',
  'G47.33': 'Obstructive sleep apnea, moderate-severe (G47.33) confirmed by polysomnography 12/20/2025 with AHI 28/hr. CPAP therapy initiated with 72% compliance. BMI 34.2 contributing to airway obstruction. Pulmonology follow-up scheduled. Patient reports improved daytime alertness with CPAP use. No hypoxic events recorded in last 30 days per CPAP device data.',
};

export const getMeatNote = (code, desc) =>
  MEAT_NOTE_DATA[code] ||
  `${desc} is being actively monitored and managed. Diagnosis supported by clinical documentation and current treatment plan. Patient is adherent to prescribed therapy with scheduled follow-up. Condition assessed as stable with ongoing management per care team recommendation.`;

export const getMeatNoteFromDb = (dbMap, code, desc) => {
  const hit = dbMap?.[code];
  if (hit?.meatNote) return hit.meatNote;
  return getMeatNote(code, desc);
};

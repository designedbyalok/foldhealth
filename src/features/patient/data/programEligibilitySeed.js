/* Program eligibility (care management redesign prototype, Eligible
   Programs): what Unity found when it checked a patient's problem list, labs,
   payer rules and consents against the programs they aren't in. One row per
   patient and program, from program_eligibility
   (supabase/program_eligibility_migration.sql); these are the same rows, used
   until the table is seeded. `fit`: 'eligible' or 'check' (needs a person to
   confirm). Consent and "already enrolled" are worked out live. */

export const PROGRAM_ELIGIBILITY = [
  {
    id: 'pe-11143-DM', memberId: '11143', code: 'DM', fit: 'eligible',
    why: 'Heart failure with a recent admission (St. Mary Hospital, discharged 11/08) and CKD stage 3b. Disease Management adds the CHF and kidney assessments.',
  },
  {
    id: 'pe-11143-HICM', memberId: '11143', code: 'HICM', fit: 'check',
    why: 'High-risk discharge score and weight up 4 lb in 3 days. HICM needs 2 admissions in 12 months; only this one is on file, so confirm with Dr. L. Chen.',
  },
  {
    id: 'pe-11143-AWV', memberId: '11143', code: 'AWV', fit: 'eligible',
    why: 'No Annual Wellness Visit on file for 2026. Medicare covers one every 12 months.',
  },
  {
    id: 'pe-11089-TOC-ED', memberId: '11089', code: 'TOC ED', fit: 'eligible',
    why: 'ED visit for chest pain at City Medical ER on 11/10 (ACS ruled out). TOC ED covers the 7-day follow-up and the new ER medications.',
  },
  {
    id: 'pe-11089-PHARM', memberId: '11089', code: 'PHARM', fit: 'eligible',
    why: 'Started aspirin and nitroglycerin in the ER on top of lisinopril and metformin. A pharmacist review checks the new list and how she takes them.',
  },
];

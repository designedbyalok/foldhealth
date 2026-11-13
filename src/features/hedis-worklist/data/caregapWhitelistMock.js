// Care gaps whitelisted on Fold: the only measures a user can add to a
// patient from the HEDIS worklist, and the only ones Fold bills for.
// Whitelisting itself is managed outside Fold (out of scope here).
// Mirrors supabase/caregap_whitelist_migration.sql; `bun run seed` upserts it.
//
// `ipas` / `hpCodes` scope a measure to specific contracts; an empty list
// means it applies to every IPA / HP code.

const MEASURES = [
  { code: 'CBP',   name: 'Controlling Blood Pressure' },
  { code: 'COL',   name: 'Colorectal Cancer Screening' },
  { code: 'BCS',   name: 'Breast Cancer Screening' },
  { code: 'COA-FS', name: 'Care for Older Adults: Functional Status' },
  { code: 'COA-M', name: 'Care for Older Adults: Medication Review' },
  { code: 'EED',   name: 'Eye Exam for Patients With Diabetes' },
  { code: 'KED',   name: 'Kidney Health Evaluation' },
  { code: 'GSD3',  name: 'Glycemic Status Assessment (HbA1c > 9%)' },
  { code: 'OMW',   name: 'Osteoporosis Management in Women', ipas: ['CFC', 'LA Care', 'Astrana'] },
  { code: 'SUPD',  name: 'Statin Use in Persons with Diabetes', hpCodes: ['HP-001', 'HP-002'] },
  { code: 'TRCMA', name: 'Transitions of Care: Med Reconciliation', ipas: ['IPA-North', 'IPA-West'] },
  { code: 'DSF-A', name: 'Depression Screening (PHQ-2)' },
];

export const MEASURE_YEARS = [2027, 2026, 2025, 2024];

// Measure years a user can add a gap to on `today`: the current year and the
// two before it, plus the next year from October (payers start sending next
// year's gaps then).
export function openMeasureYears(today = new Date()) {
  const year = today.getFullYear();
  const years = [year, year - 1, year - 2];
  if (today.getMonth() + 1 >= 10) years.unshift(year + 1);
  return years;
}

export const CAREGAP_WHITELIST_MOCK = MEASURE_YEARS.flatMap(year =>
  MEASURES
    // TRCMA was whitelisted starting MY2026.
    .filter(m => !(m.code === 'TRCMA' && year < 2026))
    .map(m => ({
      id: `${m.code}-MY${year}`,
      code: m.code,
      name: m.name,
      measureYear: year,
      ipas: m.ipas || [],
      hpCodes: m.hpCodes || [],
      billable: true,
    })),
);

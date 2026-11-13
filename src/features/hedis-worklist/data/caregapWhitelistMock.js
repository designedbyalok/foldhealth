// Care gaps whitelisted on Fold: the only measures a user can add to a
// patient from the HEDIS worklist.
// Whitelisting itself is managed outside Fold (out of scope here).
// Mirrors supabase/caregap_whitelist_migration.sql; `bun run seed` upserts it.
//
// `ipas` / `hpCodes` scope a measure to specific contracts; an empty list
// means it applies to every IPA / HP code.
//
// `sex` and `ageMin` / `ageMax` are who the measure applies to (HEDIS
// denominator, age as of Dec 31 of the measure year), so Add Care Gaps never
// offers BCS for a male patient. Diagnosis-based denominators (diabetes for
// EED, KED, GSD3, SUPD) aren't checked here.

const MEASURES = [
  { code: 'CBP',   name: 'Controlling Blood Pressure', ageMin: 18, ageMax: 85 },
  { code: 'COL',   name: 'Colorectal Cancer Screening', ageMin: 45, ageMax: 75 },
  { code: 'BCS',   name: 'Breast Cancer Screening', sex: 'F', ageMin: 40, ageMax: 74 },
  { code: 'COA-FS', name: 'Care for Older Adults: Functional Status', ageMin: 66 },
  { code: 'COA-M', name: 'Care for Older Adults: Medication Review', ageMin: 66 },
  { code: 'EED',   name: 'Eye Exam for Patients With Diabetes', ageMin: 18, ageMax: 75 },
  { code: 'KED',   name: 'Kidney Health Evaluation', ageMin: 18, ageMax: 85 },
  { code: 'GSD3',  name: 'Glycemic Status Assessment (HbA1c > 9%)', ageMin: 18, ageMax: 75 },
  { code: 'OMW',   name: 'Osteoporosis Management in Women', sex: 'F', ageMin: 67, ageMax: 85, ipas: ['CFC', 'LA Care', 'Astrana'] },
  { code: 'SUPD',  name: 'Statin Use in Persons with Diabetes', ageMin: 40, ageMax: 75, hpCodes: ['HP-001', 'HP-002'] },
  { code: 'TRCMA', name: 'Transitions of Care: Med Reconciliation', ageMin: 18, ipas: ['IPA-North', 'IPA-West'] },
  { code: 'DSF-A', name: 'Depression Screening (PHQ-2)', ageMin: 12 },
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
      sex: m.sex || null,
      ageMin: m.ageMin ?? null,
      ageMax: m.ageMax ?? null,
      billable: true,
    })),
);

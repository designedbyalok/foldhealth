/**
 * CMS Place of Service (POS) code set: the standard US POS codes used on
 * professional claims (CMS POS code set, maintained by the National Uniform
 * Claim Committee). Source of truth for every POS dropdown in the HCC flows;
 * also seeded into the Supabase `pos_codes` table via `bun run seed`.
 *
 * Names are the FoldHealth short labels, the full CMS descriptions read as
 * legal sentences that don't fit column cells or dropdown rows. See
 * `docs/features/hcc-coding-workflow.md` for the canonical short-name policy.
 */
export const POS_CODES = [
  { code: '01', name: 'Pharmacy' },
  { code: '02', name: 'Telehealth (Other)' },
  { code: '03', name: 'School' },
  { code: '04', name: 'Homeless Shelter' },
  { code: '05', name: 'IHS Freestanding' },
  { code: '06', name: 'IHS Provider-Based' },
  { code: '07', name: 'Tribal 638 Freestanding' },
  { code: '08', name: 'Tribal 638 Provider-Based' },
  { code: '09', name: 'Correctional Facility' },
  { code: '10', name: 'Telehealth (Home)' },
  { code: '11', name: 'Office' },
  { code: '12', name: 'Home' },
  { code: '13', name: 'ALF' },
  { code: '14', name: 'Group Home' },
  { code: '15', name: 'Mobile Unit' },
  { code: '16', name: 'Temp Lodging' },
  { code: '17', name: 'Retail Clinic' },
  { code: '18', name: 'Worksite' },
  { code: '19', name: 'Off-Campus OP Hospital' },
  { code: '20', name: 'Urgent Care' },
  { code: '21', name: 'Inpatient Hospital' },
  { code: '22', name: 'On-Campus OP Hospital' },
  { code: '23', name: 'ER: Hospital' },
  { code: '24', name: 'ASC' },
  { code: '25', name: 'Birthing Center' },
  { code: '26', name: 'MTF' },
  { code: '27', name: 'Outreach/Street' },
  { code: '31', name: 'SNF' },
  { code: '32', name: 'Nursing Facility' },
  { code: '33', name: 'Custodial Care' },
  { code: '34', name: 'Hospice' },
  { code: '41', name: 'Ambulance (Land)' },
  { code: '42', name: 'Ambulance (Air/Water)' },
  { code: '49', name: 'Independent Clinic' },
  { code: '50', name: 'FQHC' },
  { code: '51', name: 'Inpatient Psych' },
  { code: '52', name: 'Psych Partial Hosp' },
  { code: '53', name: 'CMHC' },
  { code: '54', name: 'ICF/IID' },
  { code: '55', name: 'Residential SA Treatment' },
  { code: '56', name: 'PRTC' },
  { code: '57', name: 'Non-Res SA Treatment' },
  { code: '58', name: 'Non-Res Opioid Treatment' },
  { code: '60', name: 'Mass Immunization' },
  { code: '61', name: 'CIRF' },
  { code: '62', name: 'CORF' },
  { code: '65', name: 'ESRD Facility' },
  { code: '66', name: 'PACE Center' },
  { code: '71', name: 'Public Health Clinic' },
  { code: '72', name: 'RHC' },
  { code: '81', name: 'Independent Lab' },
  { code: '99', name: 'Other' },
];

/** Options shaped for the shared <Select searchable>, `11 - Office`. */
export const POS_SELECT_OPTIONS = POS_CODES.map(({ code, name }) => ({
  value: code,
  label: `${code} - ${name}`,
  searchText: `${code} ${name}`,
}));

export const posLabel = (code) => {
  const hit = POS_CODES.find((p) => p.code === code);
  return hit ? `${hit.code} - ${hit.name}` : code || '';
};

/** Quick short-name lookup by code, e.g. `posName('23')` → `'ER: Hospital'`. */
export const posName = (code) => POS_CODES.find((p) => p.code === code)?.name || '';

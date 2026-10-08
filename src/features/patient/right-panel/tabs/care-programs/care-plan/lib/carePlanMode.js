/**
 * Where an org keeps its care plans (org_settings.care_plan_mode).
 *
 *   program  each care program's Care Plan step holds the plan (default)
 *   patient  one patient-level plan in Care Management > Care Plan; the
 *            program Care Plan step is hidden
 *   both     program plans, plus an editable patient-level roll-up of them
 */
export const CARE_PLAN_MODES = [
  {
    value: 'program',
    label: 'Program level',
    hint: 'Each care program has its own care plan, in its Care Plan step.',
  },
  {
    value: 'patient',
    label: 'Patient level',
    hint: 'One care plan per patient, in Care Management > Care Plan. Program Care Plan steps are hidden.',
  },
  {
    value: 'both',
    label: 'Program and patient level',
    hint: 'Programs keep their care plans, and Care Management > Care Plan edits all of them in one place.',
  },
];

export const DEFAULT_CARE_PLAN_MODE = 'program';

export function normalizeCarePlanMode(value) {
  return CARE_PLAN_MODES.some(m => m.value === value) ? value : DEFAULT_CARE_PLAN_MODE;
}

/** The program Care Plan step is shown unless the org plans at patient level only. */
export const showsProgramCarePlan = (mode) => mode !== 'patient';

/** Care Management gets a Care Plan sub-tab unless the org plans at program level only. */
export const showsPatientCarePlan = (mode) => mode !== 'program';

/**
 * Patient-only orgs keep the one plan under a fixed per-patient program, so
 * versions, signing, notes, audit and download all key off it unchanged.
 */
export function patientLevelProgram(patientId) {
  return {
    id: `pcp-${patientId}-PATIENT`,
    code: 'PATIENT',
    name: 'Patient Care Plan',
  };
}

export const isPatientLevelProgram = (program) => program?.code === 'PATIENT';

/**
 * The plans a patient-wide surface (roll-up, Monitoring goals) reads for this
 * mode. A level the org isn't using stays hidden even when it has data, so a
 * switched org never shows the other level's plans.
 */
export function carePlanSources(mode, programs, patientId) {
  if (mode === 'patient') return patientId ? [patientLevelProgram(patientId)] : [];
  return programs;
}

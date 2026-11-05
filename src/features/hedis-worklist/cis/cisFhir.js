import { CIS_ANTIGEN_STATUS, CIS_DOSE_STATUS, CIS_EVALUATION } from './cisRules';

// Standard code systems for sharing CIS-CMB10 results with payers and other
// systems. The UI keeps its own plain-language labels; anything that leaves
// the app goes through the mappers below so receivers get standard codes.
export const FHIR_SYSTEM = {
  immunizationStatus: 'http://hl7.org/fhir/event-status',
  doseEvaluation: 'http://terminology.hl7.org/CodeSystem/immunization-evaluation-dose-status',
  forecastStatus: 'http://terminology.hl7.org/CodeSystem/immunization-recommendation-status',
  gapStatus: 'http://hl7.org/fhir/us/davinci-deqm/CodeSystem/gaps-status',
  // Our own labels ride along as a second coding, so a round trip back into
  // Fold keeps the exact status.
  fold: 'https://fold.health/fhir/CodeSystem/cis-status',
};

const coding = (system, code, display) => ({ system, code, display });
const foldCoding = (label) => coding(FHIR_SYSTEM.fold, label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), label);

const concept = (label, standard) => ({
  coding: standard ? [standard, foldCoding(label)] : [foldCoding(label)],
  text: label,
});

const FORECAST = {
  due: coding(FHIR_SYSTEM.forecastStatus, 'due', 'Due'),
  overdue: coding(FHIR_SYSTEM.forecastStatus, 'overdue', 'Overdue'),
  complete: coding(FHIR_SYSTEM.forecastStatus, 'complete', 'Complete'),
};

// Upcoming and On track are not due yet. FHIR has no "not yet due" code:
// forecasters send `due` with future dateCriterion dates, which the dose row
// carries (earliest, nextDue, due).
// Can't be met has no FHIR forecast code (the series can no longer finish in
// the HEDIS window), so it is sent with the Fold coding only.
const DOSE_FORECAST = {
  [CIS_DOSE_STATUS.dueNow]: FORECAST.due,
  [CIS_DOSE_STATUS.overdue]: FORECAST.overdue,
  [CIS_DOSE_STATUS.upcoming]: FORECAST.due,
  [CIS_DOSE_STATUS.onTrack]: FORECAST.due,
  [CIS_DOSE_STATUS.cannotMeet]: null,
};

const DOSE_EVALUATION = {
  [CIS_DOSE_STATUS.completed]: coding(FHIR_SYSTEM.doseEvaluation, 'valid', 'Valid'),
  [CIS_DOSE_STATUS.completedLate]: coding(FHIR_SYSTEM.doseEvaluation, 'valid', 'Valid'),
  [CIS_DOSE_STATUS.notCounted]: coding(FHIR_SYSTEM.doseEvaluation, 'notvalid', 'Not valid'),
};

const ANTIGEN_FORECAST = {
  [CIS_ANTIGEN_STATUS.met]: FORECAST.complete,
  [CIS_ANTIGEN_STATUS.dueNow]: FORECAST.due,
  [CIS_ANTIGEN_STATUS.overdue]: FORECAST.overdue,
  [CIS_ANTIGEN_STATUS.upcoming]: FORECAST.due,
  [CIS_ANTIGEN_STATUS.onTrack]: FORECAST.due,
  [CIS_ANTIGEN_STATUS.cannotMeet]: null,
};

// Da Vinci DEQM gaps-in-care. On track can still close before the 2nd
// birthday (prospective); At risk and Can't be met need outreach (open).
const GAP_STATUS = {
  [CIS_EVALUATION.compliant]: coding(FHIR_SYSTEM.gapStatus, 'closed-gap', 'Closed Gap'),
  [CIS_EVALUATION.onTrack]: coding(FHIR_SYSTEM.gapStatus, 'prospective-gap', 'Prospective Gap'),
  [CIS_EVALUATION.atRisk]: coding(FHIR_SYSTEM.gapStatus, 'open-gap', 'Open Gap'),
  [CIS_EVALUATION.cannotMeet]: coding(FHIR_SYSTEM.gapStatus, 'open-gap', 'Open Gap'),
};

/**
 * FHIR codes for one dose row from `evaluateCis().antigens[].rows`.
 * Given doses map to Immunization.status + ImmunizationEvaluation.doseStatus;
 * planned doses map to ImmunizationRecommendation.forecastStatus.
 */
export function cisDoseFhir(row) {
  if (row.kind === 'given' || row.kind === 'pending') {
    const evaluation = DOSE_EVALUATION[row.status];
    return {
      resource: 'Immunization',
      immunizationStatus: coding(FHIR_SYSTEM.immunizationStatus, 'completed', 'Completed'),
      // A dose marked given with no date yet cannot be evaluated.
      doseStatus: evaluation ? concept(row.status, evaluation) : null,
    };
  }
  return { resource: 'ImmunizationRecommendation', forecastStatus: concept(row.status, DOSE_FORECAST[row.status]) };
}

/** ImmunizationRecommendation.forecastStatus for one vaccine (antigen). */
export function cisAntigenFhir(antigen) {
  return concept(antigen.status, ANTIGEN_FORECAST[antigen.status]);
}

/**
 * DEQM gap status for the whole CIS-CMB10 result. Not eligible members are
 * outside the measure denominator, so there is no gap to report (null).
 */
export function cisGapFhir(evaluation) {
  if (evaluation === CIS_EVALUATION.notEligible) return null;
  return concept(evaluation, GAP_STATUS[evaluation]);
}

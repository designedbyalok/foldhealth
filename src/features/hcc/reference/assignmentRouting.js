// Visit-Type → downstream queue routing.
//
// When QA / Compliance adds an ICD via +ICD, we don't need the Support step
// (documents are already retrieved for their review), the DOS should land
// directly on the queue that owns the Visit Type. Most visit types belong on
// the Coder queue, but a few high-oversight types (Inpatient, ER, Hospice)
// route straight to QA so the initial code capture doubles as a compliance
// review; a couple (Hospice, SNF) require Compliance review before billing.
//
// Extension point: add rows as new Visit Types are onboarded. Anything not
// listed defaults to 'coder' so a missing entry never leaves a DOS orphaned.

import { VISIT_TYPES } from './visitTypes';

export const DEFAULT_MANUAL_ROLE = 'coder';

// Explicit overrides: everything else lands on the coder queue.
const OVERRIDES = {
  'Inpatient Visit / Admission':               'reviewer',    // QA reviews acute stays first
  'ER Visit':                                  'reviewer',    // QA reviews ER capture first
  'Observation Visit':                         'reviewer',    // QA reviews obs stays first
  'Skilled Nursing Facility Visit':            'reviewer2',   // Compliance owns SNF workflow
  'Hospice Visit':                             'reviewer2',   // Compliance owns hospice workflow
};

/**
 * Resolve which downstream role should first own a manually-added DOS given
 * its Visit Type. Returns a canonical role key ('coder' | 'reviewer' |
 * 'reviewer2'). Unknown or empty inputs default to Coder.
 */
export function routeRoleForVisitType(visitType) {
  if (!visitType) return DEFAULT_MANUAL_ROLE;
  return OVERRIDES[visitType] || DEFAULT_MANUAL_ROLE;
}

// Exposed for tests / dev tools only. UI code should call routeRoleForVisitType.
export const _ROUTE_ROLE_BY_VISIT_TYPE = Object.freeze({
  ...Object.fromEntries(VISIT_TYPES.map(vt => [vt, DEFAULT_MANUAL_ROLE])),
  ...OVERRIDES,
});

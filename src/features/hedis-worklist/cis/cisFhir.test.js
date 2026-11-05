import { describe, it, expect } from 'vitest';
import { CIS_ANTIGEN_STATUS, CIS_DOSE_STATUS, CIS_EVALUATION } from './cisRules';
import { FHIR_SYSTEM, cisAntigenFhir, cisDoseFhir, cisGapFhir } from './cisFhir';

const standard = (concept) => concept?.coding.find(c => c.system !== FHIR_SYSTEM.fold) ?? null;

describe('cisGapFhir', () => {
  it('maps every evaluation to a DEQM gap status', () => {
    expect(standard(cisGapFhir(CIS_EVALUATION.compliant)).code).toBe('closed-gap');
    expect(standard(cisGapFhir(CIS_EVALUATION.onTrack)).code).toBe('prospective-gap');
    expect(standard(cisGapFhir(CIS_EVALUATION.atRisk)).code).toBe('open-gap');
    expect(standard(cisGapFhir(CIS_EVALUATION.cannotMeet)).code).toBe('open-gap');
    expect(cisGapFhir(CIS_EVALUATION.notEligible)).toBeNull();
  });

  it('keeps the Fold label as a second coding', () => {
    const c = cisGapFhir(CIS_EVALUATION.onTrack);
    expect(c.text).toBe('On track');
    expect(c.coding).toContainEqual({ system: FHIR_SYSTEM.fold, code: 'on-track', display: 'On track' });
  });
});

describe('cisDoseFhir', () => {
  it('maps given doses to Immunization status and dose evaluation', () => {
    const late = cisDoseFhir({ kind: 'given', status: CIS_DOSE_STATUS.completedLate });
    expect(late.immunizationStatus.code).toBe('completed');
    expect(standard(late.doseStatus).code).toBe('valid');
    expect(standard(cisDoseFhir({ kind: 'given', status: CIS_DOSE_STATUS.notCounted }).doseStatus).code).toBe('notvalid');
    expect(cisDoseFhir({ kind: 'pending', status: CIS_DOSE_STATUS.pending }).doseStatus).toBeNull();
  });

  it('maps planned doses to forecast status', () => {
    const code = (status) => standard(cisDoseFhir({ kind: 'planned', status }).forecastStatus)?.code ?? null;
    expect(code(CIS_DOSE_STATUS.dueNow)).toBe('due');
    expect(code(CIS_DOSE_STATUS.overdue)).toBe('overdue');
    expect(code(CIS_DOSE_STATUS.upcoming)).toBe('due');
    expect(code(CIS_DOSE_STATUS.onTrack)).toBe('due');
    expect(code(CIS_DOSE_STATUS.cannotMeet)).toBeNull();
  });
});

describe('cisAntigenFhir', () => {
  it('has a coding for every antigen status', () => {
    for (const status of Object.values(CIS_ANTIGEN_STATUS)) {
      expect(cisAntigenFhir({ status }).coding.length).toBeGreaterThan(0);
    }
    expect(standard(cisAntigenFhir({ status: CIS_ANTIGEN_STATUS.met })).code).toBe('complete');
  });
});

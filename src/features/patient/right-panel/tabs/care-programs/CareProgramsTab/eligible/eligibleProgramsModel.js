import { consentState, requiresConsent } from '../../../../../data/consentRules';
import { isProgramClosed } from '../../../../../data/programStatus';

/**
 * The eligibility rows to show: programs in the catalog the patient isn't
 * already in (an open enrollment of the same code hides it), with the
 * program's name and whether consent is still needed, worked out from the
 * consents on file.
 */
export function eligibleRows(found, { programs = [], catalog = [], consents = [], today = new Date() } = {}) {
  const open = new Set(programs.filter(p => !isProgramClosed(p.status)).map(p => p.code));
  return found
    .filter(r => !open.has(r.code))
    .map(r => {
      const entry = catalog.find(e => e.code === r.code);
      if (!entry) return null;
      const needs = requiresConsent(r.code);
      const given = needs && consentState(consents, 'program', r.code, today).state === 'given';
      return {
        ...r,
        name: entry.name,
        consentOk: !needs || given,
        consent: !needs ? 'No consent needed' : given ? 'Consent on file' : 'Consent needed: Enroll asks for it first',
      };
    })
    .filter(Boolean);
}

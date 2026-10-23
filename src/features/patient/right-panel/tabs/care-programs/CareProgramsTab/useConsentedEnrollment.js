import { useAppStore } from '../../../../../../store/useAppStore';
import { toast } from '../../../../../../components/Toast/sonnerToast';
import { enrollmentCheck } from '../../../../data/consentRules';
import { usePatientConsent } from '../../../../hooks/usePatientConsent';

/**
 * Enrollment with the Phase 2A checks in front of it: an ineligible patient
 * isn't enrolled (the reasons show in a toast), and a program that needs
 * consent opens Capture Consent first, enrolling only once it's given.
 * `request(code, enroll, { subProgram })` runs `enroll()` when it may go ahead.
 */
export function useConsentedEnrollment(patientId, programs) {
  const openConsentCapture = useAppStore(s => s.openConsentCapture);
  const consentTableMissing = useAppStore(s => s.patientConsentTableMissing);
  const profile = useAppStore(s => s.p360ProfilesById[patientId]);
  const { consents } = usePatientConsent(patientId);

  return (code, enroll, { subProgram = null } = {}) => {
    // No profile row: conditions are unknown, so they don't block.
    const conditions = profile ? (profile.chronic_conditions || []) : null;
    const check = enrollmentCheck(code, { existing: programs, conditions, consents, subProgram, triggerable: code === 'SNP' });
    if (!check.eligible) {
      toast.error(`Can't enroll in ${code}: ${check.reasons.join('; ')}`);
      return;
    }
    // Before the consent migration runs there's nowhere to keep it; don't
    // make enrollment depend on it yet.
    if (check.needsConsent && !consentTableMissing) {
      openConsentCapture(patientId, {
        scopeType: 'program',
        scope: code,
        onCaptured: (record) => {
          if (record.status === 'given') enroll();
          else toast(`Not enrolled: ${code} consent was ${record.status}`);
        },
      });
      return;
    }
    enroll();
  };
}

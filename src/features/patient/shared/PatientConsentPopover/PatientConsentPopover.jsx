import { useMemo } from 'react';
import { ConsentPopover } from '../../../../components/ConsentPopover/ConsentPopover';
import { useAppStore } from '../../../../store/useAppStore';
import { usePatientConsent } from '../../hooks/usePatientConsent';
import { consentHistory, consentSections } from '../../data/consentDisplay';

/** ConsentPopover for one patient, backed by patient_consents. */
export function PatientConsentPopover({ patientId, pos, onClose }) {
  const openConsentCapture = useAppStore(s => s.openConsentCapture);
  const { consents, programs, loaded } = usePatientConsent(patientId);

  const sections = useMemo(() => consentSections(consents, programs).map(section => ({
    ...section,
    items: section.items.map(item => ({
      ...item,
      checked: item.state === 'given',
      // A switch can't change consent on its own: it opens Capture Consent
      // preset to the decision it was flipped towards.
      onToggle: (next) => {
        onClose();
        openConsentCapture(patientId, { scopeType: item.scopeType, scope: item.scope, status: next ? 'given' : 'withdrawn' });
      },
    })),
  })), [consents, programs, onClose, openConsentCapture, patientId]);

  return (
    <ConsentPopover
      pos={pos}
      onClose={onClose}
      loading={!loaded}
      sections={sections}
      history={consentHistory(consents)}
    />
  );
}

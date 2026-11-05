import { useEffect, useMemo } from 'react';
import { ConsentPopover } from '../../../../components/ConsentPopover/ConsentPopover';
import { useAppStore } from '../../../../store/useAppStore';
import { usePatientConsent } from '../../hooks/usePatientConsent';
import { consentHistory, consentSections } from '../../data/consentDisplay';
import { loadCaptureConsentDrawer } from '../CaptureConsentDrawer/loadCaptureConsentDrawer';

/** ConsentPopover for one patient, backed by patient_consents. */
export function PatientConsentPopover({ patientId, pos, onClose }) {
  const openConsentCapture = useAppStore(s => s.openConsentCapture);
  const openConsentHistory = useAppStore(s => s.openConsentHistory);
  const openContactConsent = useAppStore(s => s.openContactConsent);
  const { consents, programs, loaded } = usePatientConsent(patientId);

  // Warm Capture Consent's chunk while the popover is open, so flipping a
  // switch opens the drawer without a wait.
  useEffect(() => { loadCaptureConsentDrawer(); }, []);

  const sections = useMemo(() => consentSections(consents, programs).map((section) => {
    // A switch can't change consent on its own. Channels confirm in the
    // contact dialog; programs and others open Capture Consent preset to the
    // decision the switch was flipped towards.
    const channel = section.id === 'channel';
    const items = section.items.map(item => ({
      ...item,
      checked: item.state === 'given',
      onToggle: (next) => {
        onClose();
        if (channel) openContactConsent(patientId, [item.scope], next ? 'given' : 'withdrawn');
        else openConsentCapture(patientId, { scopeType: item.scopeType, scope: item.scope, status: next ? 'given' : 'withdrawn' });
      },
    }));
    if (!channel) return { ...section, items };
    const allGiven = items.every(i => i.checked);
    return {
      ...section,
      items,
      toggle: {
        checked: allGiven,
        // On: accept every channel not yet given. Off: withdraw every given one.
        onToggle: (next) => {
          onClose();
          const scopes = items.filter(i => (next ? !i.checked : i.checked)).map(i => i.scope);
          openContactConsent(patientId, scopes, next ? 'given' : 'withdrawn');
        },
      },
    };
  }), [consents, programs, onClose, openConsentCapture, openContactConsent, patientId]);

  return (
    <ConsentPopover
      pos={pos}
      onClose={onClose}
      loading={!loaded}
      sections={sections}
      history={consentHistory(consents)}
      onOpenHistory={() => { onClose(); openConsentHistory(patientId); }}
    />
  );
}

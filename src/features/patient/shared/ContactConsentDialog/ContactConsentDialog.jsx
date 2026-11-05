import { useState } from 'react';
import { ConfirmDialog } from '../../../../components/ConfirmDialog/ConfirmDialog';
import { toast } from '../../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../../store/useAppStore';
import { resolvePatientForCall } from '../../../../lib/patientCall';

const CHANNEL = {
  call: { icon: 'solar:phone-linear', via: 'a phone call' },
  sms: { icon: 'custom:sms', via: 'SMS' },
  email: { icon: 'solar:letter-linear', via: 'email' },
};

/**
 * Accept or withdraw contact consent for one channel or all of them (Figma
 * 29:7133 all channels, 29:7206 one channel). Records a verbal consent per
 * channel through capturePatientConsent, one at a time so each record gets
 * its own id.
 */
export function ContactConsentDialog({ patientId, scopes, status, onClose }) {
  const capturePatientConsent = useAppStore(s => s.capturePatientConsent);
  const patient = useAppStore(s => resolvePatientForCall(s, patientId));
  const [saving, setSaving] = useState(false);

  const accept = status === 'given';
  const one = scopes.length === 1 ? CHANNEL[scopes[0]] : null;
  const via = one ? one.via : 'email, SMS, voice or any other electronic media';
  const name = patient?.name || 'this patient';

  const confirm = async () => {
    setSaving(true);
    for (const scope of scopes) {
      const result = await capturePatientConsent(patientId, {
        scopeType: 'channel',
        scope,
        status,
        method: accept ? 'verbal' : null,
      });
      if (!result.ok) {
        setSaving(false);
        toast.error(result.error || 'Consent could not be saved');
        return;
      }
    }
    setSaving(false);
    toast.success(accept ? 'Contact consent accepted' : 'Contact consent withdrawn');
    onClose();
  };

  return (
    <ConfirmDialog
      heroIcon
      variant={accept ? 'primary' : 'destructive'}
      icon={one ? one.icon : 'solar:phone-linear'}
      iconColor="var(--neutral-300)"
      title={`${accept ? 'Accept' : 'Withdraw'} Consent to Contact ${name}`}
      description={accept ? `Consent to send a communication via ${via}.` : `Stop sending communications via ${via}.`}
      confirmLabel={accept ? 'Accept' : 'Withdraw'}
      cancelLabel={null}
      loading={saving}
      onConfirm={confirm}
      onCancel={onClose}
      onClose={onClose}
    />
  );
}

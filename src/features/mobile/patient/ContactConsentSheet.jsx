import { useState } from 'react';
import { Badge } from '../../../components/Badge/Badge';
import { BottomSheet } from '../../../components/BottomSheet/BottomSheet';
import { Button } from '../../../components/Button/Button';
import { Icon } from '../../../components/Icon/Icon';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import { CONSENT_CHANNELS, consentState } from '../../patient/data/consentRules';
import { consentStateLabel } from '../../patient/data/consentDisplay';
import { usePatientConsent } from '../../patient/hooks/usePatientConsent';
import styles from './patientForm.module.css';
import own from './PatientSheets.module.css';

const CHANNEL = {
  call: { icon: 'solar:phone-linear', via: 'a phone call' },
  sms: { icon: 'solar:chat-square-linear', via: 'SMS' },
  email: { icon: 'solar:letter-linear', via: 'email' },
};
const TONE = { given: 'success', declined: 'neutral', withdrawn: 'danger', expired: 'warning', missing: 'warning' };

/**
 * Accept or withdraw contact consent per channel (the desktop
 * ContactConsentDialog): a verbal record through capturePatientConsent,
 * one per channel, after a confirm step.
 */
export function ContactConsentSheet({ patient, onClose }) {
  const capturePatientConsent = useAppStore(s => s.capturePatientConsent);
  const { consents } = usePatientConsent(patient.id);
  const [confirm, setConfirm] = useState(null); // { scopes, status }
  const [saving, setSaving] = useState(false);

  const run = async () => {
    const accept = confirm.status === 'given';
    setSaving(true);
    for (const scope of confirm.scopes) {
      const result = await capturePatientConsent(patient.id, { scopeType: 'channel', scope, status: confirm.status, method: accept ? 'verbal' : null });
      if (!result.ok) {
        setSaving(false);
        toast.error(result.error || 'Consent could not be saved');
        return;
      }
    }
    setSaving(false);
    toast.success(accept ? 'Contact consent accepted' : 'Contact consent withdrawn');
    setConfirm(null);
  };

  if (confirm) {
    const accept = confirm.status === 'given';
    const one = confirm.scopes.length === 1 ? CHANNEL[confirm.scopes[0]] : null;
    const via = one ? one.via : 'email, SMS, voice or any other electronic media';
    return (
      <BottomSheet title={`${accept ? 'Accept' : 'Withdraw'} Consent`} onClose={() => setConfirm(null)}>
        <div className={styles.sheetForm}>
          <p className={styles.sheetText}>
            {accept ? `Consent to send ${patient.name} a communication via ${via}.` : `Stop sending ${patient.name} communications via ${via}.`}
          </p>
          <Button size="lg" fullWidth variant={accept ? 'solid' : 'soft'} tone={accept ? undefined : 'danger'} loading={saving} onClick={run}>
            {accept ? 'Accept' : 'Withdraw'}
          </Button>
        </div>
      </BottomSheet>
    );
  }

  const rows = CONSENT_CHANNELS.map(c => ({ ...c, ...consentState(consents, 'channel', c.scope) }));
  const missing = rows.filter(r => r.state !== 'given').map(r => r.scope);
  return (
    <BottomSheet title="Contact Consent" onClose={onClose}>
      <div className={own.rows}>
        {rows.map(r => {
          const given = r.state === 'given';
          return (
            <div key={r.scope} className={own.row}>
              <Icon name={CHANNEL[r.scope].icon} size={24} color="var(--neutral-300)" />
              <span className={own.rowText}>
                <span className={own.rowTitle}>{r.label}</span>
                <Badge size="sm" variant="soft" tone={TONE[r.state]} label={consentStateLabel(r.state)} />
              </span>
              <Button
                size="lg"
                variant={given ? 'ghost' : 'soft'}
                tone={given ? 'danger' : undefined}
                onClick={() => setConfirm({ scopes: [r.scope], status: given ? 'withdrawn' : 'given' })}
              >
                {given ? 'Withdraw' : 'Accept'}
              </Button>
            </div>
          );
        })}
      </div>
      {missing.length > 1 && (
        <Button size="lg" fullWidth onClick={() => setConfirm({ scopes: missing, status: 'given' })}>Accept All Channels</Button>
      )}
    </BottomSheet>
  );
}

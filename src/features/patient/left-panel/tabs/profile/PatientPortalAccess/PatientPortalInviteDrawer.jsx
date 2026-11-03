import { useState } from 'react';
import { useAppStore } from '../../../../../../store/useAppStore';
import { Drawer } from '../../../../../../components/Drawer/Drawer';
import { Button } from '../../../../../../components/Button/Button';
import { Input } from '../../../../../../components/Input/Input';
import { RadioOptionGroup } from '../../../../../../components/RadioOptionGroup/RadioOptionGroup';
import { Alert } from '../../../../../../components/Alert/Alert';
import styles from './PatientPortalAccess.module.css';

const RELATIONSHIP_OPTIONS = [
  { value: 'self', label: "Patient's own account", hint: 'The patient signs in for themself.' },
  { value: 'dependent', label: 'Parent or guardian', hint: 'Someone who manages this patient, for example a child.' },
  { value: 'caregiver', label: 'Caregiver', hint: 'A family member or caregiver who helps with appointments.' },
];

export function PatientPortalInviteDrawer({ patient, memberId, defaultEmail = '', onClose, onSent }) {
  const invite = useAppStore((s) => s.invitePatientPortal);
  const [email, setEmail] = useState(defaultEmail || '');
  const [relationship, setRelationship] = useState(defaultEmail ? 'self' : '');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [dismissed, setDismissed] = useState(false);

  const send = async () => {
    setSending(true);
    setError('');
    try {
      const message = await invite(memberId, { email: email.trim(), relationship });
      if (message) { setError(message); return; }
      onSent?.(email.trim());
      setDismissed(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <Drawer
      title="Give patient app access"
      onClose={onClose}
      dismissed={dismissed}
      width={520}
      primaryAction={(
        <Button disabled={!email.trim() || !relationship} onClick={send} loading={sending}>
          Send invite
        </Button>
      )}
    >
      <div className={styles.form}>
        <p className={styles.intro}>
          The person gets an email with a link to set a password, then can book visits for{' '}
          <strong>{patient.name || 'this patient'}</strong> at patients.foldhealth.org. If they already have a patient app account,
          this patient is added to it.
        </p>
        {error && <Alert tone="error" message={error} />}
        <Input
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
        />
        <RadioOptionGroup
          label="Whose account is this?"
          variant="card"
          value={relationship}
          onChange={setRelationship}
          options={RELATIONSHIP_OPTIONS}
        />
      </div>
    </Drawer>
  );
}

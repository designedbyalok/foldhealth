import { useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { RadioOptionGroup } from '@/components/RadioOptionGroup/RadioOptionGroup';
import { Checkbox } from '@/components/ShadcnCheckbox/ShadcnCheckbox';
import { Button } from '@/components/Button/Button';
import { CardSkeleton } from '@/components/CardSkeleton/CardSkeleton';
import styles from './Settings.module.css';

const METHODS = [
  { value: 'email', label: 'Email' },
  { value: 'call', label: 'Voice Call' },
  { value: 'sms', label: 'SMS' },
];

// The same two settings as Edit Profile, saved the same way.
export function CommunicationPreferences({ memberId }) {
  const uid = useId();
  const [loaded, setLoaded] = useState(null);
  const [method, setMethod] = useState('');
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.rpc('patient_contact_profile', { p_member_id: memberId }).then(({ data }) => {
      if (!alive) return;
      setLoaded(data || {});
      setMethod(data?.preferred_contact_method || '');
      setConsent(!!data?.e_consent);
    });
    return () => { alive = false; };
  }, [memberId]);

  if (!loaded) return <CardSkeleton count={1} />;
  const changes = {
    ...(method !== (loaded.preferred_contact_method || '') ? { preferred_contact_method: method || null } : {}),
    ...(consent !== !!loaded.e_consent ? { e_consent: consent } : {}),
  };

  const save = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('patient_update_contact', { p_member_id: memberId, p_changes: changes });
      if (error) { toast.error(error.message || 'Your preferences were not saved.'); return; }
      setLoaded(data);
      toast.success('Preferences saved');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`${styles.stack} ${styles.narrow}`}>
      <RadioOptionGroup label="How should your care team reach you?" name={`${uid}-method`} value={method} onChange={setMethod} options={METHODS} />
      <div className={styles.consent}>
        <Checkbox id={`${uid}-consent`} checked={consent} onCheckedChange={(v) => setConsent(v === true)} />
        <label htmlFor={`${uid}-consent`}>
          I give consent to send important communication via Email, SMS, Voice call or any other electronic media
        </label>
      </div>
      <Button variant="primary" size="L" disabled={saving || !Object.keys(changes).length} onClick={save}>
        {saving ? 'Saving…' : 'Save preferences'}
      </Button>
    </div>
  );
}

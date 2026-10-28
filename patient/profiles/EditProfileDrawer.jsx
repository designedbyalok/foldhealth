import { useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Drawer } from '@/components/Drawer/Drawer';
import { Button } from '@/components/Button/Button';
import { Input } from '@/components/Input/Input';
import { RadioOptionGroup } from '@/components/RadioOptionGroup/RadioOptionGroup';
import { Checkbox } from '@/components/ShadcnCheckbox/ShadcnCheckbox';
import { AvatarBase } from '@/components/Avatar/AvatarBase';
import { CardSkeleton } from '@/components/CardSkeleton/CardSkeleton';
import { initialsOf } from '../lib/profileFormat';
import styles from './EditProfileDrawer.module.css';

const CONTACT_METHODS = [
  { value: 'email', label: 'Email' },
  { value: 'call', label: 'Voice Call' },
  { value: 'sms', label: 'SMS' },
];
const GENDERS = { M: 'Male', F: 'Female' };
const EDITABLE = ['email', 'phone', 'secondary_email', 'secondary_phone', 'address_line1', 'address_line2',
  'city', 'state', 'zipcode', 'preferred_contact_method', 'e_consent'];

// Edit Profile (frame 701:5539). Contact details save directly; name, date
// of birth and gender stay with the care team.
export function EditProfileDrawer({ profile, onClose, onSaved }) {
  const uid = useId();
  const [loaded, setLoaded] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.rpc('patient_contact_profile', { p_member_id: profile.member_id }).then(({ data, error: e }) => {
      if (!alive) return;
      if (e) setError('We could not load your profile. Please try again.');
      setLoaded(data || {});
      setForm(data || {});
    });
    return () => { alive = false; };
  }, [profile.member_id]);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const text = (key) => ({ value: form?.[key] || '', onChange: (e) => set(key)(e.target.value) });
  const changes = form
    ? Object.fromEntries(EDITABLE.filter((k) => (form[k] ?? '') !== (loaded[k] ?? '')).map((k) => [k, form[k] ?? null]))
    : {};
  const dirty = Object.keys(changes).length > 0;

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const { data, error: e } = await supabase.rpc('patient_update_contact', { p_member_id: profile.member_id, p_changes: changes });
      if (e) { setError(e.message || 'Your changes were not saved. Try again.'); return; }
      toast.success('Profile updated');
      onSaved({ email: data.email, phone: data.phone });
      setDismissed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      title="Edit Profile"
      onClose={onClose}
      dismissed={dismissed}
      width={720}
      primaryAction={(
        <Button variant="primary" size="L" disabled={!dirty || saving} onClick={save}>
          {saving ? 'Saving…' : 'Save Updates'}
        </Button>
      )}
    >
      {!form ? <CardSkeleton count={3} /> : (
        <div className={styles.body}>
          <div className={styles.identity}>
            <AvatarBase variant="patient" size="L" initials={initialsOf(profile)} />
            <div className={styles.identityText}>
              <span className={styles.name}>{form.name || profile.name}</span>
              {form.email && <span className={styles.meta}>{form.email}</span>}
            </div>
          </div>

          {error && <p className={styles.error} role="alert">{error}</p>}

          <div className={styles.grid}>
            <Input label="Full Name" aria-label="Full Name" value={form.name || ''} disabled />
            <Input label="Date of Birth" aria-label="Date of Birth" value={form.dob || ''} disabled />
            <Input label="Gender" aria-label="Gender" value={GENDERS[form.gender] || form.gender || ''} disabled />
          </div>
          <p className={styles.note}>To change your name, date of birth or gender, message your care team.</p>

          <hr className={styles.rule} />

          <div className={styles.grid}>
            <Input label="Email" aria-label="Email" type="email" required {...text('email')} />
            <Input label="Phone Number" aria-label="Phone Number" type="tel" required {...text('phone')} />
            <Input label="Secondary Email" aria-label="Secondary Email" type="email" placeholder="Enter Secondary Email" {...text('secondary_email')} />
            <Input label="Secondary Phone Number" aria-label="Secondary Phone Number" type="tel" placeholder="Enter Secondary Phone" {...text('secondary_phone')} />
          </div>
          <RadioOptionGroup
            label="Preferred contact method"
            name={`${uid}-contact`}
            value={form.preferred_contact_method || ''}
            onChange={set('preferred_contact_method')}
            options={CONTACT_METHODS}
          />

          <hr className={styles.rule} />

          <div className={styles.stack}>
            <Input label="Address Line 1" aria-label="Address Line 1" {...text('address_line1')} />
            <Input label="Address Line 2" aria-label="Address Line 2" {...text('address_line2')} />
          </div>
          <div className={styles.grid3}>
            <Input label="City" aria-label="City" {...text('city')} />
            <Input label="State" aria-label="State" {...text('state')} />
            <Input label="Zip Code" aria-label="Zip Code" inputMode="numeric" {...text('zipcode')} />
          </div>

          <hr className={styles.rule} />

          <div className={styles.consent}>
            <Checkbox id={`${uid}-consent`} checked={!!form.e_consent} onCheckedChange={(v) => set('e_consent')(v === true)} />
            <label htmlFor={`${uid}-consent`}>
              I give consent to send important communication via Email, SMS, Voice call or any other electronic media
            </label>
          </div>
        </div>
      )}
    </Drawer>
  );
}

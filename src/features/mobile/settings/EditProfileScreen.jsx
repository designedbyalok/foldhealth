import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../components/Button/Button';
import { Input } from '../../../components/Input/Input';
import { Textarea } from '../../../components/Textarea/Textarea';
import { useAppStore } from '../../../store/useAppStore';
import { supabase } from '../../../lib/supabase';
import { isCapitalizedName } from '../../../lib/nameValidation';
import { MobileListSkeleton } from '../MobileParts';
import { useMobileNav } from '../MobileNavContext';
import { FieldGroup, FormScreen } from '../patient/FormScreen';
import styles from './settings.module.css';

// The personal fields of the desktop Edit User drawer. Roles stay with an
// admin on a computer (saveUserProfile strips them for non-admins anyway).
const FIELDS = ['first_name', 'middle_name', 'last_name', 'mobile', 'fax', 'bio', 'address_line1', 'address_line2', 'city', 'state', 'zip_code'];

const formOf = (raw, me) => ({
  first_name: raw.first_name || me?.name?.split(' ')[0] || '',
  middle_name: raw.middle_name || '',
  last_name: raw.last_name || me?.name?.split(' ').slice(1).join(' ') || '',
  mobile: raw.mobile || raw.phone || '',
  fax: raw.fax || '',
  bio: raw.bio || '',
  address_line1: raw.address_line1 || '',
  address_line2: raw.address_line2 || '',
  city: raw.city || '',
  state: raw.state || '',
  zip_code: raw.zip_code || '',
});

/**
 * Edit my own profile (desktop Settings > Account > Users > Edit User): the
 * same name rules, the same profiles update and the same UserProfile audit
 * entry as the desktop drawer.
 */
export function EditProfileScreen() {
  const { pop } = useMobileNav();
  const me = useAppStore(s => s.currentUserProfile);
  const logAudit = useAppStore(s => s.logAudit);
  const showToast = useAppStore(s => s.showToast);
  const [raw, setRaw] = useState(null);
  const [form, setForm] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!me?.id) return undefined;
    let live = true;
    supabase.from('profiles').select('*').eq('id', me.id).maybeSingle().then(({ data }) => {
      if (!live) return;
      const row = data || {};
      setRaw(row);
      setForm(formOf(row, me));
    });
    return () => { live = false; };
  }, [me]);

  const initial = useMemo(() => (raw ? formOf(raw, me) : null), [raw, me]);
  const dirty = !!form && JSON.stringify(form) !== JSON.stringify(initial);
  const set = (key) => (v) => setForm(f => ({ ...f, [key]: v }));
  const nameError = (v) => {
    if (submitted && !v.trim()) return 'This field is required';
    if (v && !isCapitalizedName(v)) return 'Must start with a capital letter';
    return '';
  };

  const save = async () => {
    setSubmitted(true);
    if (!form.first_name.trim() || !form.last_name.trim()) { showToast('First and last name are required'); return; }
    if (!isCapitalizedName(form.first_name) || !isCapitalizedName(form.last_name)) {
      showToast('First and last name must start with a capital letter');
      return;
    }
    const updates = { full_name: `${form.first_name} ${form.last_name}`.trim() };
    FIELDS.forEach(k => { updates[k] = form[k]; });
    const changes = [];
    for (const [key, val] of Object.entries(updates)) {
      const oldStr = String(raw[key] || '');
      if (String(val || '') !== oldStr) changes.push({ field: key, from: oldStr, to: String(val || ''), type: 'text' });
    }
    if (changes.length) {
      logAudit('UserProfile', me.id, me.name, 'updated', `Profile updated: ${changes.map(c => c.field).join(', ')}`, 'Configuration', changes);
    }
    setSaving(true);
    let data;
    let error;
    try {
      ({ data, error } = await supabase.from('profiles').update(updates).eq('id', me.id).select());
    } finally {
      setSaving(false);
    }
    if (error || !data || data.length === 0) {
      showToast(`Error: ${error?.message || 'Permission denied'}`);
      return;
    }
    // Keep the sign-in name in step, as desktop Preferences does (a missing
    // name raises the "complete your profile" alert that opens this screen).
    if (updates.first_name !== raw.first_name || updates.last_name !== raw.last_name) {
      await supabase.auth.updateUser({ data: { first_name: form.first_name, last_name: form.last_name, full_name: updates.full_name } }).catch(() => {});
    }
    useAppStore.setState(s => ({ currentUserProfile: s.currentUserProfile ? { ...s.currentUserProfile, name: updates.full_name } : s.currentUserProfile }));
    showToast('Profile updated');
    pop();
  };

  return (
    <FormScreen
      title="My profile"
      subtitle={me?.email}
      footer={<Button size="lg" disabled={!dirty} loading={saving} onClick={save}>Save</Button>}
    >
      {!form ? <MobileListSkeleton count={4} height={52} /> : (
        <>
          <FieldGroup label="Name">
            <Input size="lg" label="First name" required autoComplete="given-name" enterKeyHint="next" value={form.first_name} onValueChange={set('first_name')} errorText={nameError(form.first_name) || undefined} />
            <Input size="lg" label="Middle name" autoComplete="additional-name" enterKeyHint="next" value={form.middle_name} onValueChange={set('middle_name')} />
            <Input size="lg" label="Last name" required autoComplete="family-name" enterKeyHint="next" value={form.last_name} onValueChange={set('last_name')} errorText={nameError(form.last_name) || undefined} />
          </FieldGroup>
          <FieldGroup label="Contact">
            <Input size="lg" type="tel" label="Mobile" autoComplete="tel" value={form.mobile} onValueChange={set('mobile')} />
            <Input size="lg" type="tel" label="Fax" value={form.fax} onValueChange={set('fax')} />
          </FieldGroup>
          <FieldGroup label="Address">
            <Input size="lg" label="Address line 1" autoComplete="address-line1" value={form.address_line1} onValueChange={set('address_line1')} />
            <Input size="lg" label="Address line 2" autoComplete="address-line2" value={form.address_line2} onValueChange={set('address_line2')} />
            <Input size="lg" label="City" autoComplete="address-level2" value={form.city} onValueChange={set('city')} />
            <div className={styles.row2}>
              <Input size="lg" label="State" autoComplete="address-level1" value={form.state} onValueChange={set('state')} />
              <Input size="lg" label="Zip code" inputMode="numeric" autoComplete="postal-code" value={form.zip_code} onValueChange={set('zip_code')} />
            </div>
          </FieldGroup>
          <FieldGroup label="Bio">
            <Textarea aria-label="Bio" rows={4} value={form.bio} onChange={e => set('bio')(e.target.value)} />
          </FieldGroup>
        </>
      )}
    </FormScreen>
  );
}

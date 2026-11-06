import { useMemo, useState } from 'react';
import { Button } from '../../../components/Button/Button';
import { Input } from '../../../components/Input/Input';
import { Textarea } from '../../../components/Textarea/Textarea';
import { useAppStore } from '../../../store/useAppStore';
import { MEDICAL_SPECIALTIES, PHYSICIAN_ROLE } from '../../../data/medicalSpecialties';
import { useRoleOptions } from '../../settings/account/access-control/useRoleOptions';
import { useLocationNames } from '../../settings/account/AccountPanelParts';
import { ADMIN_ROLES, GENDER_OPTIONS, LANGUAGE_OPTIONS, isCapitalizedName } from '../../settings/account/InviteUserDrawer.utils';
import { EHR_SYSTEMS, US_STATES, buildEditUserUpdates, editUserChanges, editUserInitialForm } from '../../settings/account/users/editUserForm';
import { useUsersTab } from '../../settings/account/users/useUsersTab';
import { useMobileNav } from '../MobileNavContext';
import { FieldGroup, FormScreen, PickerField } from '../patient/FormScreen';
import { NoAccountAccess } from './accountAccess';
import { useAccountAccess } from './useAccountAccess';
import { MultiPickerField } from './MultiPickerField';
import settings from '../settings/settings.module.css';

const opts = (arr) => arr.map(v => ({ value: v, label: v }));

/**
 * Edit a user (desktop EditUserDrawer): roles, locations, specialty, EHR
 * mapping and profile fields, with the same name rules, `profiles` update
 * (useUsersTab.saveUserProfile) and UserProfile audit entry.
 */
export function EditUserScreen(props) {
  const allowed = useAccountAccess();
  if (!allowed) return <NoAccountAccess title="Edit user" />;
  return <EditUser {...props} />;
}

function EditUser({ user }) {
  const { pop } = useMobileNav();
  const tab = useUsersTab();
  const roleOptions = useRoleOptions();
  const locationNames = useLocationNames();
  const logAudit = useAppStore(s => s.logAudit);
  const showToast = useAppStore(s => s.showToast);
  const raw = user._raw || {};
  const initial = useMemo(() => editUserInitialForm(user), [user]);
  const [form, setForm] = useState(initial);
  const [credText, setCredText] = useState(() => (initial.credentials || []).join(', '));
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (key) => (v) => setForm(f => ({ ...f, [key]: v }));
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const isPhysician = form.clinical_roles.includes(PHYSICIAN_ROLE);

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
    const updates = buildEditUserUpdates(form);
    const changes = editUserChanges(updates, raw);
    if (changes.length > 0) {
      logAudit('UserProfile', user.id, user.name, 'updated', `Profile updated: ${changes.map(c => c.field).join(', ')}`, 'Configuration', changes);
    }
    setSaving(true);
    let ok;
    try {
      ok = await tab.saveUserProfile(user.id, updates);
    } finally {
      setSaving(false);
    }
    if (ok) pop();
  };

  const ehrUsers = [`${form.first_name} ${form.last_name} (${form.ehr_mapping || 'EHR'})`, 'Amy Brenneman (Athena Health)', 'John Doe (Epic)', 'Jane Smith (Cerner)'];

  return (
    <FormScreen
      title="Edit user"
      subtitle={user.email}
      footer={<Button size="lg" disabled={!dirty} loading={saving} onClick={save}>Save</Button>}
    >
      <FieldGroup label="Access">
        <PickerField label="Administrative role" options={opts(ADMIN_ROLES)} value={form.admin_role} onChange={set('admin_role')} />
        <MultiPickerField
          label="Clinical & operational roles"
          hint="Select at least one role if the user interacts with patients or schedules appointments."
          options={roleOptions}
          value={form.clinical_roles}
          onChange={(v) => setForm(f => ({ ...f, clinical_roles: v, role: v.length ? v[0] : f.role }))}
        />
        <MultiPickerField label="Locations" options={locationNames} value={form.locations} onChange={set('locations')} />
        <MultiPickerField
          label="Specialty"
          options={MEDICAL_SPECIALTIES}
          value={isPhysician ? form.specialties : []}
          onChange={set('specialties')}
          placeholder={isPhysician ? 'Select specialty' : 'Select Physician/Doctor role first'}
          disabled={!isPhysician}
        />
      </FieldGroup>
      <FieldGroup label="EHR">
        <PickerField label="EHR system" options={opts(EHR_SYSTEMS)} value={form.ehr_mapping} onChange={set('ehr_mapping')} placeholder="Select EHR system" />
        <PickerField label="EHR user" options={opts(ehrUsers)} value={form.ehr_user} onChange={set('ehr_user')} placeholder="Select EHR user" />
      </FieldGroup>
      <FieldGroup label="Basic info">
        <Input size="lg" label="First name" required autoComplete="off" enterKeyHint="next" value={form.first_name} onValueChange={set('first_name')} errorText={nameError(form.first_name) || undefined} />
        <Input size="lg" label="Middle name" autoComplete="off" enterKeyHint="next" value={form.middle_name} onValueChange={set('middle_name')} />
        <Input size="lg" label="Last name" required autoComplete="off" enterKeyHint="next" value={form.last_name} onValueChange={set('last_name')} errorText={nameError(form.last_name) || undefined} />
        <Input size="lg" type="date" label="Date of birth" value={form.date_of_birth || ''} onValueChange={set('date_of_birth')} />
        <Input
          size="lg"
          label="Credentials"
          placeholder="e.g. Dr, NP"
          helperText="Separate multiple with commas"
          value={credText}
          onValueChange={(v) => { setCredText(v); set('credentials')(v.split(',').map(t => t.trim()).filter(Boolean)); }}
        />
        <PickerField label="Gender" options={opts(GENDER_OPTIONS)} value={form.gender} onChange={set('gender')} placeholder="Select gender" />
        <MultiPickerField label="Languages" options={LANGUAGE_OPTIONS} value={form.languages} onChange={set('languages')} />
        <MultiPickerField label="Licence state" options={US_STATES} value={form.licence_states} onChange={set('licence_states')} placeholder="Add state" />
      </FieldGroup>
      <FieldGroup label="Profile">
        <Textarea aria-label="Profile" rows={4} value={form.bio} onChange={e => set('bio')(e.target.value)} placeholder="Brief bio or description..." />
      </FieldGroup>
      <FieldGroup label="Contact">
        <Input size="lg" type="tel" label="Mobile" value={form.mobile} onValueChange={set('mobile')} placeholder="+1 234 567 890" />
        <Input size="lg" label="Email" required value={form.email} disabled />
        <Input size="lg" type="tel" label="Fax" value={form.fax} onValueChange={set('fax')} placeholder="+1 234 567 890" />
      </FieldGroup>
      <FieldGroup label="Address">
        <Input size="lg" label="Address line 1" value={form.address_line1} onValueChange={set('address_line1')} placeholder="Street address" />
        <Input size="lg" label="Address line 2" value={form.address_line2} onValueChange={set('address_line2')} placeholder="Apt, suite, etc." />
        <Input size="lg" label="City" value={form.city} onValueChange={set('city')} />
        <div className={settings.row2}>
          <Input size="lg" label="State" value={form.state} onValueChange={set('state')} />
          <Input size="lg" label="Zip code" inputMode="numeric" value={form.zip_code} onValueChange={set('zip_code')} />
        </div>
      </FieldGroup>
    </FormScreen>
  );
}

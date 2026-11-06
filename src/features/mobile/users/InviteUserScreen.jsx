import { useState } from 'react';
import { Button } from '../../../components/Button/Button';
import { DesktopOnlyNote } from '../../../components/DesktopOnlyNote/DesktopOnlyNote';
import { Icon } from '../../../components/Icon/Icon';
import { Input } from '../../../components/Input/Input';
import { Textarea } from '../../../components/Textarea/Textarea';
import { useAppStore } from '../../../store/useAppStore';
import { useRoleOptions } from '../../settings/account/access-control/useRoleOptions';
import { useLocationNames } from '../../settings/account/AccountPanelParts';
import {
  ADMIN_ROLES, GENDER_OPTIONS, LANGUAGE_OPTIONS, isCapitalizedName, sendSingleInvite,
} from '../../settings/account/InviteUserDrawer.utils';
import { useMobileNav } from '../MobileNavContext';
import { FieldGroup, FormScreen, PickerField } from '../patient/FormScreen';
import { NoAccountAccess } from './accountAccess';
import { useAccountAccess } from './useAccountAccess';
import { MultiPickerField } from './MultiPickerField';
import settings from '../settings/settings.module.css';
import styles from './users.module.css';

const opts = (arr) => arr.map(v => ({ value: v, label: v }));
// The desktop invite form's licence-state list.
const LICENCE_STATES = ['Nevada', 'New York', 'California', 'Texas', 'Florida'];
const EMPTY_FORM = {
  first_name: '', middle_name: '', last_name: '', email: '',
  admin_role: 'Business/Practice Owner', clinical_roles: [],
  gender: '', bio: '', mobile: '', fax: '', zip_code: '',
  address_line1: '', address_line2: '', state: '', city: '',
  credentials: [], licence_states: [], locations: [], languages: [],
};

/**
 * Invite one user (desktop Invite User > Single Invite). Same fields and
 * sendSingleInvite: name rules, the signup_invites pre-approval, sign-up,
 * profile extras, admin_set_user_roles and the UserProfile audit entry.
 * Bulk CSV import stays on a computer.
 */
export function InviteUserScreen() {
  const allowed = useAccountAccess();
  if (!allowed) return <NoAccountAccess title="Invite user" />;
  return <InviteUser />;
}

function InviteUser() {
  const { pop } = useMobileNav();
  const showToast = useAppStore(s => s.showToast);
  const logAudit = useAppStore(s => s.logAudit);
  const roleOptions = useRoleOptions();
  const locationNames = useLocationNames();
  const [form, setForm] = useState(EMPTY_FORM);
  const [credText, setCredText] = useState('');
  const [more, setMore] = useState(false);
  const [sending, setSending] = useState(false);
  const set = (key) => (v) => setForm(f => ({ ...f, [key]: v }));
  const nameError = (v) => (v && !isCapitalizedName(v) ? 'Must start with a capital letter' : undefined);

  const send = async () => {
    setSending(true);
    let ok = false;
    try {
      ok = await sendSingleInvite({ form, showToast, logAudit, onInvited: () => {} });
    } catch (e) {
      showToast(`Error: ${e.message}`);
    } finally {
      setSending(false);
    }
    if (ok) pop();
  };

  return (
    <FormScreen
      title="Invite user"
      footer={<Button size="lg" loading={sending} onClick={send}>Send invite</Button>}
    >
      <FieldGroup label="Basic info">
        <Input size="lg" label="First name" required autoComplete="off" enterKeyHint="next" placeholder="First Name" value={form.first_name} onValueChange={set('first_name')} errorText={nameError(form.first_name)} />
        <Input size="lg" label="Middle name" autoComplete="off" enterKeyHint="next" placeholder="Middle Name" value={form.middle_name} onValueChange={set('middle_name')} />
        <Input size="lg" label="Last name" required autoComplete="off" enterKeyHint="next" placeholder="Last Name" value={form.last_name} onValueChange={set('last_name')} errorText={nameError(form.last_name)} />
        <Input size="lg" type="email" inputMode="email" autoCapitalize="none" label="Email" required autoComplete="off" enterKeyHint="done" placeholder="Enter email" value={form.email} onValueChange={set('email')} />
      </FieldGroup>
      <FieldGroup label="Access">
        <PickerField label="Administrative role" required options={opts(ADMIN_ROLES)} value={form.admin_role} onChange={set('admin_role')} />
        <MultiPickerField
          label="Clinical & operational roles"
          required
          hint="Select at least one role if the user interacts with patients or schedules appointments."
          options={roleOptions}
          value={form.clinical_roles}
          onChange={set('clinical_roles')}
        />
      </FieldGroup>

      <button type="button" className={styles.disclosure} aria-expanded={more} onClick={() => setMore(v => !v)}>
        Additional fields
        <Icon name={more ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'} size={20} color="currentColor" />
      </button>

      {more && (
        <>
          <FieldGroup label="Profile">
            <Input
              size="lg"
              label="Credentials"
              placeholder="e.g. Dr, NP"
              helperText="Separate multiple with commas"
              value={credText}
              onValueChange={(v) => { setCredText(v); set('credentials')(v.split(',').map(t => t.trim()).filter(Boolean)); }}
            />
            <PickerField label="Gender" options={opts(GENDER_OPTIONS)} value={form.gender} onChange={set('gender')} placeholder="Select gender" />
            <Textarea aria-label="Profile" rows={4} value={form.bio} onChange={e => set('bio')(e.target.value)} placeholder="Brief bio..." />
            <MultiPickerField label="Licence state" options={LICENCE_STATES} value={form.licence_states} onChange={set('licence_states')} />
            <MultiPickerField label="Location" options={locationNames} value={form.locations} onChange={set('locations')} />
            <MultiPickerField label="Languages" options={LANGUAGE_OPTIONS} value={form.languages} onChange={set('languages')} />
          </FieldGroup>
          <FieldGroup label="Contact">
            <Input size="lg" type="tel" label="Mobile" placeholder="+1 234 567 890" value={form.mobile} onValueChange={set('mobile')} />
            <Input size="lg" type="tel" label="Fax" placeholder="+1 234 567 890" value={form.fax} onValueChange={set('fax')} />
          </FieldGroup>
          <FieldGroup label="Address">
            <Input size="lg" label="Address line 1" placeholder="Street address" value={form.address_line1} onValueChange={set('address_line1')} />
            <Input size="lg" label="Address line 2" placeholder="Apt, suite" value={form.address_line2} onValueChange={set('address_line2')} />
            <Input size="lg" label="City" value={form.city} onValueChange={set('city')} />
            <div className={settings.row2}>
              <Input size="lg" label="State" value={form.state} onValueChange={set('state')} />
              <Input size="lg" label="Zip code" inputMode="numeric" value={form.zip_code} onValueChange={set('zip_code')} />
            </div>
          </FieldGroup>
        </>
      )}

      <DesktopOnlyNote size="lg" title="Bulk import on a computer" description="Upload a CSV to invite many users at once from Settings > Account > Users on a computer." />
    </FormScreen>
  );
}

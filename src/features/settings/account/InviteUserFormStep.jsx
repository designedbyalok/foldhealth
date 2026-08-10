import { useId } from 'react';
import { Icon } from '../../../components/Icon/Icon';
import { Button } from '../../../components/Button/Button';
import { Drawer } from '../../../components/Drawer/Drawer';
import { Input } from '../../../components/Input/Input';
import { Select } from '../../../components/Select/Select';
import { RadioButton } from '../../../components/RadioButton/RadioButton';
import {
  isCapitalizedName,
  ADMIN_ROLES,
  GENDER_OPTIONS,
  LANGUAGE_OPTIONS,
  MOCK_ROLES,
} from './InviteUserDrawer.utils';
import { useLocationNames, TagInput, MultiSelectField } from './AccountPanelParts';
import styles from './AccountPanel.module.css';

export function InviteUserFormStep({ onClose, form, set, showAdditional, setShowAdditional, sending, onSendInvite }) {
  const uid = useId();
  const locationNames = useLocationNames();

  return (
    <Drawer title="Invite User" onClose={onClose} bodyClassName={styles.inviteDrawerBody} headerRight={
      <Button variant="primary" size="L" onClick={onSendInvite} disabled={sending}>{sending ? 'Sending...' : 'Send Invite'}</Button>
    }>
      <div className={styles.inviteFormScroll}>
        <h4 className={styles.formSectionTitle} style={{ borderTop: 'none', paddingTop: 0, marginTop: 0 }}>Basic Info</h4>
        <div className={styles.formGrid}>
          <div className={styles.formField}>
            <label className={styles.formLabel} htmlFor={`${uid}-first-name`}>First Name <span className={styles.required}>*</span></label>
            <Input id={`${uid}-first-name`} value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="First Name" variant={form.first_name && !isCapitalizedName(form.first_name) ? 'error' : 'default'} />
            {form.first_name && !isCapitalizedName(form.first_name) && <span className={styles.fieldError}>Must start with a capital letter</span>}
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel} htmlFor={`${uid}-middle-name`}>Middle Name</label>
            <Input id={`${uid}-middle-name`} value={form.middle_name} onChange={e => set('middle_name', e.target.value)} placeholder="Middle Name" />
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel} htmlFor={`${uid}-last-name`}>Last Name <span className={styles.required}>*</span></label>
            <Input id={`${uid}-last-name`} value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Last Name" variant={form.last_name && !isCapitalizedName(form.last_name) ? 'error' : 'default'} />
            {form.last_name && !isCapitalizedName(form.last_name) && <span className={styles.fieldError}>Must start with a capital letter</span>}
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel} htmlFor={`${uid}-email`}>Email <span className={styles.required}>*</span></label>
            <Input id={`${uid}-email`} value={form.email} onChange={e => set('email', e.target.value)} placeholder="Enter email" type="email" />
          </div>
        </div>

        <div className={styles.formSection}>
          {/* Names the radiogroup rather than a single control, so aria-labelledby not htmlFor. */}
          <span className={styles.formLabel} id={`${uid}-admin-roles`}>Administrative Roles <span className={styles.required}>*</span></span>
          <div className={styles.radioGroup} role="radiogroup" aria-labelledby={`${uid}-admin-roles`}>
            {ADMIN_ROLES.map(role => (
              <RadioButton key={role} label={role} checked={form.admin_role === role} onChange={() => set('admin_role', role)} />
            ))}
          </div>
        </div>

        <div className={styles.formSection}>
          <span className={styles.formLabel}>Clinical & Operational Roles <span className={styles.required}>*</span></span>
          <p className={styles.formHint}>Select at least one role if the user interacts with patients or schedules appointments.</p>
          <MultiSelectField label="" options={MOCK_ROLES} value={form.clinical_roles} onChange={v => set('clinical_roles', v)} />
        </div>

        <button className={styles.additionalToggle} onClick={() => setShowAdditional(v => !v)}>
          Additional Fields <Icon name={showAdditional ? 'solar:alt-arrow-down-linear' : 'solar:alt-arrow-right-linear'} size={14} color="var(--neutral-400)" />
        </button>

        {showAdditional && (
          <>
            <div className={styles.formGrid}>
              <div className={styles.formField}>
                <label className={styles.formLabel} htmlFor={`${uid}-credentials`}>Credentials <span className={styles.required}>*</span></label>
                <TagInput inputId={`${uid}-credentials`} value={form.credentials} onChange={v => set('credentials', v)} placeholder="e.g. Dr, NP" />
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel} htmlFor={`${uid}-gender`}>Gender <span className={styles.required}>*</span></label>
                <Select id={`${uid}-gender`} options={GENDER_OPTIONS.map(g => ({ value: g, label: g }))} value={form.gender || undefined} onChange={v => set('gender', v)} placeholder="Select gender" />
              </div>
            </div>

            <div className={styles.formSection}>
              <label className={styles.formLabel} htmlFor={`${uid}-bio`}>Profile</label>
              <textarea id={`${uid}-bio`} className={styles.formTextarea} rows={4} value={form.bio} onChange={e => set('bio', e.target.value)} placeholder="Brief bio..." />
            </div>

            <MultiSelectField label="Licence State" required options={['Nevada', 'New York', 'California', 'Texas', 'Florida']} value={form.licence_states} onChange={v => set('licence_states', v)} />
            <MultiSelectField label="Location" required options={locationNames} value={form.locations} onChange={v => set('locations', v)} />
            <MultiSelectField label="Languages" required options={LANGUAGE_OPTIONS} value={form.languages} onChange={v => set('languages', v)} />

            <h4 className={styles.formSectionTitle}>Contact Info</h4>
            <div className={styles.formGrid}>
              <div className={styles.formField}>
                <label className={styles.formLabel} htmlFor={`${uid}-mobile`}>Mobile Number <span className={styles.required}>*</span></label>
                <Input id={`${uid}-mobile`} value={form.mobile} onChange={e => set('mobile', e.target.value)} placeholder="+1 234 567 890" />
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel} htmlFor={`${uid}-contact-email`}>Email <span className={styles.required}>*</span></label>
                <Input id={`${uid}-contact-email`} value={form.email} disabled />
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel} htmlFor={`${uid}-fax`}>Fax Number <span className={styles.required}>*</span></label>
                <Input id={`${uid}-fax`} value={form.fax} onChange={e => set('fax', e.target.value)} placeholder="+1 234 567 890" />
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel} htmlFor={`${uid}-zip`}>Zip Code <span className={styles.required}>*</span></label>
                <Input id={`${uid}-zip`} value={form.zip_code} onChange={e => set('zip_code', e.target.value)} placeholder="12345" />
              </div>
            </div>

            <h4 className={styles.formSectionTitle}>Additional Info</h4>
            <div className={styles.formGrid}>
              <div className={styles.formField}>
                <label className={styles.formLabel} htmlFor={`${uid}-address1`}>Address Line 1 <span className={styles.required}>*</span></label>
                <Input id={`${uid}-address1`} value={form.address_line1} onChange={e => set('address_line1', e.target.value)} placeholder="Street address" />
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel} htmlFor={`${uid}-address2`}>Address Line 2 <span className={styles.required}>*</span></label>
                <Input id={`${uid}-address2`} value={form.address_line2} onChange={e => set('address_line2', e.target.value)} placeholder="Apt, suite" />
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel} htmlFor={`${uid}-state`}>State <span className={styles.required}>*</span></label>
                <Input id={`${uid}-state`} value={form.state} onChange={e => set('state', e.target.value)} placeholder="State" />
              </div>
              <div className={styles.formField}>
                <label className={styles.formLabel} htmlFor={`${uid}-city`}>City <span className={styles.required}>*</span></label>
                <Input id={`${uid}-city`} value={form.city} onChange={e => set('city', e.target.value)} placeholder="City" />
              </div>
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}

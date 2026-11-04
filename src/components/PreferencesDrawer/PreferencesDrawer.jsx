import { useState, useEffect, useCallback, useId } from 'react';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store/useAppStore';
import { isCapitalizedName } from '../../lib/nameValidation';
import {
  PROFILE_FIELD_TYPES,
  PROFILE_FIELD_VALIDATORS,
  PROFILE_GENDER_OPTIONS,
  PROFILE_LANGUAGE_OPTIONS,
  sanitizeProfileForDb,
  validateProfileForm,
} from '../../lib/profileValidation';
import { Icon } from '../Icon/Icon';
import { Drawer } from '../Drawer/Drawer';
import { Input } from '../Input/Input';
import { Textarea } from '../Textarea/Textarea';
import { Button } from '../Button/Button';
import { Avatar } from '../Avatar/Avatar';
import { Badge } from '../Badge/Badge';
import { ActionButton } from '../ActionButton/ActionButton';
import { RadioButton } from '../RadioButton/RadioButton';
import { Select } from '../Select/Select';
import { OooPreferencesSection } from '../../features/ooo/OooRecordsDrawers';
import { OOO_ICON } from '../../features/ooo/oooUtils';
import styles from './PreferencesDrawer.module.css';

const PREF_TABS = [
  { key: 'notifications', icon: 'solar:bell-linear', label: 'Notification Settings' },
  { key: 'email', icon: 'solar:letter-linear', label: 'Email Settings' },
  { key: 'ooo', icon: OOO_ICON, label: 'Out of Office' },
  { key: 'account', icon: 'solar:user-circle-linear', label: 'Account & Profile' },
];

function getInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] || '') + (parts[parts.length - 1]?.[0] || '');
}

export function PreferencesDrawer({ onClose, initialTab = 'account' }) {
  const uid = useId();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [inboxView, setInboxView] = useState('all');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const showToast = useAppStore(s => s.showToast);
  const logAudit = useAppStore(s => s.logAudit);

  // Fetch current user's profile
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (data) {
          setProfile(data);
          setForm({
            first_name: data.first_name || user.user_metadata?.first_name || '',
            last_name: data.last_name || user.user_metadata?.last_name || '',
            middle_name: data.middle_name || '',
            date_of_birth: data.date_of_birth ? String(data.date_of_birth).slice(0, 10) : '',
            gender: data.gender || '',
            bio: data.bio || '',
            mobile: data.mobile || data.phone || '',
            email: data.email || user.email || '',
            fax: data.fax || '',
            zip_code: data.zip_code || '',
            address_line1: data.address_line1 || '',
            address_line2: data.address_line2 || '',
            state: data.state || '',
            city: data.city || '',
            languages: data.languages || [],
          });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    if (fieldErrors[key]) {
      setFieldErrors(e => {
        const next = { ...e };
        delete next[key];
        return next;
      });
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    const { valid, errors } = validateProfileForm(form);
    if (!valid) {
      setFieldErrors(errors);
      showToast(Object.values(errors)[0]);
      return;
    }
    setFieldErrors({});
    const updates = sanitizeProfileForDb(form);
    const { error } = await supabase.from('profiles').update(updates).eq('id', profile.id);
    if (!error) {
      // Also update auth metadata
      await supabase.auth.updateUser({ data: { first_name: form.first_name, last_name: form.last_name, full_name: updates.full_name } });
      logAudit('UserProfile', profile.id, updates.full_name, 'updated', 'Profile self-updated', 'Configuration');
      showToast('Profile updated');
    } else {
      showToast(`Error: ${error.message}`);
    }
  };

  const userName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.full_name || profile.email : '';
  const initials = getInitials(userName).toUpperCase();

  return (
    <Drawer title="PREFERENCES" onClose={onClose} className={styles.drawerWide} headerStyle={{ padding: '10px 16px', borderBottom: '0.5px solid var(--neutral-150)' }} titleStyle={{ fontSize: 'var(--font-sm)', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--neutral-300)' }} bodyClassName={styles.drawerBody}>
      <div className={styles.layout}>
        {/* Left sidebar */}
        <div className={styles.sidebar}>
          {PREF_TABS.map(tab => (
            <button
              key={tab.key}
              className={`${styles.sidebarItem} ${activeTab === tab.key ? styles.sidebarItemActive : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon name={tab.icon} size={16} color={activeTab === tab.key ? 'var(--primary-300)' : 'var(--neutral-300)'} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Right content */}
        <div className={styles.content}>
          {/* Section title bar */}
          {activeTab !== 'account' && activeTab !== 'ooo' && (
            <div className={styles.sectionHeader}>
              <h3 className={styles.contentTitle}>{PREF_TABS.find(t => t.key === activeTab)?.label?.toUpperCase() || ''}</h3>
              <ActionButton icon="solar:close-linear" size="sm" tooltip="Close" onClick={onClose} />
            </div>
          )}

          {activeTab === 'ooo' ? (
            <OooPreferencesSection />
          ) : activeTab === 'account' ? (
            loading ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--neutral-300)' }}>Loading profile...</div>
            ) : (
              <div className={styles.profileForm}>
                {/* User header: same as Account edit drawer */}
                <div className={styles.editHeader}>
                  <div className={styles.avatarUploadWrap}>
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="" className={styles.profileAvatarImg} />
                    ) : (
                      <Avatar variant="assignee" initials={initials} className={styles.profileAvatar} />
                    )}
                    <label className={styles.avatarUploadBtn}>
                      <Icon name="solar:camera-linear" size={12} color="#fff" />
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !profile) return;
                          const ext = file.name.split('.').pop();
                          const path = `avatars/${profile.id}.${ext}`;
                          const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
                          if (uploadErr) { showToast('Upload failed'); return; }
                          const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
                          await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', profile.id);
                          setProfile(p => ({ ...p, avatar_url: publicUrl }));
                          showToast('Photo updated');
                        }}
                      />
                    </label>
                  </div>
                  <div className={styles.editHeaderInfo}>
                    <div className={styles.editHeaderName}>
                      {userName || 'User'}
                      {profile?.status === 'Active' && <Icon name="solar:verified-check-bold" size={16} color="var(--status-success)" />}
                    </div>
                    <span className={styles.editHeaderEmail}>{form.email}</span>
                  </div>
                  <div className={styles.editHeaderActions}>
                    <Button variant="ghost" size="sm" onClick={onClose}>Discard</Button>
                    <Button size="sm" onClick={handleSave}>Save</Button>
                  </div>
                </div>

                <div className={styles.profileFormContent}>
                {/* Basic Info */}
                <h4 className={styles.sectionTitle} style={{ marginTop: 0, borderTop: 'none', paddingTop: 0 }}>Basic Info</h4>
                <div className={styles.formGrid}>
                  <div className={styles.formField}>
                    <label className={styles.formLabel} htmlFor={`${uid}-first-name`}>First Name *</label>
                    <Input
                      id={`${uid}-first-name`}
                      value={form.first_name}
                      onChange={e => set('first_name', e.target.value)}
                      placeholder="First name"
                      maxLength={PROFILE_FIELD_TYPES.first_name.maxLength}
                      validate={PROFILE_FIELD_VALIDATORS.first_name}
                      validateOn="blur"
                      errorText={fieldErrors.first_name}
                      invalid={fieldErrors.first_name || (form.first_name && !isCapitalizedName(form.first_name))}
                    />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.formLabel} htmlFor={`${uid}-last-name`}>Last Name *</label>
                    <Input
                      id={`${uid}-last-name`}
                      value={form.last_name}
                      onChange={e => set('last_name', e.target.value)}
                      placeholder="Last name"
                      maxLength={PROFILE_FIELD_TYPES.last_name.maxLength}
                      validate={PROFILE_FIELD_VALIDATORS.last_name}
                      validateOn="blur"
                      errorText={fieldErrors.last_name}
                      invalid={fieldErrors.last_name || (form.last_name && !isCapitalizedName(form.last_name))}
                    />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.formLabel} htmlFor={`${uid}-gender`}>Gender</label>
                    <Select
                      id={`${uid}-gender`}
                      options={PROFILE_GENDER_OPTIONS.map(g => ({ value: g, label: g }))}
                      value={form.gender || undefined}
                      onValueChange={v => set('gender', v)}
                      placeholder="Select gender"
                      portal
                      invalid={fieldErrors.gender}
                      errorText={fieldErrors.gender}
                    />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.formLabel} htmlFor={`${uid}-dob`}>Date of Birth</label>
                    <Input
                      id={`${uid}-dob`}
                      type="date"
                      value={form.date_of_birth || ''}
                      onChange={e => set('date_of_birth', e.target.value)}
                      validate={PROFILE_FIELD_VALIDATORS.date_of_birth}
                      validateOn="blur"
                      errorText={fieldErrors.date_of_birth}
                      invalid={fieldErrors.date_of_birth}
                    />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.formLabel} htmlFor={`${uid}-mobile`}>Mobile Number</label>
                    <Input
                      id={`${uid}-mobile`}
                      type="tel"
                      value={form.mobile}
                      onChange={e => set('mobile', e.target.value)}
                      placeholder="+1 234 567 890"
                      maxLength={PROFILE_FIELD_TYPES.mobile.maxLength}
                      validate={PROFILE_FIELD_VALIDATORS.mobile}
                      validateOn="blur"
                      errorText={fieldErrors.mobile}
                      invalid={fieldErrors.mobile}
                    />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.formLabel} htmlFor={`${uid}-email`}>Email</label>
                    <Input id={`${uid}-email`} type="email" value={form.email} disabled />
                  </div>
                </div>

                <div className={styles.formField} style={{ marginTop: 16 }}>
                  <label className={styles.formLabel} htmlFor={`${uid}-languages`}>Languages</label>
                  <Select
                    id={`${uid}-languages`}
                    multiple
                    searchable
                    portal
                    options={PROFILE_LANGUAGE_OPTIONS.map(l => ({ value: l, label: l }))}
                    value={form.languages || []}
                    onValueChange={v => set('languages', v)}
                    placeholder="Select languages..."
                    invalid={fieldErrors.languages}
                    errorText={fieldErrors.languages}
                  />
                </div>

                <div className={styles.formField} style={{ marginTop: 16 }}>
                  <label className={styles.formLabel} htmlFor={`${uid}-bio`}>Bio</label>
                  <Textarea
                    id={`${uid}-bio`}
                    rows={3}
                    value={form.bio}
                    onValueChange={text => set('bio', text)}
                    placeholder="Brief bio..."
                    maxLength={PROFILE_FIELD_TYPES.bio.maxLength}
                    invalid={fieldErrors.bio}
                  />
                  {fieldErrors.bio && <span className={styles.fieldError}>{fieldErrors.bio}</span>}
                </div>

                {/* Address */}
                <h4 className={styles.sectionTitle}>Address</h4>
                <div className={styles.formGrid}>
                  <div className={styles.formField}>
                    <label className={styles.formLabel} htmlFor={`${uid}-address1`}>Address Line 1</label>
                    <Input
                      id={`${uid}-address1`}
                      value={form.address_line1}
                      onChange={e => set('address_line1', e.target.value)}
                      placeholder="Street address"
                      maxLength={PROFILE_FIELD_TYPES.address_line1.maxLength}
                      validate={PROFILE_FIELD_VALIDATORS.address_line1}
                      validateOn="blur"
                      errorText={fieldErrors.address_line1}
                      invalid={fieldErrors.address_line1}
                    />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.formLabel} htmlFor={`${uid}-address2`}>Address Line 2</label>
                    <Input
                      id={`${uid}-address2`}
                      value={form.address_line2}
                      onChange={e => set('address_line2', e.target.value)}
                      placeholder="Apt, suite"
                      maxLength={PROFILE_FIELD_TYPES.address_line2.maxLength}
                      validate={PROFILE_FIELD_VALIDATORS.address_line2}
                      validateOn="blur"
                      errorText={fieldErrors.address_line2}
                      invalid={fieldErrors.address_line2}
                    />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.formLabel} htmlFor={`${uid}-city`}>City</label>
                    <Input
                      id={`${uid}-city`}
                      value={form.city}
                      onChange={e => set('city', e.target.value)}
                      placeholder="City"
                      maxLength={PROFILE_FIELD_TYPES.city.maxLength}
                      validate={PROFILE_FIELD_VALIDATORS.city}
                      validateOn="blur"
                      errorText={fieldErrors.city}
                      invalid={fieldErrors.city}
                    />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.formLabel} htmlFor={`${uid}-state`}>State</label>
                    <Input
                      id={`${uid}-state`}
                      value={form.state}
                      onChange={e => set('state', e.target.value)}
                      placeholder="State"
                      maxLength={PROFILE_FIELD_TYPES.state.maxLength}
                      validate={PROFILE_FIELD_VALIDATORS.state}
                      validateOn="blur"
                      errorText={fieldErrors.state}
                      invalid={fieldErrors.state}
                    />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.formLabel} htmlFor={`${uid}-zip`}>Zip Code</label>
                    <Input
                      id={`${uid}-zip`}
                      value={form.zip_code}
                      onChange={e => set('zip_code', e.target.value)}
                      placeholder="12345"
                      validate={PROFILE_FIELD_VALIDATORS.zip_code}
                      validateOn="blur"
                      errorText={fieldErrors.zip_code}
                      invalid={fieldErrors.zip_code}
                    />
                  </div>
                </div>

                </div>
              </div>
            )
          ) : activeTab === 'email' ? (
            <div className={styles.contentPadded}>
              <div className={styles.settingsCard}>
                <div className={styles.settingsCardTitle}>EMAIL INBOX VIEW</div>
                <p className={styles.settingsCardDesc}>Choose the default view for your email inbox to display specific types of messages.</p>
                <div className={styles.radioList} role="radiogroup">
                  {[
                    { value: 'all', label: 'All (includes Patients, Leads, Contacts & others)' },
                    { value: 'patients', label: 'Only Patients, Leads and Contacts' },
                    { value: 'others', label: 'Only Others' },
                  ].map(opt => (
                    <RadioButton
                      key={opt.value}
                      label={opt.label}
                      checked={inboxView === opt.value}
                      onChange={() => setInboxView(opt.value)}
                    />
                  ))}
                </div>
              </div>
              <div className={styles.settingsCard}>
                <div className={styles.settingsCardTitle}>EMAIL SIGNATURE</div>
                <p className={styles.settingsCardDesc}>Add and edit your customized signatures that will be added to your mail. Signature created in other platforms will not sync with Fold.</p>
                <div className={styles.signatureEmpty}>
                  <Icon name="solar:pen-new-square-linear" size={32} color="var(--neutral-150)" />
                  <p>Add and edit your customized signatures that will be added to your mail.</p>
                  <Button>Add Signature</Button>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.contentPadded}>
              <div className={styles.settingsCard}>
                <p className={styles.settingsCardDesc}>Notification preferences coming soon.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
}

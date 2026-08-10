import { useState, useEffect, useCallback, useId } from 'react';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store/useAppStore';
import { Icon } from '../Icon/Icon';
import { Drawer } from '../Drawer/Drawer';
import { Input } from '../Input/Input';
import { Button } from '../Button/Button';
import { Avatar } from '../Avatar/Avatar';
import { Badge } from '../Badge/Badge';
import { ActionButton } from '../ActionButton/ActionButton';
import { RadioButton } from '../RadioButton/RadioButton';
import { Select } from '../Select/Select';
import styles from './PreferencesDrawer.module.css';

const PREF_TABS = [
  { key: 'notifications', icon: 'solar:bell-linear', label: 'Notification Settings' },
  { key: 'email', icon: 'solar:letter-linear', label: 'Email Settings' },
  { key: 'account', icon: 'solar:user-circle-linear', label: 'Account & Profile' },
];

const ADMIN_ROLES = ['Business/Practice Owner', 'Operations/Clinical Analyst', 'Employer'];
const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];
const LANGUAGE_OPTIONS = ['English', 'Spanish', 'Cantonese', 'Mandarin', 'Vietnamese', 'Korean', 'Tagalog', 'Arabic', 'French', 'Hindi'];

function getInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] || '') + (parts[parts.length - 1]?.[0] || '');
}

/* ── Multi-select (reused from AccountPanel pattern) ── */
function MultiSelect({ options, value = [], onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const valueSet = new Set(value);
  const toggle = (opt) => onChange(valueSet.has(opt) ? value.filter(v => v !== opt) : [...value, opt]);
  return (
    <div style={{ position: 'relative' }}>
      <div className={styles.tagInput} onClick={() => setOpen(v => !v)} style={{ cursor: 'pointer' }}>
        {value.length > 0 ? value.map(v => (
          <span key={v} className={styles.tag}>
            {v}
            <button className={styles.tagClose} onClick={e => { e.stopPropagation(); toggle(v); }}>
              <Icon name="solar:close-linear" size={10} color="var(--neutral-300)" />
            </button>
          </span>
        )) : <span style={{ color: 'var(--neutral-200)', fontSize: 14 }}>{placeholder || 'Select...'}</span>}
        <Icon name="solar:alt-arrow-down-linear" size={10} color="var(--neutral-300)" style={{ marginLeft: 'auto', flexShrink: 0 }} />
      </div>
      {open && (
        <div className={styles.multiSelectDropdown}>
          {options.map(opt => (
            <label key={opt} className={styles.multiSelectOption}>
              <input type="checkbox" checked={valueSet.has(opt)} onChange={() => toggle(opt)} />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export function PreferencesDrawer({ onClose }) {
  const uid = useId();
  const [activeTab, setActiveTab] = useState('account');
  const [inboxView, setInboxView] = useState('all');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({});
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
            date_of_birth: data.date_of_birth || '',
            gender: data.gender || '',
            admin_role: data.admin_role || 'Business/Practice Owner',
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

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = async () => {
    if (!profile) return;
    const updates = {
      full_name: `${form.first_name} ${form.last_name}`.trim(),
      ...form,
    };
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
    <Drawer title="PREFERENCES" onClose={onClose} className={styles.drawerWide} headerStyle={{ padding: '10px 16px', borderBottom: '0.5px solid var(--neutral-150)' }} titleStyle={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--neutral-300)' }} bodyClassName={styles.drawerBody}>
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
          {activeTab !== 'account' && (
            <div className={styles.sectionHeader}>
              <h3 className={styles.contentTitle}>{PREF_TABS.find(t => t.key === activeTab)?.label?.toUpperCase() || ''}</h3>
              <ActionButton icon="solar:close-linear" size="S" tooltip="Close" onClick={onClose} />
            </div>
          )}

          {activeTab === 'account' ? (
            loading ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--neutral-300)' }}>Loading profile...</div>
            ) : (
              <div className={styles.profileForm}>
                {/* User header — same as Account edit drawer */}
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
                    <Button variant="ghost" size="S" onClick={onClose}>Discard</Button>
                    <Button variant="primary" size="S" onClick={handleSave}>Save</Button>
                  </div>
                </div>

                <div className={styles.profileFormContent}>
                {/* Basic Info */}
                <h4 className={styles.sectionTitle} style={{ marginTop: 0, borderTop: 'none', paddingTop: 0 }}>Basic Info</h4>
                <div className={styles.formGrid}>
                  <div className={styles.formField}>
                    <label className={styles.formLabel} htmlFor={`${uid}-first-name`}>First Name *</label>
                    <Input id={`${uid}-first-name`} value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="First name" />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.formLabel} htmlFor={`${uid}-last-name`}>Last Name *</label>
                    <Input id={`${uid}-last-name`} value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Last name" />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.formLabel} htmlFor={`${uid}-gender`}>Gender</label>
                    <Select
                      id={`${uid}-gender`}
                      options={GENDER_OPTIONS.map(g => ({ value: g, label: g }))}
                      value={form.gender || undefined}
                      onChange={v => set('gender', v)}
                      placeholder="Select gender"
                    />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.formLabel} htmlFor={`${uid}-dob`}>Date of Birth</label>
                    <div className={styles.dateInputWrap}>
                      <input id={`${uid}-dob`} type="date" className={styles.dateInput} value={form.date_of_birth || ''} onChange={e => set('date_of_birth', e.target.value)} />
                    </div>
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.formLabel} htmlFor={`${uid}-mobile`}>Mobile Number</label>
                    <Input id={`${uid}-mobile`} value={form.mobile} onChange={e => set('mobile', e.target.value)} placeholder="+1 234 567 890" />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.formLabel} htmlFor={`${uid}-email`}>Email</label>
                    <Input id={`${uid}-email`} value={form.email} disabled />
                  </div>
                </div>

                <div className={styles.formField} style={{ marginTop: 16 }}>
                  {/* Not a <label>: MultiSelect's trigger is a div, which htmlFor can't target. */}
                  <span className={styles.formLabel}>Languages</span>
                  <MultiSelect options={LANGUAGE_OPTIONS} value={form.languages} onChange={v => set('languages', v)} placeholder="Select languages..." />
                </div>

                <div className={styles.formField} style={{ marginTop: 16 }}>
                  <label className={styles.formLabel} htmlFor={`${uid}-bio`}>Bio</label>
                  <textarea id={`${uid}-bio`} className={styles.formTextarea} rows={3} value={form.bio} onChange={e => set('bio', e.target.value)} placeholder="Brief bio..." />
                </div>

                {/* Address */}
                <h4 className={styles.sectionTitle}>Address</h4>
                <div className={styles.formGrid}>
                  <div className={styles.formField}>
                    <label className={styles.formLabel} htmlFor={`${uid}-address1`}>Address Line 1</label>
                    <Input id={`${uid}-address1`} value={form.address_line1} onChange={e => set('address_line1', e.target.value)} placeholder="Street address" />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.formLabel} htmlFor={`${uid}-address2`}>Address Line 2</label>
                    <Input id={`${uid}-address2`} value={form.address_line2} onChange={e => set('address_line2', e.target.value)} placeholder="Apt, suite" />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.formLabel} htmlFor={`${uid}-city`}>City</label>
                    <Input id={`${uid}-city`} value={form.city} onChange={e => set('city', e.target.value)} placeholder="City" />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.formLabel} htmlFor={`${uid}-state`}>State</label>
                    <Input id={`${uid}-state`} value={form.state} onChange={e => set('state', e.target.value)} placeholder="State" />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.formLabel} htmlFor={`${uid}-zip`}>Zip Code</label>
                    <Input id={`${uid}-zip`} value={form.zip_code} onChange={e => set('zip_code', e.target.value)} placeholder="12345" />
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
                  <Button variant="primary" size="L">Add Signature</Button>
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

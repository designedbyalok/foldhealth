import { useState, useEffect, useRef, useId } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAppStore } from '../../../store/useAppStore';
import { Icon } from '../../../components/Icon/Icon';
import { Button } from '../../../components/Button/Button';
import { Input } from '../../../components/Input/Input';
import { Textarea } from '../../../components/Textarea/Textarea';
import { Switch } from '../../../components/Switch/Switch';
import { FoldHealthLogo } from '../../../components/FoldHealthLogo/FoldHealthLogo';
import { ColorInput } from '../../email-builder/ColorInput';
import styles from './OrgPanel.module.css';

const SOCIAL_FIELDS = [
  { key: 'twitter', icon: 'ri:twitter-x-fill', label: 'Twitter (X)', placeholder: 'Enter Twitter Link' },
  { key: 'instagram', icon: 'mdi:instagram', label: 'Instagram', placeholder: 'Enter Instagram Link' },
  { key: 'facebook', icon: 'mdi:facebook', label: 'Facebook', placeholder: 'Enter Facebook Link' },
  { key: 'linkedin', icon: 'mdi:linkedin', label: 'LinkedIn', placeholder: 'Enter LinkedIn Link' },
  { key: 'website', icon: 'solar:global-linear', label: 'Website', placeholder: 'Enter Website Link' },
];

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export function OrgPanel() {
  const uid = useId();
  const [logo, setLogo] = useState(null);
  const [name, setName] = useState('');
  const [showName, setShowName] = useState(false);
  const [primaryColor, setPrimaryColor] = useState('#8C5AE2');
  const [about, setAbout] = useState('');
  const [socials, setSocials] = useState({ twitter: '', instagram: '', facebook: '', linkedin: '', website: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const showToast = useAppStore(s => s.showToast);

  useEffect(() => {
    let cancelled = false;
    const loadOrgData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || cancelled) return;

        const { data, error } = await supabase
          .from('org_settings')
          .select('*')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (cancelled) return;
        if (error) throw error;
        if (data) {
          setName(data.name || '');
          setShowName(!!data.show_name);
          setPrimaryColor(data.primary_color || '#8C5AE2');
          setAbout(data.about || '');
          setLogo(data.logo_url || null);
          setSocials({
            twitter: data.twitter || '',
            instagram: data.instagram || '',
            facebook: data.facebook || '',
            linkedin: data.linkedin || '',
            website: data.website || '',
          });
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load org settings:', err);
        showToast('Failed to load organization settings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadOrgData();
    return () => { cancelled = true; };
  }, [showToast]);

  // Read an image file into a data URL — no storage bucket needed, and SVGs
  // render cleanly in an <img>. Persisted as-is in the logo_url text column.
  const readLogoFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file (PNG, JPG, or SVG)');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      showToast('Logo must be under 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogo(reader.result);
    reader.onerror = () => showToast('Failed to read image');
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    readLogoFile(e.dataTransfer.files?.[0]);
  };

  const setSocial = (key, value) => setSocials(prev => ({ ...prev, [key]: value }));

  const saveOrgData = async () => {
    if (!name.trim()) {
      showToast('Organization name is required');
      return;
    }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { showToast('Not authenticated'); return; }

      const { error } = await supabase
        .from('org_settings')
        .upsert({
          user_id: session.user.id,
          name,
          show_name: showName,
          primary_color: primaryColor,
          about,
          logo_url: logo,
          twitter: socials.twitter,
          instagram: socials.instagram,
          facebook: socials.facebook,
          linkedin: socials.linkedin,
          website: socials.website,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (error) throw error;
      showToast('Organization settings saved');
    } catch (err) {
      console.error('Failed to save org settings:', err);
      showToast('Failed to save organization settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className={styles.container}><div className={styles.loading}>Loading…</div></div>;
  }

  return (
    <div className={styles.container}>
      {/* Logo */}
      <div className={styles.formGroup}>
        <label className={styles.label} htmlFor={`${uid}-logo`}>Logo<span className={styles.required}>*</span></label>
        <input
          id={`${uid}-logo`}
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/*"
          style={{ display: 'none' }}
          onChange={e => { readLogoFile(e.target.files?.[0]); e.target.value = ''; }}
        />
        <div
          className={[
            styles.dropZone,
            logo ? styles.dropZoneFilled : styles.dropZoneEmpty,
            dragOver ? styles.dropZoneDrag : '',
          ].filter(Boolean).join(' ')}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
          onDrop={handleDrop}
        >
          {logo ? (
            <>
              <img src={logo} alt="Organization logo" className={styles.logoImg} />
              <Button
                variant="secondary"
                size="S"
                iconOnly
                leadingIcon="solar:trash-bin-trash-linear"
                className={styles.removeLogo}
                onClick={(e) => { e.stopPropagation(); setLogo(null); }}
                aria-label="Remove logo"
              />
            </>
          ) : (
            <div className={styles.dropPrompt}>
              <Icon name="solar:upload-minimalistic-linear" size={20} color="var(--neutral-300)" />
              <span>Drag and drop Logo here or <span className={styles.selectFiles}>Select Files</span></span>
            </div>
          )}
        </div>
      </div>

      {/* Name */}
      <div className={styles.formGroup}>
        <label className={styles.label} htmlFor={`${uid}-org-name`}>Name<span className={styles.required}>*</span></label>
        <Input
          id={`${uid}-org-name`}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Enter the Org Name"
        />
        {logo && (
          <div className={styles.showNameRow}>
            <Switch checked={showName} onChange={setShowName} label="Show Name" />
          </div>
        )}
      </div>

      {/* Primary Color */}
      <div className={styles.formGroup}>
        <ColorInput
          label="Primary Color"
          value={primaryColor}
          onChange={setPrimaryColor}
          allowGradient={false}
        />
      </div>

      {/* Preview — only once a logo exists */}
      {logo && (
        <div className={styles.formGroup}>
          <span className={styles.label}>Preview</span>
          <div className={styles.previewBox}>
            <div className={styles.previewLockup}>
              <img src={logo} alt="" className={styles.previewLogo} />
              {showName && name.trim() && <span className={styles.previewName}>{name}</span>}
            </div>
            <span className={styles.previewDivider} />
            <div className={styles.poweredBy}>
              <span className={styles.poweredByLabel}>Powered By</span>
              <div className={styles.poweredByBrand}>
                <FoldHealthLogo size={14} color={primaryColor} />
                <span className={styles.poweredByName}>Foldhealth</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* About */}
      <div className={styles.formGroup}>
        <label className={styles.label} htmlFor={`${uid}-about`}>About</label>
        <Textarea
          id={`${uid}-about`}
          value={about}
          onChange={e => setAbout(e.target.value)}
          placeholder="Enter Details about your Org"
          rows={3}
        />
      </div>

      {/* Social Accounts */}
      <div className={styles.formGroup}>
        <h3 className={styles.sectionHeader}>Social Accounts</h3>
        <div className={styles.socialList}>
          {SOCIAL_FIELDS.map(f => (
            <div key={f.key} className={styles.socialRow}>
              <div className={styles.socialLabel}>
                <Icon name={f.icon} size={16} color="var(--neutral-400)" />
                <span>{f.label}</span>
              </div>
              <Input
                className={styles.socialInput}
                value={socials[f.key]}
                onChange={e => setSocial(f.key, e.target.value)}
                placeholder={f.placeholder}
              />
            </div>
          ))}
        </div>
      </div>

      <div className={styles.formGroup}>
        <Button
          onClick={saveOrgData}
          disabled={saving}
          variant="primary"
          size="L"
          className={styles.saveButton}
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}

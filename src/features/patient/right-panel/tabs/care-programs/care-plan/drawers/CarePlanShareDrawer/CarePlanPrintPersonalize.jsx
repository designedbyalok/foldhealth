import { useRef, useState } from 'react';
import { Select } from '../../../../../../../../components/Select/Select';
import { Switch } from '../../../../../../../../components/Switch/Switch';
import { Button } from '../../../../../../../../components/Button/Button';
import { ActionButton } from '../../../../../../../../components/ActionButton/ActionButton';
import { Badge } from '../../../../../../../../components/Badge/Badge';
import { Input } from '../../../../../../../../components/Input/Input';
import { MenuPopover } from '../../../../../../../../components/MenuPopover/MenuPopover';
import { ConfirmDialog } from '../../../../../../../../components/ConfirmDialog/ConfirmDialog';
import { RadioOptionGroup } from '../../../../../../../../components/RadioOptionGroup/RadioOptionGroup';
import { Checkbox } from '../../../../../../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { TEMPLATE_SCOPES } from '../../lib/templateScope';
import { DEMOGRAPHIC_FIELDS, FORMAT_OPTIONS, GROUP_BY_OPTIONS } from '../../lib/carePlanPrintSettings';
import styles from './CarePlanPrintPersonalize.module.css';

const NO_PRESET = '__none';
const STANDARD_FOOTER = '__standard';
const LOGO_ACCEPT = '.png,.jpg,.jpeg';
const LOGO_MAX_MB = 2;
const PRESET_SCOPES = ['org', 'user'];

function readImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve({ dataUrl: reader.result, name: file.name, width: img.width, height: img.height });
      img.onerror = () => resolve(null);
      img.src = reader.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

/** Logo row: the logo printed above the title, with Change and Reset. */
function LogoField({ logo, custom, onPick, onReset }) {
  const inputRef = useRef(null);
  const [error, setError] = useState('');
  const shown = custom || logo;
  return (
    <>
      <div className={styles.logoRow}>
        {shown?.dataUrl && <span className={styles.logoThumb}><img src={shown.dataUrl} alt="" /></span>}
        <span className={styles.logoName}>{custom?.name || 'Clinic logo'}</span>
        {custom && <Button variant="tertiary" size="S" onClick={() => { setError(''); onReset(); }}>Reset</Button>}
        <Button variant="secondary" size="S" leadingIcon="solar:upload-minimalistic-linear" onClick={() => inputRef.current?.click()}>
          Change
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={LOGO_ACCEPT}
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            if (file.size > LOGO_MAX_MB * 1024 * 1024) { setError(`The logo can be up to ${LOGO_MAX_MB} MB.`); return; }
            const img = await readImage(file);
            if (!img) { setError("That file couldn't be read as an image."); return; }
            setError('');
            onPick(img);
          }}
        />
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </>
  );
}

/** Name, audience and default for a new preset. */
function SavePresetDialog({ initialName, onCancel, onSave }) {
  const [name, setName] = useState(initialName);
  const [scope, setScope] = useState('user');
  const [makeDefault, setMakeDefault] = useState(false);
  return (
    <ConfirmDialog
      variant="primary"
      align="start"
      icon="solar:diskette-linear"
      iconColor="var(--primary-300)"
      title="Save as preset"
      description="Saves these print settings so you can pick them next time."
      confirmLabel="Save"
      onCancel={onCancel}
      onConfirm={() => { if (name.trim()) onSave({ name: name.trim(), scope, isDefault: scope === 'org' && makeDefault }); }}
      checkbox={scope === 'org' ? { label: 'Open Preview & Share with this preset', checked: makeDefault, onChange: setMakeDefault } : undefined}
    >
      <Input label="Preset name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Patient copy" maxLength={60} />
      <RadioOptionGroup
        label="Who is this preset for?"
        name="print-preset-scope"
        value={scope}
        onChange={setScope}
        options={PRESET_SCOPES.map(k => ({ value: k, label: TEMPLATE_SCOPES[k].label, hint: TEMPLATE_SCOPES[k].hint.replace('library', 'presets') }))}
      />
    </ConfirmDialog>
  );
}

/**
 * Preview & Share > Personalize: how the care plan prints, and the presets
 * that keep those settings.
 */
export function CarePlanPrintPersonalize({
  settings, onChange,
  presets, presetId, onPickPreset, dirty, canEditPreset,
  onSavePreset, onSaveAsPreset, onDeletePreset, onMakeDefault,
  headerComponents, footerComponents, clinicLogo,
}) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [menu, setMenu] = useState(null);
  const preset = presets.find(p => p.id === presetId) || null;
  const set = patch => onChange({ ...settings, ...patch });
  const toggleDemo = key => set({
    demographics: settings.demographics.includes(key)
      ? settings.demographics.filter(k => k !== key)
      : [...settings.demographics, key],
  });

  const menuItems = [
    { key: 'saveAs', icon: 'solar:copy-linear', label: 'Save as new preset' },
    ...(preset && preset.scope === 'org' && !preset.isDefault ? [{ key: 'default', icon: 'solar:star-linear', label: 'Make org default' }] : []),
    ...(preset && canEditPreset ? [{ key: 'delete', icon: 'solar:trash-bin-trash-linear', label: 'Delete preset', danger: true }] : []),
  ];

  return (
    <div className={styles.personalize}>
      <section className={styles.group}>
        <h3 className={styles.groupTitle}>Preset</h3>
        <div className={styles.presetRow}>
          <Select
            portal
            className={styles.presetSelect}
            options={[
              { value: NO_PRESET, label: 'Standard settings' },
              ...presets.map(p => ({ value: p.id, label: `${p.name}${p.isDefault ? ' (default)' : ''}` })),
            ]}
            value={presetId || NO_PRESET}
            onChange={v => onPickPreset(v === NO_PRESET ? null : v)}
          />
          {preset && <Badge size="S" tone={TEMPLATE_SCOPES[preset.scope].tone} icon={TEMPLATE_SCOPES[preset.scope].icon} label={TEMPLATE_SCOPES[preset.scope].badge} />}
          <Button
            variant="secondary"
            size="M"
            disabled={!dirty || (preset && !canEditPreset)}
            onClick={() => (preset ? onSavePreset() : setSaveOpen(true))}
          >
            {preset ? 'Save' : 'Save as preset'}
          </Button>
          <ActionButton
            icon="solar:menu-dots-linear"
            size="M"
            tooltip="More preset actions"
            onClick={e => setMenu(e.currentTarget.getBoundingClientRect())}
          />
        </div>
        {dirty && <p className={styles.hint}>{preset ? 'Changed since the preset was saved.' : 'Not saved as a preset.'}</p>}
      </section>

      <section className={styles.group}>
        <RadioOptionGroup
          label="Format"
          name="print-format"
          value={settings.format}
          onChange={format => set({ format })}
          options={FORMAT_OPTIONS}
        />
      </section>

      {settings.format === 'table' && (
      <section className={styles.group}>
        <RadioOptionGroup
          label="Group by"
          name="print-group-by"
          value={settings.groupBy}
          onChange={groupBy => set({ groupBy })}
          options={GROUP_BY_OPTIONS}
        />
      </section>
      )}

      <section className={styles.group}>
        <div className={styles.groupHead}>
          <h3 className={styles.groupTitle}>Care plan note</h3>
          <Switch checked={settings.showCarePlanNote} onChange={showCarePlanNote => set({ showCarePlanNote })} ariaLabel="Include the care plan note" />
        </div>
        <p className={styles.hint}>Prints the plan&apos;s Care Note after the goals, interventions and barriers.</p>
      </section>

      <section className={styles.group}>
        <h3 className={styles.groupTitle}>Patient demographics</h3>
        <div className={styles.checks}>
          {DEMOGRAPHIC_FIELDS.map(f => (
            <label key={f.key} className={styles.check}>
              <Checkbox checked={settings.demographics.includes(f.key)} onCheckedChange={() => toggleDemo(f.key)} />
              {f.label}
            </label>
          ))}
        </div>
      </section>

      <div className={styles.chromeRow}>
        <section className={styles.group}>
          <div className={styles.groupHead}>
            <h3 className={styles.groupTitle}>Show Header</h3>
            <Switch checked={settings.showHeader} onChange={showHeader => set({ showHeader })} ariaLabel="Show header" />
          </div>
          {settings.showHeader && (
            <Select
              portal
              aria-label="Header"
              options={headerComponents.map(h => ({ value: String(h.id), label: h.label }))}
              value={String(settings.headerId ?? headerComponents[0]?.id ?? '')}
              onChange={headerId => set({ headerId })}
            />
          )}
        </section>
        <section className={styles.group}>
          <div className={styles.groupHead}>
            <h3 className={styles.groupTitle}>Show Footer</h3>
            <Switch checked={settings.showFooter} onChange={showFooter => set({ showFooter })} ariaLabel="Show footer" />
          </div>
          {settings.showFooter && (
            <Select
              portal
              aria-label="Footer"
              options={[
                { value: STANDARD_FOOTER, label: 'Standard (page number)' },
                ...footerComponents.map(f => ({ value: String(f.id), label: f.label })),
              ]}
              value={settings.footerId == null ? STANDARD_FOOTER : String(settings.footerId)}
              onChange={v => set({ footerId: v === STANDARD_FOOTER ? null : v })}
            />
          )}
        </section>
      </div>

      <section className={styles.group}>
        <div className={styles.groupHead}>
          <h3 className={styles.groupTitle}>Logo</h3>
          <Switch checked={settings.showLogo} onChange={showLogo => set({ showLogo })} ariaLabel="Show logo" />
        </div>
        {settings.showLogo && (
          <LogoField
            logo={clinicLogo}
            custom={settings.customLogo}
            onPick={customLogo => set({ customLogo })}
            onReset={() => set({ customLogo: null })}
          />
        )}
      </section>

      {menu && (
        <MenuPopover
          anchorRect={menu}
          align="right"
          width={200}
          ariaLabel="Preset actions"
          items={menuItems}
          onSelect={(key) => {
            if (key === 'saveAs') setSaveOpen(true);
            else if (key === 'default') onMakeDefault();
            else if (key === 'delete') onDeletePreset();
          }}
          onClose={() => setMenu(null)}
        />
      )}
      {saveOpen && (
        <SavePresetDialog
          initialName={preset ? `${preset.name} (Copy)` : ''}
          onCancel={() => setSaveOpen(false)}
          onSave={async (values) => { setSaveOpen(false); await onSaveAsPreset(values); }}
        />
      )}
    </div>
  );
}

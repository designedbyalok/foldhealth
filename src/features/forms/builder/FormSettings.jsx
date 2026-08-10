/**
 * Form-level settings, shown in the Properties column when no field is
 * selected. Mirrors the email-builder's Design/Template panel layout
 * (section strips, field columns, live preset cards) for visual consistency.
 */
import { useId, useState } from 'react';
import { Select } from '../../../components/Select/Select';
import { Switch } from '../../../components/Switch/Switch';
import { Icon } from '../../../components/Icon/Icon';
import { CloseButton } from '../../../components/CloseButton/CloseButton';
import { Input } from '../../../components/Input/Input';
import { Textarea } from '../../../components/Textarea/Textarea';
import { Button } from '../../../components/Button/Button';
import { GOOGLE_FONTS, getFontStack, injectGoogleFonts } from '../../email-builder/googleFonts';
import { HEADER_PRESETS, FOOTER_PRESETS } from '../../email-builder/headerFooterLibrary';
import { PresetLivePreview } from '../../email-builder/PresetLivePreview';
import { ColorInput } from '../../email-builder/ColorInput';
import { normalizeLayout } from '../render/layout';
import { endingsOf } from '../render/flow';
import email from '../../email-builder/EmailBuilder.module.css';
import styles from './FormBuilder.module.css';

/** Normalize a hidden-field name to lower_snake (URL-param + recall friendly). */
const normHidden = (raw) => (raw || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

function HiddenFields({ s, set }) {
  const [draft, setDraft] = useState('');
  const names = s.hidden || [];
  const add = () => {
    const n = normHidden(draft);
    if (n && !names.includes(n)) set({ hidden: [...names, n] });
    setDraft('');
  };
  return (
    <div className={email.sectionContent}>
      <p className={styles.settingHint}>Prefill from the share link (<code>?mrn=A123&amp;name=Jane</code>) and reference anywhere with <code>{'{{hidden:name}}'}</code>.</p>
      {names.length > 0 && (
        <div className={styles.chipRow}>
          {names.map((n) => (
            <span key={n} className={styles.chip}>
              {n}
              <CloseButton size={14} onClick={() => set({ hidden: names.filter((x) => x !== n) })} className={styles.chipX} label={`Remove ${n}`} />
            </span>
          ))}
        </div>
      )}
      <div className={styles.addRow}>
        <Input className={styles.ctl} value={draft} placeholder="e.g. mrn" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <Button variant="secondary" size="S" onClick={add} disabled={!normHidden(draft)}>Add</Button>
      </div>
    </div>
  );
}

function EndingsEditor({ s, set }) {
  const endings = endingsOf(s);
  const enabled = endings[0]?.enabled !== false;
  const write = (next) => set({ endings: next });
  const update = (i, patch) => write(endings.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  const remove = (i) => write(endings.filter((_, idx) => idx !== i));
  const add = () => {
    const used = new Set(endings.map((e) => e.id));
    let n = endings.length + 1;
    while (used.has(`end-${n}`)) n += 1;
    write([...endings, { id: `end-${n}`, title: 'New ending', description: '' }]);
  };
  return (
    <div className={email.sectionContent}>
      <div className={styles.settingRow}>
        <span className={styles.settingLabel}>Show end screen</span>
        <Switch checked={enabled} onChange={(v) => update(0, { enabled: v })} />
      </div>
      {enabled && (
        <>
          {endings.map((e, i) => (
            <div key={e.id} className={styles.endingCard}>
              <div className={styles.endingHead}>
                <span className={styles.endingTag}>{i === 0 ? 'Default ending' : `Ending ${i + 1}`}</span>
                {i > 0 && (
                  <button type="button" className={styles.chipX} onClick={() => remove(i)} aria-label="Remove ending">
                    <Icon name="solar:trash-bin-minimalistic-linear" size={14} color="var(--neutral-300)" />
                  </button>
                )}
              </div>
              <Input className={styles.ctl} value={e.title || ''} placeholder="Thank you!" onChange={(ev) => update(i, { title: ev.target.value })} />
              <Textarea className={styles.ctl} rows={2} value={e.description || ''} placeholder="Your response has been recorded." onChange={(ev) => update(i, { description: ev.target.value })} />
            </div>
          ))}
          <Button variant="ghost" size="S" leadingIcon="solar:add-circle-linear" onClick={add}>Add ending</Button>
          <p className={styles.settingHint}>Route to a specific ending from the Logic tab (jump rules).</p>
        </>
      )}
    </div>
  );
}

const LAYOUT_OPTIONS = [
  { value: 'by-question', icon: 'solar:square-academic-cap-linear', title: 'One question at a time', desc: 'Guided, Typeform-style — one screen per question.' },
  { value: 'by-section', icon: 'solar:list-linear', title: 'Section by section', desc: 'One section per screen with Next / Back.' },
  { value: 'entire-page', icon: 'solar:document-text-linear', title: 'Entire page', desc: 'All questions on one scrolling page.' },
];

// Load the web fonts so each dropdown option previews in its own typeface.
injectGoogleFonts();

// Each option renders in its own font family (preview-in-dropdown).
const FONT_OPTIONS = GOOGLE_FONTS.map((f) => ({
  value: f.value,
  label: f.label,
  style: { fontFamily: getFontStack(f.value) },
}));

function PresetGrid({ presets, selectedId, onSelect }) {
  return (
    <div className={email.presetCardList}>
      {presets.map((p) => (
        <div
          key={p.id}
          className={`${email.presetCardWrap} ${selectedId === p.id ? styles.presetCardSelected : ''}`}
        >
          <button type="button" className={email.presetCard} onClick={() => onSelect(p.id)}>
            <PresetLivePreview preset={p} />
            <div className={email.presetCardMeta}>
              <div className={email.presetCardTitle}>{p.label}</div>
              {p.description && <div className={email.presetCardDesc}>{p.description}</div>}
            </div>
          </button>
        </div>
      ))}
    </div>
  );
}

export function FormSettings({ settings, onChange }) {
  const uid = useId();
  const s = settings || {};
  const set = (patch) => onChange({ ...s, ...patch });
  const header = s.header || { enabled: false, presetId: HEADER_PRESETS[0].id };
  const footer = s.footer || { enabled: false, presetId: FOOTER_PRESETS[0].id };
  const start = s.start || { enabled: true, buttonLabel: 'Start' };

  const layout = normalizeLayout(s.layout);
  const paged = layout !== 'entire-page';

  return (
    <div className={email.designScroll}>
      <div className={email.sectionHeadingStrip}>Layout</div>
      <div className={email.sectionContent}>
        <div className={styles.layoutCards}>
          {LAYOUT_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`${styles.layoutCard} ${layout === o.value ? styles.layoutCardSel : ''}`}
              onClick={() => set({ layout: o.value })}
            >
              <span className={styles.layoutCardIcon}>
                <Icon name={o.icon} size={18} color={layout === o.value ? 'var(--primary-300)' : 'var(--neutral-300)'} />
              </span>
              <span className={styles.layoutCardMain}>
                <span className={styles.layoutCardTitle}>{o.title}</span>
                <span className={styles.layoutCardDesc}>{o.desc}</span>
              </span>
              {layout === o.value && <Icon name="solar:check-circle-bold" size={16} color="var(--primary-300)" />}
            </button>
          ))}
        </div>
      </div>

      <div className={email.sectionHeadingStrip}>Typography</div>
      <div className={email.sectionContent}>
        <div className={email.fieldCol}>
          <label className={email.fieldLabel} htmlFor={`${uid}-font-family`}>Font family</label>
          <Select
            id={`${uid}-font-family`}
            value={s.fontFamily || 'Inter'}
            options={FONT_OPTIONS}
            onChange={(v) => set({ fontFamily: v })}
          />
        </div>
      </div>

      <div className={email.sectionHeadingStrip}>Background</div>
      <div className={email.sectionContent}>
        <ColorInput value={s.background || '#FFFFFF'} onChange={(v) => set({ background: v })} />
      </div>

      <div className={email.sectionHeadingStrip}>Hidden fields</div>
      <HiddenFields s={s} set={set} />

      {paged ? (
        <>
          {/* Paged layouts replace header/footer with start + end screens. */}
          <div className={email.sectionHeadingStrip}>Start screen</div>
          <div className={email.sectionContent}>
            <div className={styles.settingRow}>
              <span className={styles.settingLabel}>Show start screen</span>
              <Switch checked={start.enabled !== false} onChange={(v) => set({ start: { ...start, enabled: v } })} />
            </div>
            {start.enabled !== false && (
              <>
                <label className={email.fieldLabel} htmlFor={`${uid}-start-title`}>Title</label>
                <Input id={`${uid}-start-title`} className={styles.ctl} value={start.title || ''} placeholder="Welcome" onChange={(e) => set({ start: { ...start, title: e.target.value } })} />
                <label className={email.fieldLabel} htmlFor={`${uid}-start-description`}>Description</label>
                <Textarea id={`${uid}-start-description`} className={styles.ctl} rows={2} value={start.description || ''} placeholder="A short intro for respondents" onChange={(e) => set({ start: { ...start, description: e.target.value } })} />
                <label className={email.fieldLabel} htmlFor={`${uid}-start-button`}>Button label</label>
                <Input id={`${uid}-start-button`} className={styles.ctl} value={start.buttonLabel || 'Start'} onChange={(e) => set({ start: { ...start, buttonLabel: e.target.value } })} />
              </>
            )}
          </div>

          <div className={email.sectionHeadingStrip}>Endings</div>
          <EndingsEditor s={s} set={set} />
        </>
      ) : (
        <>
          <div className={email.sectionHeadingStrip}>Header</div>
          <div className={email.sectionContent}>
            <div className={styles.settingRow}>
              <span className={styles.settingLabel}>Show header</span>
              <Switch checked={header.enabled} onChange={(v) => set({ header: { ...header, enabled: v } })} />
            </div>
            {header.enabled && (
              <PresetGrid presets={HEADER_PRESETS} selectedId={header.presetId} onSelect={(id) => set({ header: { ...header, presetId: id } })} />
            )}
          </div>

          <div className={email.sectionHeadingStrip}>Footer</div>
          <div className={email.sectionContent}>
            <div className={styles.settingRow}>
              <span className={styles.settingLabel}>Show footer</span>
              <Switch checked={footer.enabled} onChange={(v) => set({ footer: { ...footer, enabled: v } })} />
            </div>
            {footer.enabled && (
              <PresetGrid presets={FOOTER_PRESETS} selectedId={footer.presetId} onSelect={(id) => set({ footer: { ...footer, presetId: id } })} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

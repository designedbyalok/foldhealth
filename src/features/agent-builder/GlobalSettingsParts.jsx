import { useState } from 'react';
import { Icon } from '../../components/Icon/Icon';
import { Switch } from '../../components/Switch/Switch';
import { Select } from '../../components/Select/Select';
import { Slider } from '../../components/ShadcnSlider/ShadcnSlider';
import styles from './GlobalSettings.module.css';

/* ── Reusable section primitive ──
   Collapsed = single-line icon + title + chevron (matches the product).
   Expanded body opens with an optional in-body title + description, then
   the fields. */
export function Section({ icon, title, defaultOpen = true, description, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={styles.section}>
      <button
        className={`${styles.sectionHeader} ${open ? styles.sectionHeaderActive : ''}`}
        onClick={() => setOpen(v => !v)}
      >
        <div className={styles.sectionHeaderLeft}>
          <Icon name={icon} size={16} color="var(--neutral-400)" />
          <span className={styles.sectionTitle}>{title}</span>
        </div>
        <Icon
          name={open ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'}
          size={14}
          color="var(--neutral-300)"
        />
      </button>
      {open && (
        <div className={styles.sectionBody}>
          {description && <p className={styles.sectionDescription}>{description}</p>}
          {children}
        </div>
      )}
    </section>
  );
}

export function Field({ label, hint, required, children, footer }) {
  return (
    <div className={styles.field}>
      <div className={styles.fieldHeader}>
        <span className={styles.fieldLabel}>
          {label}
          {required && <span className={styles.fieldRequired}>*</span>}
        </span>
        {hint && <span className={styles.fieldHint}>{hint}</span>}
      </div>
      {children}
      {footer && <div className={styles.fieldFooter}>{footer}</div>}
    </div>
  );
}

export function StaticField({ label, value }) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <span className={styles.staticValue}>{value}</span>
    </div>
  );
}

export function SliderField({ label, hint, value, min = 0, max = 1, step = 0.05, formatValue, onChange, extra }) {
  return (
    <Field label={label} hint={hint}>
      <div className={styles.sliderRow}>
        <Slider
          value={[value]}
          min={min}
          max={max}
          step={step}
          onValueChange={(v) => onChange(v[0])}
          className={styles.slider}
        />
        {formatValue !== false && (
          <span className={styles.sliderValue}>
            {formatValue ? formatValue(value) : value.toFixed(2)}
          </span>
        )}
      </div>
      {extra}
    </Field>
  );
}

export function ToggleRow({ label, hint, checked, onChange }) {
  return (
    <div className={styles.toggleRow}>
      <div className={styles.toggleRowText}>
        <span className={styles.fieldLabel}>{label}</span>
        {hint && <span className={styles.fieldHint}>{hint}</span>}
      </div>
      <Switch checked={checked} onChange={onChange} />
    </div>
  );
}

export function CheckRow({ label, checked, onChange }) {
  return (
    <label className={styles.checkRow}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

export function NumberUnit({ value, onChange, unit, min = 0, max = 9999, ariaLabel }) {
  return (
    <div className={styles.numberUnit}>
      <input
        type="number"
        aria-label={ariaLabel || `Value in ${unit}`}
        className={styles.numberInput}
        value={value}
        min={min}
        max={max}
        onChange={e => {
          // Ignore empty/partial input ("", "-", "1e") instead of storing
          // Number('')===0 or NaN — both would flow into settings state.
          const raw = e.target.value.trim();
          if (raw === '') return;
          const n = Number(raw);
          if (Number.isFinite(n)) onChange(n);
        }}
      />
      <span className={styles.numberUnitLabel}>{unit}</span>
    </div>
  );
}

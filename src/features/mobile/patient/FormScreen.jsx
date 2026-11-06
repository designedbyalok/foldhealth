import { useState } from 'react';
import { BottomSheet } from '../../../components/BottomSheet/BottomSheet';
import { Icon } from '../../../components/Icon/Icon';
import { MobileSubHeader } from '../MobileHeader';
import common from '../mobile.module.css';
import styles from './patientForm.module.css';

/**
 * A full-screen patient form: back arrow and title, a scrolling white form,
 * and the primary action pinned above the home indicator.
 */
export function FormScreen({ title, subtitle, actions, footer, children }) {
  return (
    <div className={common.screen}>
      <MobileSubHeader title={title} actions={actions}>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </MobileSubHeader>
      <div className={`${common.body} ${styles.body}`}>
        <div className={styles.form}>{children}</div>
      </div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
}

/** Caps group label (Figma type scale: 16 medium uppercase). */
export function FieldGroup({ label, required, hint, children }) {
  return (
    <section className={styles.group}>
      {label && (
        <span className={styles.groupLabel}>
          {label}
          {required && <span className={styles.required} aria-hidden="true" />}
        </span>
      )}
      {children}
      {hint && <span className={styles.hint}>{hint}</span>}
    </section>
  );
}

/**
 * A labelled field whose value is picked from a bottom sheet (the phone's
 * stand-in for a desktop Select). `options` is [{ value, label }].
 */
export function PickerField({ label, required, value, options, placeholder = 'Select', onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const current = options.find(o => o.value === value);
  return (
    <div className={styles.field}>
      {label && (
        <span className={styles.fieldLabel}>
          {label}
          {required && <span className={styles.required} aria-hidden="true" />}
        </span>
      )}
      <button
        type="button"
        className={styles.picker}
        aria-label={label ? `${label}: ${current?.label || placeholder}` : undefined}
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <span className={current ? styles.pickerValue : styles.pickerPlaceholder}>{current?.label || placeholder}</span>
        <Icon name="solar:alt-arrow-down-linear" size={20} color="currentColor" />
      </button>
      {open && (
        <ChoiceSheet
          title={label}
          options={options}
          value={value}
          onPick={(v) => { onChange(v); setOpen(false); }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

/** A bottom sheet of single-choice rows, the picked one ticked. */
export function ChoiceSheet({ title, options, value, onPick, onClose }) {
  return (
    <BottomSheet title={title} onClose={onClose}>
      <div className={styles.choices} role="radiogroup" aria-label={title}>
        {options.map(o => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            className={styles.choice}
            onClick={() => onPick(o.value)}
          >
            <span className={styles.choiceText}>
              <span className={styles.choiceLabel}>{o.label}</span>
              {o.detail && <span className={styles.choiceDetail}>{o.detail}</span>}
            </span>
            {o.value === value && <Icon name="solar:check-circle-linear" size={24} color="var(--primary-300)" />}
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}

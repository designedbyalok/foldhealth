import { Icon } from '../../../../components/Icon/Icon';
import styles from './BookAppointmentScreen.module.css';

/**
 * A labelled 52px field that opens a picker (Figma "Text Input Mobile" with
 * a chevron, 1082:60628). `trailing` replaces the chevron (e.g. a type's
 * colour dot); `readOnly` shows the value with no picker.
 */
export function PickerField({ label, required, value, placeholder, onClick, trailing, readOnly, suffix }) {
  const Tag = readOnly ? 'div' : 'button';
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>
        {label}
        {required && <span className={styles.required} aria-hidden="true" />}
      </span>
      <Tag
        {...(readOnly ? {} : { type: 'button', onClick, 'aria-haspopup': 'dialog' })}
        className={styles.fieldBox}
        aria-label={readOnly ? undefined : `${label}: ${value || placeholder}`}
      >
        <span className={value ? styles.fieldValue : styles.fieldPlaceholder}>{value || placeholder}</span>
        {suffix && <span className={styles.fieldSuffix}>{suffix}</span>}
        {!readOnly && (trailing || <Icon name="solar:alt-arrow-down-linear" size={20} color="var(--neutral-300)" />)}
      </Tag>
    </div>
  );
}

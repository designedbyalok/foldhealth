import { Avatar } from '../../../components/Avatar/Avatar';
import { Checkbox } from '../../../components/Checkbox/Checkbox';
import { MobileSubHeader } from '../MobileHeader';
import { initialsOf } from '../mobileFormat';
import common from '../mobile.module.css';
import styles from './messageForm.module.css';

/** A full-screen messaging form: back arrow and title, scrolling form, pinned action. */
export function FormShell({ title, actions, footer, children }) {
  return (
    <div className={common.screen}>
      <MobileSubHeader title={title} actions={actions} />
      <div className={`${common.body} ${styles.body}`}>
        <div className={styles.form}>{children}</div>
      </div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
}

export function Field({ label, required, hint, error, children }) {
  return (
    <div className={styles.field}>
      {label && (
        <span className={styles.label}>
          {label}
          {required && <span className={styles.required} aria-hidden="true" />}
        </span>
      )}
      {children}
      {error ? <span className={`${styles.hint} ${styles.error}`}>{error}</span> : hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}

/**
 * Send To on the phone: the member and their recorded contacts, one row
 * each. `people`: [{ value, name, type, meta, disabled }]; `value`: picked values.
 */
export function SendToList({ people, value, onChange, label = 'Send To' }) {
  const toggle = (v) => onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v]);
  const picked = new Set(value);
  return (
    <div className={styles.people} role="group" aria-label={label}>
      {people.map(p => (
        <label key={p.value} className={[styles.person, p.disabled ? styles.personDisabled : ''].filter(Boolean).join(' ')}>
          <Avatar variant="patient" size="L" initials={initialsOf(p.name)} />
          <span className={styles.personText}>
            <span className={styles.personName}>{p.name}</span>
            {p.type && <span className={styles.tag}>{p.type}</span>}
            <span className={styles.personMeta}>{p.meta}</span>
          </span>
          <Checkbox checked={picked.has(p.value)} disabled={p.disabled} onCheckedChange={() => toggle(p.value)} aria-label={p.name} />
        </label>
      ))}
    </div>
  );
}

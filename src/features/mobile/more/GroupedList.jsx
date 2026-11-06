import { Icon } from '../../../components/Icon/Icon';
import styles from './GroupedList.module.css';

/**
 * iOS inset grouped list: a caps label over a white rounded card of rows
 * (Figma profile cards 759:25732). Rows are 56pt tall with the icon in the
 * brand colour and a chevron when they open something.
 */
export function GroupedSection({ label, footer, children }) {
  return (
    <section className={styles.section} aria-label={label || undefined}>
      {label && <h2 className={styles.label}>{label}</h2>}
      <div className={styles.card}>{children}</div>
      {footer && <p className={styles.footer}>{footer}</p>}
    </section>
  );
}

/**
 * One row. With `onClick` it is a button (chevron unless `trailing` is
 * given); without, a static row (e.g. holding a Switch in `trailing`).
 */
export function GroupedRow({ icon, label, sub, detail, trailing, onClick, tone, disabled, chevron = true, ariaLabel }) {
  const body = (
    <>
      {icon && <span className={styles.icon}><Icon name={icon} size={24} color="currentColor" /></span>}
      <span className={styles.text}>
        <span className={styles.rowLabel}>{label}</span>
        {sub && <span className={styles.sub}>{sub}</span>}
      </span>
      {detail != null && detail !== '' && <span className={styles.detail}>{detail}</span>}
      {trailing}
      {onClick && !trailing && chevron && <Icon name="solar:alt-arrow-right-linear" size={16} color="var(--placeholder-text)" />}
    </>
  );
  const cls = [styles.row, tone === 'danger' ? styles.danger : '', tone === 'muted' ? styles.muted : ''].filter(Boolean).join(' ');
  if (!onClick) return <div className={cls}>{body}</div>;
  return (
    <button type="button" className={cls} onClick={onClick} disabled={disabled} aria-label={ariaLabel}>
      {body}
    </button>
  );
}

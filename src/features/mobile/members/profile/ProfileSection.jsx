import { useState } from 'react';
import { ActionButton } from '../../../../components/ActionButton/ActionButton';
import { Icon } from '../../../../components/Icon/Icon';
import styles from '../MemberProfileScreen.module.css';

/**
 * A collapsible P360 section (Figma 759:26451): caps title with a chevron,
 * optional count and "+" action, then its cards.
 */
export function ProfileSection({ title, count, onAdd, addLabel, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <button type="button" className={styles.sectionToggle} aria-expanded={open} onClick={() => setOpen(v => !v)}>
          <h2 className={styles.sectionTitle}>
            {title}
            {count != null && <span className={styles.sectionCount}>{count}</span>}
          </h2>
          <Icon name={open ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'} size={16} />
        </button>
        {onAdd && <ActionButton icon="custom:add" size="lg" aria-label={addLabel || `Add ${title}`} onClick={onAdd} />}
      </div>
      {open && <div className={styles.sectionBody}>{children}</div>}
    </section>
  );
}

/** Grey line for an empty section. */
export function ProfileEmpty({ children }) {
  return <p className={styles.empty}>{children}</p>;
}

/** Label / value row (Figma Demographics 759:26451, Basic Info). */
export function InfoRow({ label, value }) {
  return (
    <div className={styles.infoRow}>
      <span className={styles.infoLabel}>{label}</span>
      <span className={styles.infoValue}>{value || '-'}</span>
    </div>
  );
}

import styles from './HomeScreen.module.css';

/** A Home block: caps title, optional "See all"/"Add" link, content (Figma P360 section style). */
export function HomeSection({ title, count, actionLabel, onAction, children }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>
          {title}
          {count != null && <span className={styles.sectionCount}>{count}</span>}
        </h2>
        {actionLabel && <button type="button" className={styles.sectionAction} onClick={onAction}>{actionLabel}</button>}
      </div>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

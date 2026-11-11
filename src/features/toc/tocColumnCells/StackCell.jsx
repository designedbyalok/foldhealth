import styles from '../tocColumns.module.css';

/** Two lines: the value, then a quieter detail under it. */
export function StackCell({ top, sub }) {
  return (
    <span className={styles.stack}>
      <span className={styles.date}>{top}</span>
      {sub && <span className={styles.stackSub}>{sub}</span>}
    </span>
  );
}

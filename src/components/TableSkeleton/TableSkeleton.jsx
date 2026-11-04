import styles from './TableSkeleton.module.css';
import { Skeleton } from '../Skeleton/Skeleton';

function SkeletonRow() {
  return (
    <div className={styles.row}>
      <Skeleton className={styles.checkbox} />
      <Skeleton className={styles.avatar} />
      <div className={styles.memberInfo}>
        <Skeleton className={styles.nameLine} />
        <Skeleton className={styles.idLine} />
      </div>
      <Skeleton className={`${styles.cell} ${styles.cellSm}`} />
      <Skeleton className={`${styles.cell} ${styles.cellLg}`} />
      <Skeleton className={`${styles.cell} ${styles.cellMd}`} />
      <Skeleton className={`${styles.cell} ${styles.cellXl}`} />
      <Skeleton className={`${styles.cell} ${styles.cellLg}`} />
      <Skeleton className={`${styles.cell} ${styles.cellLg}`} />
      <Skeleton className={`${styles.cell} ${styles.cellLg}`} />
      <Skeleton className={`${styles.cell} ${styles.cellLg}`} />
      <Skeleton className={`${styles.cell} ${styles.cellMd}`} />
      <div className={styles.actionsCell}>
        <Skeleton className={styles.actionDot} />
        <Skeleton className={styles.actionDot} />
        <Skeleton className={styles.actionDot} />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 10 }) {
  return (
    <div style={{ flex: 1, overflow: 'hidden', background: 'var(--neutral-0)' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

import { Skeleton } from '../../components/Skeleton/Skeleton';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import styles from './mobile.module.css';

/** Placeholder cards while a mobile list loads. */
export function MobileListSkeleton({ count = 6, height = 72 }) {
  return (
    <div className={styles.skeletons} aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => <Skeleton key={i} width="100%" height={height} radius={12} />)}
    </div>
  );
}

export function MobileEmpty({ icon, title, description, action }) {
  return (
    <div className={styles.center}>
      <EmptyState icon={icon} title={title} description={description} action={action} />
    </div>
  );
}

/** Orange count badge (Figma Notification Badge). */
export function CountBadge({ value }) {
  if (!value) return null;
  return <span className={styles.count}>{value > 99 ? '99+' : value}</span>;
}

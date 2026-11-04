import { Skeleton } from '../../../../../../../../components/Skeleton/Skeleton';
import styles from './ProgramDetailSkeleton.module.css';

const Bone = ({ w, h, r = 4, style }) => (
  <Skeleton style={{ width: w, height: h, borderRadius: r, flexShrink: 0, ...style }} />
);

/**
 * Loading placeholder that mirrors ProgramDetailView's layout (header row +
 * step-list sidebar + content). Shown for a beat while a program is being
 * opened so the screen fills in smoothly instead of snapping in.
 */
export function ProgramDetailSkeleton() {
  return (
    <div className={styles.wrap}>
      {/* Header */}
      <div className={styles.header}>
        <Bone w={16} h={16} r={999} />
        <Bone w={180} h={14} />
        <Bone w={132} h={24} r={4} />
        <Bone w={92} h={16} />
        <div style={{ flex: 1 }} />
        <Bone w={20} h={20} r={4} />
        <Bone w={20} h={20} r={4} />
        <Bone w={20} h={20} r={4} />
      </div>

      {/* Body */}
      <div className={styles.body}>
        {/* Step list sidebar */}
        <div className={styles.sidebar}>
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className={styles.stepRow}>
              <Bone w={16} h={16} r={999} />
              <Bone w={`${45 + ((i * 13) % 40)}%`} h={12} />
            </div>
          ))}
        </div>

        {/* Content */}
        <div className={styles.content}>
          <div className={styles.contentHeader}>
            <Bone w={180} h={14} />
            <div className={styles.contentActions}>
              <Bone w={72} h={28} r={6} />
              <Bone w={56} h={28} r={6} />
              <Bone w={92} h={28} r={6} />
            </div>
          </div>
          <Bone w="100%" h={34} />
          {Array.from({ length: 5 }).map((_, i) => (
            <Bone key={i} w="100%" h={40} />
          ))}
        </div>
      </div>
    </div>
  );
}

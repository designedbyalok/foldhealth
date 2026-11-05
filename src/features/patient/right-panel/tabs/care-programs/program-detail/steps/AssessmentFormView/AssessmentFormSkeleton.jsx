import { Skeleton } from '../../../../../../../../components/Skeleton/Skeleton';
import styles from './AssessmentFormView.module.css';

const Bone = ({ w, h = 12, r = 4, style, className }) => (
  <Skeleton width={w} height={h} radius={r} className={className} style={{ flexShrink: 0, ...style }} />
);

/** Mirrors AssessmentFormView: stats strip + intro + numbered questions. */
export function AssessmentFormSkeleton() {
  return (
    <div className={styles.wrap} aria-busy="true" aria-label="Loading assessment form">
      <div className={styles.strip}>
        <span className={styles.stripItem}>
          <Bone w={120} h={12} />
          <Bone w={120} h={6} r={999} className={styles.skeletonProgress} />
          <Bone w={32} h={12} />
        </span>
        <span className={styles.stripDot} aria-hidden="true" />
        <span className={styles.stripItem}>
          <Bone w={108} h={12} />
        </span>
        <span className={styles.stripDot} aria-hidden="true" />
        <span className={styles.stripItem}>
          <Bone w={120} h={12} />
          <Bone w={72} h={22} r={4} />
        </span>
      </div>

      <div className={styles.formScroll}>
        <div className={styles.skeletonIntro}>
          <Bone w="100%" h={12} />
          <Bone w="96%" h={12} />
          <Bone w="88%" h={12} />
          <Bone w="72%" h={12} />
        </div>

        {[
          { label: '78%', control: 40 },
          { label: '92%', control: 40 },
          { section: true },
          { label: '65%', control: 40 },
          { label: '100%', control: 72 },
          { label: '54%', control: 40 },
        ].map((row, i) => (
          row.section ? (
            <Bone key={`sec-${i}`} w={180} h={14} style={{ marginTop: 4 }} />
          ) : (
            <div key={i} className={styles.skeletonQuestion}>
              <div className={styles.qHead}>
                <Bone w={18} h={12} />
                <Bone w={row.label} h={12} style={{ flex: 1, maxWidth: row.label }} />
              </div>
              <div className={styles.qControl}>
                <Bone w="100%" h={row.control} r={6} />
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}

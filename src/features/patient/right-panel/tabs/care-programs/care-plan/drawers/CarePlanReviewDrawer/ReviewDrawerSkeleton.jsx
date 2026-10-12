import bones from '../../../../../../../../components/TableSkeleton/TableSkeleton.module.css';
import styles from './CarePlanReviewDrawer.module.css';

// Title and meta widths vary row to row so the list reads like real content.
const ROWS = [
  [['62%', '34%'], ['48%', '28%'], ['70%', '40%'], ['55%', '30%']],
  [['58%', '36%'], ['66%', '24%'], ['44%', '32%']],
];

const Bone = ({ className, style }) => <span className={`${bones.bone} ${className}`} style={style} />;

/** Loading state of the Review care plan drawer, shaped like its list. */
export function ReviewDrawerSkeleton() {
  return (
    <div className={styles.listPane} aria-busy="true" aria-label="Loading the care plan">
      <div className={styles.progressRow}>
        <Bone className={styles.skProgressText} />
        <Bone className={styles.skToggle} />
      </div>
      <Bone className={styles.skBar} />
      {ROWS.map((rows, g) => (
        <section key={g} className={styles.group}>
          <div className={styles.groupHead}>
            <Bone className={styles.skIcon} />
            <Bone className={styles.skGroupLabel} />
          </div>
          <div className={styles.groupList}>
            {rows.map(([title, meta], i) => (
              <div key={i} className={styles.item}>
                <div className={styles.itemRow}>
                  <Bone className={styles.skCheck} />
                  <Bone className={styles.skIcon} />
                  <span className={styles.skText}>
                    <Bone className={styles.skTitle} style={{ width: title }} />
                    <Bone className={styles.skMeta} style={{ width: meta }} />
                  </span>
                  <span className={styles.noteSlot} />
                  <span className={`${styles.slotDivider} ${styles.slotDividerHidden}`} />
                  <span className={styles.statusSlot}><Bone className={styles.skStatus} /></span>
                  <Bone className={styles.skChevron} />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

import { Skeleton } from '../../../components/Skeleton/Skeleton';
import tab from './CisImmunizationsTab.module.css';
import styles from './CisTabSkeleton.module.css';

const B = ({ className }) => <Skeleton className={className} />;
const DOSE_BLOCKS = 25;
const LEGEND = 5;

function VaccineGroup({ rows }) {
  return (
    <div className={tab.group}>
      <B className={styles.groupTitle} />
      <div className={tab.groupBody}>
        <div className={`${tab.vaccineRow} ${tab.colHead}`}>
          <B className={styles.headCell} />
          <B className={styles.headCell} />
          <B className={styles.headCellWide} />
          <B className={styles.headCell} />
        </div>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className={`${tab.vaccineRow} ${styles.row}`}>
            <span className={styles.nameCell}><B className={styles.chevron} /><B className={styles.name} /></span>
            <span className={styles.progressCell}><B className={styles.count} /><B className={styles.dots} /></span>
            <span className={styles.cell}><B className={styles.next} /></span>
            <span className={styles.cell}><B className={styles.badge} /></span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Loading state for the CIS-CMB10 Vaccine Calendar tab, laid out like the
 * tab: dose progress card (title, facts, status, dose blocks, legend), the
 * list bar (Vaccine / Age toggle, actions, Expand all) and two vaccine
 * groups with their column headers.
 */
export function CisTabSkeleton() {
  return (
    <div className={tab.tab} aria-busy="true" aria-label="Loading vaccine calendar">
      <section className={tab.summary}>
        <div className={tab.doseProgress}>
          <div className={styles.progressHead}>
            <B className={styles.title} />
            <span className={styles.facts}>
              <B className={styles.fact} />
              <B className={styles.factWide} />
              <B className={styles.badge} />
            </span>
          </div>
          <div className={styles.blocks}>
            {Array.from({ length: DOSE_BLOCKS }, (_, i) => <B key={i} className={styles.block} />)}
          </div>
          <div className={styles.legend}>
            {Array.from({ length: LEGEND }, (_, i) => <B key={i} className={styles.legendItem} />)}
          </div>
        </div>
      </section>
      <section className={tab.vaccines}>
        <div className={tab.listBar}>
          <B className={styles.toggle} />
          <span className={styles.actions}>
            <B className={styles.icon} />
            <B className={styles.icon} />
            <B className={styles.expand} />
            <B className={styles.icon} />
          </span>
        </div>
        <VaccineGroup rows={2} />
        <VaccineGroup rows={4} />
      </section>
    </div>
  );
}

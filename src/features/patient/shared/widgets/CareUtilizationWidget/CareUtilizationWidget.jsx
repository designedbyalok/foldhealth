import { useState } from 'react';
import { Icon } from '../../../../../components/Icon/Icon';
import { BadgeSelect } from '../../../../../components/BadgeSelect/BadgeSelect';
import { PanelSection, usePanelEmbedded } from '../../../../../components/PanelSection/PanelSection';
import styles from './CareUtilizationWidget.module.css';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const VISIT_TYPES = [
  { key: 'OP',        label: 'OP',         color: 'var(--primary-300)',        bg: 'var(--primary-100)',              data: [1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 1] },
  { key: 'IP',        label: 'IP',         color: 'var(--accent-cyan)',        bg: 'var(--accent-light-cyan)',        data: [0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { key: 'ER',        label: 'ER',         color: 'var(--accent-pink)',        bg: 'var(--accent-light-pink)',        data: [0, 0, 1, 0, 1, 2, 0, 0, 0, 0, 0, 0] },
  { key: 'Specialty', label: 'Specialty',  color: 'var(--accent-amber)',       bg: 'var(--accent-light-amber)',       data: [1, 1, 0, 0, 0, 0, 2, 1, 0, 0, 0, 0] },
  { key: 'HomeVisit', label: 'Home Visit', color: 'var(--accent-light-green)', bg: 'var(--accent-light-light-green)', data: [0, 0, 2, 0, 0, 0, 0, 0, 1, 0, 1, 0] },
];

const YEARS = ['2024'];
const total = (data) => data.reduce((sum, n) => sum + n, 0);

export function CareUtilizationWidget() {
  const [year, setYear] = useState(YEARS[0]);
  const embedded = usePanelEmbedded();

  const chart = (
    <>
        <div className={styles.legend}>
          {VISIT_TYPES.map(vt => (
            <span key={vt.key} className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: vt.color }} />
              {vt.label} ({total(vt.data)})
            </span>
          ))}
        </div>

        <div className={styles.grid}>
          {MONTHS.map((month, mi) => (
            <div key={month} className={styles.monthCol}>
              <div className={styles.badgeStack}>
                {VISIT_TYPES.filter(vt => vt.data[mi] > 0).map(vt => (
                  <span
                    key={vt.key}
                    className={styles.badge}
                    style={{ color: vt.color, background: vt.bg, borderColor: vt.color }}
                    title={`${vt.label}: ${vt.data[mi]} in ${month}`}
                  >
                    {vt.data[mi]}
                  </span>
                ))}
              </div>
              <span className={styles.monthLabel}>{month}</span>
            </div>
          ))}
        </div>

        <div className={styles.footer}>
          <span className={styles.footerItem}>
            Last Annual Visit:
            <span className={styles.footerLink}>
              <Icon name="solar:document-linear" size={14} color="var(--primary-300)" />
              12/23/2023
            </span>
          </span>
          <span className={styles.footerItem}>Total Cost: $67,450</span>
        </div>
    </>
  );

  return (
    <PanelSection
      plain={embedded}
      icon="solar:hospital-linear"
      title="Care Utilization Summary"
      actions={<BadgeSelect value={year} options={YEARS} onChange={setYear} />}
    >
      {embedded ? chart : <div className={styles.container}>{chart}</div>}
    </PanelSection>
  );
}

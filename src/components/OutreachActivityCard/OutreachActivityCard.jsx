import { Fragment } from 'react';
import { Icon } from '../Icon/Icon';
import { DownChevronIcon } from '../Icon/DownChevronIcon';
import styles from './OutreachActivityCard.module.css';

const OUTCOME_CLASS = { success: styles.outcomeOk, warning: styles.outcomeNote, error: styles.outcomeFailed };

/**
 * OutreachActivityCard: a member's latest outreach attempts as a short
 * timeline (Figma P360 Revamp 608:347090), shown on hover of a worklist
 * Outreach cell.
 *
 * Props:
 *  - items      [{ key, date, time?, by?, title, outcome?, failed?, tone?, kind? }],
 *                 tone ('success' | 'warning' | 'error') wins over failed.
 *               newest first. `kind: 'letter'` shows a document icon.
 *  - onViewAll  () => void: optional "View All" link to the full log
 */
export function OutreachActivityCard({ items, onViewAll }) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>Outreach Activity</div>
      <div className={styles.list}>
        {items.map((it, i) => (
          <div key={it.key} className={styles.item}>
            <div className={styles.rail}>
              <span className={styles.railTop} />
              <span className={styles.iconTile}>
                <Icon name={it.kind === 'letter' ? 'solar:document-text-linear' : 'solar:phone-calling-linear'} size={14} color="var(--neutral-300)" />
              </span>
              {i < items.length - 1 && <span className={styles.railBottom} />}
            </div>
            <div className={styles.body}>
              <div className={styles.meta}>
                {[it.date, it.time, it.by].filter(Boolean).map((t, j) => (
                  <Fragment key={j}>{j > 0 && <span aria-hidden="true">•</span>}<span>{t}</span></Fragment>
                ))}
              </div>
              <div className={styles.title}>{it.title}</div>
              {it.outcome && <div className={OUTCOME_CLASS[it.tone || (it.failed ? 'error' : 'success')]}>{it.outcome}</div>}
            </div>
          </div>
        ))}
      </div>
      {onViewAll && (
        <div className={styles.footer}>
          <button type="button" className={styles.viewAll} onClick={onViewAll}>
            View All
            <DownChevronIcon size={16} color="var(--primary-300)" className={styles.chevron} />
          </button>
        </div>
      )}
    </div>
  );
}

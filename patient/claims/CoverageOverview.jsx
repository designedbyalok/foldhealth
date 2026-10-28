import { useState } from 'react';
import { Icon } from '@/components/Icon/Icon';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { Collapse } from '@/components/Collapse/Collapse';
import { accumulatorSummary, money, moneyWhole, short } from './claimFormat';
import { CoverageGuideDrawer } from './CoverageGuideDrawer';
import styles from './Claims.module.css';

const pct = (part, whole) => (whole > 0 ? `${Math.min(100, (part / whole) * 100)}%` : '0%');

function AccumulatorRow({ a }) {
  const [open, setOpen] = useState(false);
  const s = accumulatorSummary(a);
  return (
    <li className={styles.acc}>
      <button type="button" className={styles.accHead} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className={styles.accLabel}>
          {a.label}
          <Icon name={open ? 'solar:alt-arrow-down-linear' : 'solar:alt-arrow-right-linear'} size={14} color="currentColor" />
        </span>
        <span className={styles.accTotal}>Total: <strong>{moneyWhole(s.total)}</strong> / {moneyWhole(s.limit)}</span>
      </button>
      <div className={styles.bar} role="img" aria-label={`${moneyWhole(s.total)} of ${moneyWhole(s.limit)}`}>
        <span className={styles.barIn} style={{ width: pct(a.in_spent, s.limit) }} />
        <span className={styles.barOut} style={{ width: pct(a.out_spent, s.limit) }} />
        <span className={styles.barMark} style={{ left: pct(a.in_limit, s.limit) }} aria-hidden="true" />
      </div>
      <div className={styles.accLegend}>
        <span><span className={`${styles.dot} ${styles.dotIn}`} />{moneyWhole(a.in_spent)} /{short(a.in_limit)}</span>
        <span><span className={`${styles.dot} ${styles.dotOut}`} />{moneyWhole(a.out_spent)} /{short(a.out_limit)}</span>
      </div>
      <Collapse open={open}>
        <p className={`${styles.accNote} ${s.met ? styles.accMet : ''}`}>
          {s.met && <Icon name="solar:confetti-linear" size={16} color="currentColor" />}
          {s.text}
        </p>
      </Collapse>
    </li>
  );
}

const share = (copay, coinsurance) => [
  `Copay: ${copay == null ? 'n/a' : money(copay)}`,
  `Coinsurance: ${coinsurance == null ? 'n/a' : `${coinsurance}%`}`,
];

export function CoverageOverview({ coverage }) {
  const [guide, setGuide] = useState(false);
  if (!coverage) {
    return (
      <div className={styles.card}>
        <EmptyState icon="solar:shield-check-linear" title="No coverage on file" description="Your care team has not added your plan yet." />
      </div>
    );
  }
  return (
    <div className={styles.stack}>
      <div className={styles.overviewHead}>
        <span className={styles.heading}>Coverage Overview</span>
        <span className={styles.legend}>
          <span><span className={`${styles.dot} ${styles.dotIn}`} />In Network</span>
          <span><span className={`${styles.dot} ${styles.dotOut}`} />Out of Network</span>
        </span>
      </div>
      <p className={styles.plan}>{coverage.plan_name} • {coverage.plan_year}</p>
      <ul className={styles.accList}>
        {coverage.accumulators.map((a) => <AccumulatorRow key={a.key} a={a} />)}
      </ul>

      <span className={styles.heading}>Cost Breakdown</span>
      <ul className={styles.shares}>
        {coverage.cost_shares.map((c) => (
          <li key={c.service} className={styles.share}>
            <span className={styles.shareTitle}>{c.service}</span>
            <span className={styles.shareRow}>
              <span className={`${styles.dot} ${styles.dotIn}`} aria-label="In network" />
              {share(c.in_copay, c.in_coinsurance).map((t) => <span key={t}>{t}</span>)}
            </span>
            <span className={styles.shareRow}>
              <span className={`${styles.dot} ${styles.dotOut}`} aria-label="Out of network" />
              {share(c.out_copay, c.out_coinsurance).map((t) => <span key={t}>{t}</span>)}
            </span>
          </li>
        ))}
      </ul>

      <button type="button" className={styles.guide} onClick={() => setGuide(true)}>
        <span className={styles.guideTitle}>
          <Icon name="solar:lightbulb-linear" size={16} color="currentColor" />
          Understanding Your Coverage
        </span>
        <span className={styles.guideText}>Learn what In Network, Out of Network and deductibles mean.</span>
        <span className={styles.guideLink}>Learn More <Icon name="solar:alt-arrow-right-linear" size={14} color="currentColor" /></span>
      </button>
      {guide && <CoverageGuideDrawer onClose={() => setGuide(false)} />}
    </div>
  );
}

import { Icon } from '../../components/Icon/Icon';
import { Tooltip } from '../../components/Tooltip/Tooltip';
import { ADHERENCE_BANDS } from './myPatientsModel';
import styles from './AdherenceStrip.module.css';

const HOW_SCORED = (
  <span className={styles.help}>
    <span className={styles.helpTitle}>How Plan Adherence Is Scored</span>
    <span>A 0 to 100 score for how closely the care plan is being followed, recalculated every night from:</span>
    <span className={styles.helpRow}><span>Interventions on schedule</span><span>40%</span></span>
    <span className={styles.helpRow}><span>Tasks done on time</span><span>25%</span></span>
    <span className={styles.helpRow}><span>Goal reviews current</span><span>20%</span></span>
    <span className={styles.helpRow}><span>Reachable on preferred channel</span><span>15%</span></span>
    <span>On Track is 75 and above, At Risk 55 to 74, Off Track below 55. The list is sorted lowest first, so the patients slipping most come first.</span>
  </span>
);

/**
 * Care Plan Adherence across the list (prototype): one bar split by band,
 * and each band's count, which filters the list to it.
 */
export function AdherenceStrip({ counts, active = [], onPick }) {
  const total = ADHERENCE_BANDS.reduce((n, b) => n + counts[b.label], 0) || 1;
  return (
    <div className={styles.strip}>
      <span className={styles.title}>Care Plan Adherence</span>
      <span className={styles.bar} role="img" aria-label={ADHERENCE_BANDS.map(b => `${counts[b.label]} ${b.label}`).join(', ')}>
        {ADHERENCE_BANDS.map(b => counts[b.label] > 0 && (
          <span key={b.label} className={styles[`seg_${b.tone}`]} style={{ width: `${(counts[b.label] / total) * 100}%` }} />
        ))}
      </span>
      {ADHERENCE_BANDS.map(b => (
        <button
          key={b.label}
          type="button"
          className={`${styles.count} ${active.includes(b.label) ? styles.countOn : ''}`}
          aria-pressed={active.includes(b.label)}
          onClick={() => onPick(b.label)}
        >
          <span className={styles[`dot_${b.tone}`]} aria-hidden="true" />
          <strong>{counts[b.label]}</strong> {b.label}
        </button>
      ))}
      <span className={styles.spacer} />
      <Tooltip label={HOW_SCORED} variant="card" maxWidth={320} placement="bottom" align="right">
        <span className={styles.howLink} tabIndex={0}>
          How Adherence Is Scored
          <Icon name="solar:question-circle-linear" size={14} color="currentColor" />
        </span>
      </Tooltip>
    </div>
  );
}

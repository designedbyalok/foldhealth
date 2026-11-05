import { Badge } from '../../../../../components/Badge/Badge';
import styles from './AssessmentDetail.module.css';

const BAND_TONE = { critical: 'danger', high: 'danger', warning: 'warning', info: 'info', neutral: 'neutral' };
const pad = n => String(n).padStart(2, '0');

/** Questions answered, the score and its interpretation; parts without data stay hidden. */
export function AssessmentScoreStrip({ answered, total, score, band }) {
  const parts = [
    total > 0 && (
      <span key="answered" className={styles.stripItem}>
        Questions Answered:
        <span className={styles.bar} role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={answered}>
          <span className={styles.barFill} style={{ width: `${(answered / total) * 100}%` }} />
        </span>
        <strong>{pad(answered)}/{pad(total)}</strong>
      </span>
    ),
    score != null && (
      <span key="score" className={styles.stripItem}>
        Assessment Score: <strong>{Number.isInteger(score) ? score : score.toFixed(1)}</strong>
      </span>
    ),
    band?.label && (
      <span key="band" className={styles.stripItem}>
        Interpretation Score: <Badge tone={BAND_TONE[band.severity] || 'neutral'} size="xs" label={band.label} />
      </span>
    ),
  ].filter(Boolean);
  if (!parts.length) return null;
  return (
    <div className={styles.strip}>
      {parts.flatMap((p, i) => (i ? [<span key={`dot-${i}`} className={styles.stripDot} aria-hidden="true">•</span>, p] : [p]))}
    </div>
  );
}

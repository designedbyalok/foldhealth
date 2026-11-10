import { CarePlanProgressRing } from '@/components/CarePlanProgressRing/CarePlanProgressRing';
import { Icon } from '@/components/Icon/Icon';
import { fmtCarePlanDate } from '../tables/carePlanTableModel';
import styles from './CarePlanSummaryStrip.module.css';

const TILES = [
  { kind: 'goal', label: 'Goals', key: 'goals', issue: 'off target' },
  { kind: 'intervention', label: 'Interventions', key: 'interventions', issue: 'overdue' },
  { kind: 'barrier', label: 'Barriers', key: 'barriers', issue: 'without intervention', warn: true },
];

// The review tile's two lines, from useReviewCadence.
function reviewText(review) {
  const s = review?.status;
  if (!s) return null;
  const last = review.lastReview ? `Last ${fmtCarePlanDate(review.lastReview)}` : 'Not reviewed yet';
  if (s.state === 'overdue') return { tone: 'danger', title: 'Review overdue', sub: `${s.daysOverdue} ${s.daysOverdue === 1 ? 'day' : 'days'} late • ${last}` };
  if (s.state === 'due') return { tone: 'warning', title: 'Review due', sub: last };
  if (s.state === 'upcoming') return { tone: 'neutral', title: `Next review ${fmtCarePlanDate(review.due)}`, sub: review.cadence?.label || last };
  return { tone: 'neutral', title: 'No review scheduled', sub: 'The cadence starts once the plan is signed' };
}

/**
 * The care plan at a glance (care plan redesign prototype): average goal
 * progress, the goal / intervention / barrier counts with what needs
 * attention in each, and where the review cadence stands.
 *
 * A tile with an issue toggles the Needs Attention filter; the review tile
 * opens the Review Cadence tab. `attention` is carePlanFocusItems without
 * the review, the same list the section badges count.
 */
export function CarePlanSummaryStrip({ totals, attention, attentionOn, onToggleAttention, review, onOpenCadence }) {
  const rv = reviewText(review);
  return (
    <div className={styles.strip}>
      <div className={styles.progress}>
        <CarePlanProgressRing progress={totals.avgProgress} title={`${totals.avgProgress}% average goal progress`} />
        {/* The ring prints the percentage; its tooltip says it's the average. */}
        <span className={styles.label}>Goal progress</span>
      </div>

      {TILES.map(t => {
        const n = attention.filter(a => a.kind === t.kind).length;
        const body = (
          <>
            <span className={styles.value}>{totals[t.key]} <span className={styles.label}>{t.label}</span></span>
            <span className={n ? (t.warn ? styles.issueWarn : styles.issue) : styles.ok}>{n ? `${n} ${t.issue}` : 'On track'}</span>
          </>
        );
        return n ? (
          <button
            key={t.kind}
            type="button"
            className={`${styles.tile} ${styles.tileButton}`}
            aria-pressed={attentionOn}
            title={attentionOn ? 'Show all items' : 'Show only what needs attention'}
            onClick={onToggleAttention}
          >
            {body}
          </button>
        ) : (
          <div key={t.kind} className={styles.tile}>{body}</div>
        );
      })}

      {rv && (
        <button type="button" className={`${styles.tile} ${styles.tileButton}`} onClick={onOpenCadence} title="Open Review Cadence">
          <span className={`${styles.reviewTitle} ${styles[rv.tone]}`}>
            {rv.tone !== 'neutral' && <Icon name="solar:calendar-mark-linear" size={14} color="currentColor" />}
            {rv.title}
          </span>
          <span className={styles.label}>{rv.sub}</span>
        </button>
      )}
    </div>
  );
}

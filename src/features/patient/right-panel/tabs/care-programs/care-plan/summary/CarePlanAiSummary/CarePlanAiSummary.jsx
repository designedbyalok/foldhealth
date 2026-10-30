import { Icon } from '../../../../../../../../components/Icon/Icon';
import styles from './CarePlanAiSummary.module.css';

/* The AI care plan summary's UI: trigger, loading skeleton and saved card.
   Logic lives in useCarePlanAiSummary.js. */

// State-aware trigger: Summarize (idle) → AI is writing… (loading) →
// Generated Summary (ready). Loading and ready don't re-trigger; the card's
// refresh button regenerates.
export function SummarizeButton({ state, onClick, idleLabel = 'Summarize' }) {
  return (
    <button
      type="button"
      className={`${styles.summarizeBtn} ${state === 'loading' ? styles.summarizeBtnBusy : ''}`}
      onClick={onClick}
      disabled={state !== 'idle'}
      aria-label={state === 'loading' ? 'Summary is generating' : state === 'ready' ? 'Summary generated' : idleLabel}
    >
      <Icon name="custom:ai" size={14} color="var(--primary-300)" />
      <span>{state === 'loading' ? 'AI is writing…' : state === 'ready' ? 'Generated Summary' : 'Summarize'}</span>
    </button>
  );
}

export function AiSummarySkeleton() {
  return (
    <div className={styles.summarySkeleton} aria-live="polite">
      <span className={styles.summarySkeletonLine} style={{ width: '70%' }} />
      <span className={styles.summarySkeletonLine} style={{ width: '90%' }} />
      <span className={styles.summarySkeletonLine} style={{ width: '55%' }} />
      <Icon name="solar:refresh-linear" size={16} color="var(--primary-300)" className={styles.summarySpinner} />
    </div>
  );
}

// The saved summary. Footer carries the paginator + copy / regenerate /
// delete affordances.
export function AiSummaryCard({ data, index = 0, total = 1, onPrev, onNext, onCopy, onRegenerate, onDelete, label = 'AI-generated program summary' }) {
  return (
    <div className={styles.summaryCard} role="region" aria-label={label}>
      <p className={styles.summaryIntro}>{data.intro}</p>
      <ol className={styles.summaryList}>
        {data.points.map((p, i) => (
          <li key={i}>
            <strong>{p.title}:</strong> {p.body}
          </li>
        ))}
      </ol>
      <div className={styles.summaryActionsHead}>Action Items :</div>
      <ul className={styles.summaryActions}>
        {data.actions.map((a, i) => <li key={i}>{a}</li>)}
      </ul>
      <div className={styles.summaryFooter}>
        <div className={styles.summaryPager}>
          <button type="button" className={styles.summaryPagerBtn} onClick={onPrev} disabled={total <= 1} aria-label="Previous summary">
            <Icon name="solar:alt-arrow-left-linear" size={14} color="var(--neutral-400)" />
          </button>
          <span className={styles.summaryPagerCount}>{index + 1}/{total}</span>
          <button type="button" className={styles.summaryPagerBtn} onClick={onNext} disabled={total <= 1} aria-label="Next summary">
            <Icon name="solar:alt-arrow-right-linear" size={14} color="var(--neutral-400)" />
          </button>
        </div>
        <div className={styles.summaryToolbar}>
          <button type="button" className={styles.summaryToolBtn} onClick={onCopy} aria-label="Copy summary">
            <Icon name="solar:copy-linear" size={14} color="var(--neutral-400)" />
          </button>
          <button type="button" className={styles.summaryToolBtn} onClick={onRegenerate} aria-label="Regenerate summary">
            <Icon name="solar:refresh-linear" size={14} color="var(--neutral-400)" />
          </button>
          <button type="button" className={styles.summaryToolBtn} onClick={onDelete} aria-label="Dismiss summary">
            <Icon name="solar:trash-bin-trash-linear" size={14} color="var(--neutral-400)" />
          </button>
        </div>
      </div>
    </div>
  );
}

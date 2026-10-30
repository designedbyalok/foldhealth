import { Button } from '../../../../../../../components/Button/Button';
import { UnityIcon } from '../../../../../../../components/UnityIcon/UnityIcon';
import { TableSkeleton } from '../../../../../../../components/TableSkeleton/TableSkeleton';
import styles from './IndividualizedPlanCard.module.css';

/**
 * The recommended care plan surface:
 *   'start'    an empty plan: recommend one (automation-matched templates
 *              merged by UnityAI), or start from a template
 *   'drafting' matching templates and drafting
 *   'review'   recommended items awaiting approval: approve, or discard
 */
export function IndividualizedPlanCard({ state, pending = 0, templates = [], error, onDraft, onUseTemplate, onReviewAll, onDiscard, busy = false }) {
  if (state === 'drafting') {
    return (
      <div className={styles.card} role="status" aria-live="polite">
        <span className={styles.title}>
          <UnityIcon size={16} color="var(--primary-300)" />
          Recommending a care plan…
        </span>
        <span className={styles.text}>
          Matching this patient to your care plan automations, then merging the matched templates into one plan tailored to their conditions, lab trends, recent events, assessments and barriers.
        </span>
        <TableSkeleton rows={4} />
      </div>
    );
  }
  if (state === 'review') {
    return (
      <div className={`${styles.card} ${styles.review}`} role="status">
        <div className={styles.row}>
          <UnityIcon size={16} color="var(--primary-300)" />
          <div className={styles.copy}>
            <span className={styles.title}>Recommended plan: {pending} {pending === 1 ? 'item' : 'items'} awaiting approval</span>
            {templates.length > 0 && (
              <span className={styles.text}>
                From {templates.length === 1 ? 'template' : 'templates'} <strong>{templates.map(t => t.name).join(', ')}</strong>, applied to the plan with their conditions when you approve.
              </span>
            )}
            <span className={styles.text}>Open an item’s AI · Review badge to see why it was recommended and the patient inputs it cites. Edit or remove anything, then approve to make it this patient’s care plan.</span>
          </div>
          <Button variant="outline" size="sm" disabled={busy} onClick={onDiscard}>Discard</Button>
          <Button size="sm" disabled={busy} onClick={onReviewAll}>Approve Plan</Button>
        </div>
      </div>
    );
  }
  return (
    <div className={styles.card}>
      <span className={styles.title}>Start this care plan</span>
      <span className={styles.text}>
        Your care plan automations match this patient’s conditions and record to templates, and UnityAI merges every matched template into one plan tailored to them (with no match, it picks the best-fitting templates). Every item cites the inputs behind it and stays flagged until you approve the plan.
      </span>
      {error && <span className={styles.error}>{error}</span>}
      <div className={styles.actions}>
        <Button leadingIconElement={<UnityIcon size={16} color="currentColor" />} onClick={onDraft}>
          Recommend Care Plan
        </Button>
        {onUseTemplate && <Button variant="outline" onClick={onUseTemplate}>Use Template</Button>}
      </div>
    </div>
  );
}

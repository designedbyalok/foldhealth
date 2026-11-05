import { Button } from '../../../../../../../components/Button/Button';
import { Icon } from '../../../../../../../components/Icon/Icon';
import { UnityIcon } from '../../../../../../../components/UnityIcon/UnityIcon';
import { TableSkeleton } from '../../../../../../../components/TableSkeleton/TableSkeleton';
import { UnityPromptField } from '../../../../../../../components/UnityPromptField/UnityPromptField';
import { DESCRIPTION_MAX } from '../lib/individualizedPlan';
import styles from './IndividualizedPlanCard.module.css';

const DESCRIBE_EXAMPLE = '68-year-old with type 2 diabetes and high blood pressure, lives alone, often misses doses and has no transport to appointments.';

/**
 * The recommended care plan surface:
 *   'start'    an empty plan: recommend one (automation-matched templates
 *              merged by UnityAI), or start from a template
 *   'describe' the record has nothing to plan from: the care manager
 *              describes the patient and UnityAI drafts from that
 *   'drafting' matching templates and drafting
 *   'review'   recommended items awaiting approval: approve, or discard
 *   'suggested' a completed assessment suggested templates (`suggestions`,
 *              [{ id, templateName, reason }]): recommend a plan from them,
 *              or dismiss them
 */
export function IndividualizedPlanCard({
  state, pending = 0, templates = [], suggestions = [], error, onDraft, onUseTemplate, onReviewAll, onDiscard, busy = false,
  description = '', onDescriptionChange, onCancel, fromDescription = false,
}) {
  if (state === 'suggested') {
    return (
      <div className={`${styles.card} ${styles.review}`} role="status">
        <div className={styles.row}>
          <Icon name="solar:clipboard-check-linear" size={16} color="var(--primary-300)" />
          <div className={styles.copy}>
            <span className={styles.title}>Suggested by {suggestions.length === 1 ? 'an assessment' : 'assessments'}</span>
            <ul className={styles.suggestions}>
              {suggestions.map(s => (
                <li key={s.id} className={styles.text}><strong>{s.templateName}</strong>: {s.reason}</li>
              ))}
            </ul>
            <span className={styles.text}>UnityAI merges the suggested templates into this plan as recommended items, flagged until you approve them.</span>
            {error && <span className={styles.error}>{error}</span>}
          </div>
          <Button variant="outline" size="sm" disabled={busy} onClick={onDiscard}>Dismiss</Button>
          <Button size="sm" disabled={busy} leadingIconElement={<UnityIcon size={16} color="currentColor" />} onClick={onDraft}>Recommend Care Plan</Button>
        </div>
      </div>
    );
  }
  if (state === 'drafting') {
    return (
      <div className={styles.card} role="status" aria-live="polite">
        <span className={styles.title}>
          <UnityIcon size={16} color="var(--primary-300)" />
          {fromDescription ? 'Drafting a care plan from your description…' : 'Recommending a care plan…'}
        </span>
        <span className={styles.text}>
          {fromDescription
            ? 'Turning your description into goals, interventions and barriers, using your care plan library first.'
            : 'Matching this patient to your care plan automations, then merging the matched templates into one plan tailored to their conditions, lab trends, recent events, assessments and barriers.'}
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
  if (state === 'describe') {
    return (
      <div className={styles.card}>
        <span className={styles.title}>Describe this patient</span>
        <span className={styles.text}>
          This patient’s profile and record have nothing UnityAI can plan from yet: no conditions, condition tags, labs, events, assessments or barriers. Describe the patient and what the care plan should focus on, and UnityAI drafts it. Every item cites your description and stays flagged until you approve the plan.
        </span>
        <UnityPromptField
          label="Describe the patient"
          value={description}
          onChange={onDescriptionChange}
          onSubmit={onDraft}
          placeholder="Conditions, recent events, what gets in the way, and what the plan should focus on"
          example={DESCRIBE_EXAMPLE}
          actionLabel="Generate Care Plan"
          error={error}
          hint="UnityAI uses your care plan library first. Your description is kept as the evidence behind each item."
          maxLength={DESCRIPTION_MAX}
          minLength={20}
          rows={4}
        />
        {(onUseTemplate || onCancel) && (
          <div className={styles.actions}>
            {onUseTemplate && <Button variant="outline" onClick={onUseTemplate}>Use Template</Button>}
            {onCancel && <Button variant="ghost" onClick={onCancel}>Cancel</Button>}
          </div>
        )}
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

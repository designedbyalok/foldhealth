import { useState } from 'react';
import { Badge } from '../../../../../../../components/Badge/Badge';
import { Button } from '../../../../../../../components/Button/Button';
import { AnchoredPopover } from '../../../../../../../components/AnchoredPopover/AnchoredPopover';
import { Icon } from '../../../../../../../components/Icon/Icon';
import { useAiReview } from './aiReviewContext';
import styles from './AiSuggestionBadge.module.css';

const KIND_LABEL = {
  condition: 'Condition', lab: 'Lab', lab_trend: 'Lab trend', event: 'Event', assessment: 'Assessment', barrier: 'Barrier',
  description: 'Care manager', profile: 'Profile',
};
const KIND_ICON = {
  condition: 'solar:clipboard-heart-linear', lab: 'solar:test-tube-linear', lab_trend: 'solar:graph-up-linear',
  event: 'solar:hospital-linear', assessment: 'solar:document-text-linear', barrier: 'custom:barrier',
  description: 'solar:pen-new-square-linear', profile: 'solar:user-id-linear',
};

/**
 * "AI · Review" on a goal, intervention or barrier UnityAI drafted that no one
 * has reviewed yet (lib/individualizedPlan). Opens the rationale and the
 * patient inputs it cites, as they read when the plan was drafted, with
 * Mark Reviewed when the plan provides it. Renders nothing otherwise.
 */
export function AiSuggestionBadge({ kind, item }) {
  const review = useAiReview();
  const [rect, setRect] = useState(null);
  const [saving, setSaving] = useState(false);
  if (!item?.aiSuggested || item.aiReviewedAt) return null;

  const markReviewed = async () => {
    setSaving(true);
    try {
      await review.onReview(kind, item);
      setRect(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={(e) => { e.stopPropagation(); setRect(e.currentTarget.getBoundingClientRect()); }}
        aria-label="Suggested by UnityAI: view why and review"
      >
        <Badge tone="unity" size="XS" icon="custom:ai" label="AI · Review" />
      </button>
      {rect && (
        <AnchoredPopover
          anchorRect={rect}
          title="Suggested by UnityAI"
          description={item.aiRationale || 'Drafted from this patient’s record.'}
          width={380}
          align="left"
          onClose={() => setRect(null)}
        >
          <div className={styles.body} onClick={e => e.stopPropagation()} role="presentation">
            <span className={styles.label}>Based on</span>
            <ul className={styles.citations}>
              {(item.aiCitations || []).map(c => (
                <li key={c.fact} className={styles.citation}>
                  <Icon name={KIND_ICON[c.kind] || 'solar:document-linear'} size={14} color="var(--neutral-300)" />
                  <span className={styles.citationText}>
                    <span className={styles.kind}>{KIND_LABEL[c.kind] || 'Input'}</span> {c.text}
                  </span>
                </li>
              ))}
            </ul>
            {review?.onReview && (
              <Button size="sm" leadingIcon="solar:check-circle-linear" onClick={markReviewed} loading={saving}>
                Mark Reviewed
              </Button>
            )}
          </div>
        </AnchoredPopover>
      )}
    </>
  );
}

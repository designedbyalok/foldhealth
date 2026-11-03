import { Icon } from '@/components/Icon/Icon';
import { Badge } from '@/components/Badge/Badge';
import { Button } from '@/components/Button/Button';
import { fmtCarePlanDate } from '../tables/carePlanTableModel';
import { describeChange, eventTitle } from '../lib/eventImpact';
import styles from './EventUpdatesList.module.css';

const KIND_ICON = {
  adt: 'solar:hospital-linear',
  lab: 'solar:test-tube-linear',
  vital: 'solar:heart-pulse-linear',
  device: 'solar:heart-pulse-linear',
  medication: 'solar:pill-linear',
  assessment: 'solar:clipboard-check-linear',
  prom: 'solar:clipboard-check-linear',
  encounter: 'solar:hospital-linear',
  note: 'solar:document-text-linear',
};

function ChangeRow({ change, busy, canEdit, onDecide }) {
  const d = describeChange(change);
  return (
    <div className={styles.change}>
      <div className={styles.changeText}>
        <div className={styles.changeHead}>
          <span>
            {d.action} <span className={styles.subject}>{d.subject}</span>
          </span>
          {d.from !== undefined && (
            <span className={styles.pills}>
              <Badge size="S" tone="grey" label={d.from || 'None'} />
              <Icon name="solar:arrow-right-linear" size={14} color="var(--neutral-200)" />
              <Badge size="S" tone="primary" label={d.to} />
            </span>
          )}
          {change.source === 'ai' && <Badge size="S" tone="unity" label="AI" />}
        </div>
        <span className={styles.rationale}>{change.rationale}</span>
      </div>
      {canEdit && (
        <span className={styles.changeActions}>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => onDecide('dismissed')}>Dismiss</Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => onDecide('accepted')}>Accept</Button>
        </span>
      )}
    </div>
  );
}

/**
 * The events behind the care plan overview's "Event updates" tab (#84), each
 * with the changes proposed for it by rules and the AI. Accepting a change
 * applies it to the plan; dismissing sets it aside. `updates` comes from
 * useEventUpdates.
 */
export function EventUpdatesList({ updates, canEdit }) {
  const { pending, busy, run, dismissImpact } = updates;
  return (
    <div className={styles.list}>
      {pending.map(impact => (
        <div key={impact.id} className={styles.event}>
          <div className={styles.eventHead}>
            <span className={styles.eventIcon}>
              <Icon name={KIND_ICON[impact.event.kind] || 'solar:bell-linear'} size={14} color={impact.event.abnormal ? 'var(--status-error)' : 'var(--neutral-300)'} />
            </span>
            <span className={styles.eventTitle}>{eventTitle(impact.event)}</span>
            <span className={styles.muted}>{fmtCarePlanDate(impact.event.occurredAt)}</span>
            <span className={styles.spacer} />
            {canEdit && impact.open.length > 1 && (
              <Button variant="ghost" size="sm" disabled={busy === impact.id} onClick={() => run(impact, impact.open, 'accepted')}>
                Accept All
              </Button>
            )}
            {canEdit && impact.open.length === 0 && (
              <Button variant="ghost" size="sm" onClick={() => dismissImpact(impact)}>Dismiss</Button>
            )}
          </div>
          {(impact.aiSummary || impact.reasons.length > 0) && (
            <p className={styles.summary}>{impact.aiSummary || impact.reasons.join(' • ')}</p>
          )}
          {impact.aiError && <p className={styles.muted}>AI suggestions unavailable: {impact.aiError}</p>}
          {impact.open.map(c => (
            <ChangeRow
              key={c.id}
              change={c}
              busy={busy === impact.id}
              canEdit={canEdit}
              onDecide={decision => run(impact, [c], decision)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

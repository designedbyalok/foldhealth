import { useEffect, useState } from 'react';
import { useAppStore } from '../../../../../../../store/useAppStore';
import { Icon } from '@/components/Icon/Icon';
import { Badge } from '@/components/Badge/Badge';
import { Button } from '@/components/Button/Button';
import { fmtCarePlanDate } from '../tables/carePlanTableModel';
import { describeChange, eventTitle } from '../lib/eventImpact';
import styles from './EventUpdatesCard.module.css';

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
 * New patient events that touch this care plan (#84), each with the changes
 * proposed for it by rules and the AI. Accepting a change applies it to the
 * plan; dismissing sets it aside. The card hides once nothing is left.
 */
export function EventUpdatesCard({ patientId, program, live, canEdit }) {
  const key = `${patientId}::${program?.id}`;
  const state = useAppStore(s => s.carePlanEventUpdates[key]);
  const fetchUpdates = useAppStore(s => s.fetchCarePlanEventUpdates);
  const decide = useAppStore(s => s.decideCarePlanEventChange);
  const dismissImpact = useAppStore(s => s.dismissCarePlanEventImpact);
  const [busy, setBusy] = useState(null);
  const [open, setOpen] = useState(true);
  const loaded = !!live?.plan;

  // Once per plan visit: evaluates whatever arrived since the last one.
  useEffect(() => {
    if (loaded && patientId && program?.id) fetchUpdates(patientId, program, live);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, patientId, program?.id]);

  const pending = (state?.impacts || [])
    .filter(i => i.status === 'pending' && state.events?.[i.eventId])
    .map(i => ({ ...i, event: state.events[i.eventId], open: i.changes.filter(c => !c.decision) }))
    .filter(i => i.open.length || (i.aiError && !i.changes.length))
    .sort((a, b) => new Date(b.event.occurredAt) - new Date(a.event.occurredAt));
  const count = pending.reduce((n, i) => n + i.open.length, 0);
  if (state?.missing || (!pending.length && !state?.evaluating)) return null;

  const run = async (impact, changes, decision) => {
    setBusy(impact.id);
    try {
      for (const c of changes) await decide(patientId, program, impact.id, c.id, decision);
    } finally { setBusy(null); }
  };

  return (
    <section className={styles.card} aria-label="Plan updates from new events">
      <div className={styles.head}>
        <Icon name="solar:bolt-circle-linear" size={16} color="var(--primary-300)" />
        <button type="button" className={styles.title} onClick={() => setOpen(v => !v)} aria-expanded={open}>
          Plan updates from new events
        </button>
        {count > 0 && <Badge size="S" tone="primary" label={`${count} to review`} />}
        {state?.evaluating && <span className={styles.muted}>Checking new events…</span>}
        <span className={styles.spacer} />
        <Icon
          name="solar:alt-arrow-down-linear"
          size={16}
          color="var(--neutral-300)"
          className={open ? undefined : styles.chevronFolded}
        />
      </div>
      {open && pending.map(impact => (
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
              <Button variant="ghost" size="sm" onClick={() => dismissImpact(patientId, program, impact.id)}>Dismiss</Button>
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
    </section>
  );
}

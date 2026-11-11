import { useMemo, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { DashboardCard, DashboardCardBody } from '@/components/DashboardCard/DashboardCard';
import { PanelSectionItem } from '@/components/PanelSection/PanelSection';
import { Icon } from '@/components/Icon/Icon';
import { Button } from '@/components/Button/Button';
import { AddTaskDrawer } from '../../../../../../tasks/AddTaskDrawer';
import { TasksCard } from '../../../overview/cards/TasksCard';
import { CappedRows } from '../../../overview/cards/CappedRows';
import { carePlanFocusItems } from '../lib/carePlanFocus';
import { describeChange, eventTitle } from '../lib/eventImpact';
import { computeDueDate } from '../tables/CarePlanInterventionsTable';
import { fmtCarePlanDate } from '../tables/carePlanTableModel';
import { useEventUpdates } from './useEventUpdates';
import { useReviewCadence } from './useReviewCadence';
import styles from './CarePlanFocusPanel.module.css';

const SEVERITY_ICON = {
  danger: ['solar:danger-circle-linear', 'var(--status-error)'],
  warning: ['solar:danger-triangle-linear', 'var(--status-warning)'],
};
const EMPTY = [];

/**
 * The care plan's side panel when no goal, intervention or barrier is open
 * (care plan redesign prototype): Look at These First, Suggested Actions and
 * the patient's tasks. Everything comes from data the plan already has:
 * the plan items, the event updates and review cadence the overview card
 * loads (read here without fetching again), and the store's tasks.
 */
export function CarePlanFocusPanel({ patientId, program, patientName, live, data, canEdit, onOpenItem }) {
  const review = useReviewCadence({ patientId, program, plan: live?.plan, fetch: false });
  const events = useEventUpdates({ patientId, program, live, fetch: false });
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const openCarePlanReviewFor = useAppStore(s => s.openCarePlanReviewFor);
  // A goal off target, or a review that's due, is taken up in the review.
  const startReview = () => openCarePlanReviewFor(`${patientId}::${program?.id}`);

  // The intervention table's own due date, so a row flagged here reads overdue there too.
  const focus = useMemo(() => carePlanFocusItems({
    goals: data.goals,
    interventions: data.interventions,
    barriers: data.barriers,
    measurements: live?.measurements || EMPTY,
    dueOf: i => computeDueDate(i),
    review,
  }), [data, live?.measurements, review]);

  const suggestions = events.missing ? EMPTY : events.pending.flatMap(impact => impact.open.map(change => ({ impact, change })));
  const patient = useMemo(() => ({ id: patientId, memberId: patientId, name: patientName }), [patientId, patientName]);
  const nextReview = review?.status?.state === 'upcoming' && review.due ? fmtCarePlanDate(review.due) : null;

  return (
    <div className={styles.panel}>
      <DashboardCard icon="solar:danger-circle-linear" title="Look at These First" count={focus.length || null}>
        <DashboardCardBody className={styles.listBody}>
          {focus.length === 0 ? (
            <p className={styles.empty}>Nothing needs attention.{nextReview ? ` Next review ${nextReview}.` : ''}</p>
          ) : (
            <CappedRows
              items={focus}
              limit={4}
              render={f => {
                const [icon, color] = SEVERITY_ICON[f.severity];
                return (
                  <PanelSectionItem
                    key={f.key}
                    inset
                    alignTop
                    wrapTitle
                    leading={<Icon name={icon} size={16} color={color} />}
                    title={f.item ? (
                      <button type="button" className={styles.titleButton} onClick={() => onOpenItem(f.kind, f.item)}>{f.title}</button>
                    ) : f.title}
                    meta={f.text}
                  >
                    {canEdit && (
                      <span className={styles.actions}>
                        {(f.kind === 'goal' || f.kind === 'review') && live?.plan?.id && (
                          <Button variant="outline" size="sm" onClick={startReview}>Start Review</Button>
                        )}
                        {f.item && (
                          <Button variant="ghost" size="sm" onClick={() => onOpenItem(f.kind, f.item)}>View Details</Button>
                        )}
                      </span>
                    )}
                  </PanelSectionItem>
                );
              }}
            />
          )}
        </DashboardCardBody>
      </DashboardCard>

      {/* Until the updates load, an empty card would wrongly say there are none. */}
      {events.loaded && !events.missing && (
        <DashboardCard icon="solar:lightbulb-minimalistic-linear" title="Suggested Actions" count={suggestions.length || null}>
          <DashboardCardBody className={styles.listBody}>
            {suggestions.length === 0 ? (
              <p className={styles.empty}>No suggestions right now.</p>
            ) : (
              <CappedRows
                items={suggestions}
                limit={3}
                render={({ impact, change }) => {
                  const d = describeChange(change);
                  const label = `${d.action} ${d.subject}${d.from !== undefined ? ` from ${d.from || 'None'} to ${d.to}` : ''}`;
                  return (
                    <PanelSectionItem
                      key={`${impact.id}:${change.id}`}
                      inset
                      alignTop
                      wrapTitle
                      leading={<Icon name="solar:bolt-linear" size={16} color="var(--primary-300)" />}
                      title={label}
                      meta={change.rationale || eventTitle(impact.event)}
                    >
                      {canEdit && (
                        <span className={styles.actions}>
                          <Button variant="ghost" size="sm" disabled={events.busy === impact.id} onClick={() => events.run(impact, [change], 'dismissed')}>Dismiss</Button>
                          <Button variant="outline" size="sm" disabled={events.busy === impact.id} onClick={() => events.run(impact, [change], 'accepted')}>Accept</Button>
                        </span>
                      )}
                    </PanelSectionItem>
                  );
                }}
              />
            )}
          </DashboardCardBody>
        </DashboardCard>
      )}

      <TasksCard patient={patient} actions={{ addTask: () => setAddTaskOpen(true) }} />
      {addTaskOpen && (
        <AddTaskDrawer initialMember={patientName} onClose={() => setAddTaskOpen(false)} onTaskCreated={() => setAddTaskOpen(false)} />
      )}
    </div>
  );
}

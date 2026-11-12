import { useMemo, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { DashboardCard, DashboardCardBody } from '@/components/DashboardCard/DashboardCard';
import { Button } from '@/components/Button/Button';
import { AddTaskDrawer } from '../../../../../../tasks/AddTaskDrawer';
import { TasksCard } from '../../../overview/cards/TasksCard';
import { carePlanFocusItems } from '../lib/carePlanFocus';
import { computeDueDate } from '../tables/CarePlanInterventionsTable';
import { fmtCarePlanDate } from '../tables/carePlanTableModel';
import { useEventUpdates } from './useEventUpdates';
import { useReviewCadence } from './useReviewCadence';
import { SuggestedActionsCard } from './SuggestedActionsCard';
import { FocusGroups } from './FocusGroups';
import styles from './CarePlanFocusPanel.module.css';

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

  const patient = useMemo(() => ({ id: patientId, memberId: patientId, name: patientName }), [patientId, patientName]);
  const nextReview = review?.status?.state === 'upcoming' && review.due ? fmtCarePlanDate(review.due) : null;

  return (
    <div className={styles.panel}>
      <DashboardCard icon="solar:danger-circle-linear" title="Look at These First" count={focus.length || null}>
        <DashboardCardBody className={styles.listBody}>
          {focus.length === 0 ? (
            <p className={styles.empty}>Nothing needs attention.{nextReview ? ` Next review ${nextReview}.` : ''}</p>
          ) : (
            <FocusGroups
              items={focus}
              onOpen={f => onOpenItem(f.kind, f.item)}
              renderActions={f => (canEdit && (f.kind === 'goal' || f.kind === 'review') && live?.plan?.id ? (
                <Button variant="outline" size="sm" onClick={startReview}>Start Review</Button>
              ) : null)}
            />
          )}
        </DashboardCardBody>
      </DashboardCard>

      <SuggestedActionsCard events={events} canEdit={canEdit} />

      <TasksCard patient={patient} actions={{ addTask: () => setAddTaskOpen(true) }} />
      {addTaskOpen && (
        <AddTaskDrawer initialMember={patientName} onClose={() => setAddTaskOpen(false)} onTaskCreated={() => setAddTaskOpen(false)} />
      )}
    </div>
  );
}

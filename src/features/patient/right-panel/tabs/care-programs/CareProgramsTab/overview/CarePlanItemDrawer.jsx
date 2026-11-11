import { lazy, Suspense } from 'react';

const GoalPreviewDrawer = lazy(() => import('../../care-plan/drawers/GoalPreviewDrawer/GoalPreviewDrawer').then(m => ({ default: m.GoalPreviewDrawer })));
const InterventionPreviewDrawer = lazy(() => import('../../care-plan/drawers/InterventionPreviewDrawer/InterventionPreviewDrawer').then(m => ({ default: m.InterventionPreviewDrawer })));
const BarrierDetailDrawer = lazy(() => import('../../care-plan/drawers/BarrierDetailDrawer/BarrierDetailDrawer').then(m => ({ default: m.BarrierDetailDrawer })));

/**
 * The care plan's own goal / intervention / barrier drawer, opened from the
 * overview so the item can be worked without leaving it. `open` is
 * { kind, item, program }; linked items open in place through `onOpen`.
 */
export function CarePlanItemDrawer({ open, patientId, onOpen, onClose }) {
  if (!open) return null;
  const { kind, item, program } = open;
  const to = next => linked => onOpen({ kind: next, item: linked, program: linked.program || program });
  return (
    <Suspense fallback={null}>
      {kind === 'goal' && (
        <GoalPreviewDrawer goal={item} patientId={patientId} program={program} onClose={onClose} onOpenIntervention={to('intervention')} onOpenBarrier={to('barrier')} />
      )}
      {kind === 'intervention' && (
        <InterventionPreviewDrawer intervention={item} patientId={patientId} program={program} onClose={onClose} onOpenGoal={to('goal')} />
      )}
      {kind === 'barrier' && (
        <BarrierDetailDrawer barrier={item} patientId={patientId} program={program} onClose={onClose} onOpenGoal={to('goal')} />
      )}
    </Suspense>
  );
}

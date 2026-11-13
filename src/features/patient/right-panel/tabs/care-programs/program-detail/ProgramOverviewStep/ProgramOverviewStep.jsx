import { useState } from 'react';
import { DashboardCardSkeleton } from '@/components/DashboardCard/DashboardCard';
import { useCareProgramsOverview } from '../../CareProgramsTab/overview/useCareProgramsOverview';
import { CarePlanSummary, WhyPrioritized } from '../../CareProgramsTab/overview/CareProgramsOverview';
import { NextBestActions } from '../../CareProgramsTab/overview/NextBestActions';
import { ProgramSuggestedActions } from '../../CareProgramsTab/overview/ProgramSuggestedActions';
import { CarePlanItemDrawer } from '../../CareProgramsTab/overview/CarePlanItemDrawer';
import styles from './ProgramOverviewStep.module.css';

// Unity summaries are written for the patient across programs, not per program.
const NO_UNITY = { state: 'off' };
const KIND_LIST = { goal: 'goals', intervention: 'interventions', barrier: 'barriers' };

/**
 * A program's Overview step, first in every program: Why Prioritized, Next
 * Best Actions and Suggested Actions for this program, and its Care Plan
 * summary (goal progress, goals, interventions and barriers, and what needs
 * attention). Built from the same records as the Care Programs overview,
 * scoped to the one program. A step action opens that step here; a care plan
 * item opens in its drawer; the plan opens the Care Plan step.
 */
export function ProgramOverviewStep({ patientId, program, carePlanStepId, onOpenStep, onEnroll }) {
  const data = useCareProgramsOverview(patientId, [program]);
  const [openItem, setOpenItem] = useState(null);
  const openPlan = carePlanStepId ? () => onOpenStep(carePlanStepId) : undefined;

  if (!data.ready) {
    return (
      <div className={styles.wrap}>
        <div className={styles.grid}>
          <div className={styles.main}><DashboardCardSkeleton icon="solar:checklist-minimalistic-linear" title="Next Best Actions" rows={4} /></div>
        </div>
      </div>
    );
  }

  const onRun = (row) => {
    if (row.kind === 'step') onOpenStep(row.refs[0].step.id);
    else if (row.kind === 'plan') openPlan?.();
    else setOpenItem({ kind: row.kind, ...row.ref });
  };
  const openRef = (key) => {
    const action = data.actions.find(a => a.key === key);
    if (action) onRun(action);
  };
  // The drawer reads the item from the live plan so its edits show at once.
  const plan = data.entries[0]?.carePlan;
  const liveItem = openItem && { ...openItem, item: plan?.[KIND_LIST[openItem.kind]]?.find(x => x.id === openItem.item.id) || openItem.item };

  return (
    <div className={styles.wrap}>
      <div className={styles.grid}>
        <div className={styles.main}>
          <WhyPrioritized why={data.why} unity={NO_UNITY} onOpenRef={openRef} />
          <NextBestActions actions={data.actions} programs={[program]} onRun={onRun} />
        </div>
        <div className={styles.side}>
          <ProgramSuggestedActions
            patientId={patientId}
            programs={[program]}
            programCode={program.code}
            onEnroll={onEnroll}
            onOpenStep={(_p, stepId) => onOpenStep(stepId)}
          />
          <CarePlanSummary data={data} onOpenPlan={openPlan} progressLabel="Goal progress on this program's care plan" />
        </div>
        <CarePlanItemDrawer open={liveItem} patientId={patientId} onOpen={setOpenItem} onClose={() => setOpenItem(null)} />
      </div>
    </div>
  );
}

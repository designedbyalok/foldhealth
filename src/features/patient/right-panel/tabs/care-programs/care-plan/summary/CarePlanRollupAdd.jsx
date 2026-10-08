import { useRef, useState } from 'react';
import { MenuPopover } from '../../../../../../../components/MenuPopover/MenuPopover';
import { useAppStore } from '../../../../../../../store/useAppStore';
import { AddGoalsDrawer } from '../../../../../../settings/care-plan-library/goals/AddGoalsDrawer/AddGoalsDrawer';
import { AddBarriersDrawer } from '../../../../../../settings/care-plan-library/barriers/AddBarriersDrawer/AddBarriersDrawer';
import { INTERVENTION_EDITORS } from '../../../../../../settings/care-plan-library/interventions';
import { AddTaskDrawer } from '../../../../../../tasks/AddTaskDrawer';
import { addGoalsFromPicker, addBarriersFromPicker } from '../CarePlanView/carePlanPickerHandlers';
import { buildInterventionRecordFromConfig, CARE_PLAN_INTERVENTION_MENU } from '../lib/carePlanInterventionMenu';

const EMPTY_PLAN = { goals: [], interventions: [], barriers: [] };
const KIND_NOUN = { goal: 'goal', intervention: 'intervention', barrier: 'barrier' };

/**
 * "+ Add" on the patient-level roll-up (care_plan_mode = 'both'). Every item
 * belongs to one program's plan, so the flow always starts by picking that
 * program, with nothing preselected, then opens the same add drawer the
 * program's own Care Plan step uses and saves into that program's plan.
 *
 * `start` is `{ kind: 'goal' | 'intervention' | 'barrier', rect }`.
 */
export function CarePlanRollupAdd({ start, patientId, patientName, programs, onDone }) {
  const patientCarePlans = useAppStore(s => s.patientCarePlans);
  const savePatientCarePlanGoal = useAppStore(s => s.savePatientCarePlanGoal);
  const deletePatientCarePlanGoal = useAppStore(s => s.deletePatientCarePlanGoal);
  const savePatientCarePlanBarrier = useAppStore(s => s.savePatientCarePlanBarrier);
  const savePatientCarePlanIntervention = useAppStore(s => s.savePatientCarePlanIntervention);
  const refreshCarePlanDuplicates = useAppStore(s => s.refreshCarePlanDuplicates);
  const showToast = useAppStore(s => s.showToast);

  const [program, setProgram] = useState(null);
  const [intvKind, setIntvKind] = useState(null);
  // MenuPopover closes itself after a pick; only a close without one (Escape,
  // outside click) ends the flow.
  const pickedRef = useRef(false);
  const closeMenu = () => { if (pickedRef.current) pickedRef.current = false; else onDone(); };
  const plan = (program && patientCarePlans[`${patientId}::${program.id}`]) || EMPTY_PLAN;
  const data = { goals: plan.goals || [], interventions: plan.interventions || [], barriers: plan.barriers || [] };

  if (!program) {
    return (
      <MenuPopover
        anchorRect={start.rect}
        align="left"
        width={300}
        ariaLabel={`Add ${KIND_NOUN[start.kind]} to which program`}
        items={[
          { section: `Add ${KIND_NOUN[start.kind]} to` },
          // A closed program's plan takes no new items.
          ...programs.filter(p => p.status !== 'Closed').map(p => ({ key: p.id, label: p.name || p.code })),
        ]}
        onSelect={(id) => { pickedRef.current = true; setProgram(programs.find(p => p.id === id) || null); }}
        onClose={closeMenu}
      />
    );
  }

  if (start.kind === 'goal') {
    return (
      <AddGoalsDrawer
        onClose={onDone}
        existingGoalTitles={data.goals.map(g => g.title)}
        onAdd={async (picked, removed = []) => {
          onDone();
          await addGoalsFromPicker({
            picked, removed, data, patientId, program,
            savePatientCarePlanGoal, deletePatientCarePlanGoal,
            savePatientCarePlanBarrier, savePatientCarePlanIntervention,
            refreshCarePlanDuplicates, showToast,
          });
        }}
      />
    );
  }

  if (start.kind === 'barrier') {
    return (
      <AddBarriersDrawer
        onClose={onDone}
        existingBarriers={data.barriers}
        onAdd={async (picked, opts = {}) => {
          onDone();
          await addBarriersFromPicker({
            picked, opts, linkGoalId: null, data, patientId, program,
            savePatientCarePlanBarrier, refreshCarePlanDuplicates, showToast,
          });
        }}
      />
    );
  }

  // Interventions: program, then type, then that type's editor.
  if (!intvKind) {
    return (
      <MenuPopover
        anchorRect={start.rect}
        align="left"
        width={200}
        ariaLabel="Add intervention"
        items={CARE_PLAN_INTERVENTION_MENU}
        onSelect={(k) => { pickedRef.current = true; setIntvKind(k); }}
        onClose={closeMenu}
      />
    );
  }

  const save = async (config) => {
    const record = buildInterventionRecordFromConfig(intvKind, config);
    const saved = await savePatientCarePlanIntervention(patientId, program, record);
    if (saved) {
      showToast(`"${saved.title}" added to ${program.name || program.code}`);
      refreshCarePlanDuplicates(patientId, program);
    }
  };

  if (intvKind === 'patient-task' || intvKind === 'internal-task') {
    return (
      <AddTaskDrawer
        taskKind={intvKind}
        initialMember={patientName}
        initialAssignedTo={intvKind === 'internal-task' ? '' : patientName}
        showScheduleFields
        libraryKind={intvKind}
        availableGoals={data.goals}
        onClose={onDone}
        onTaskCreated={async (t) => {
          onDone();
          await save({ title: t?.name || '', taskId: t?.id });
        }}
      />
    );
  }

  const Editor = INTERVENTION_EDITORS[intvKind];
  if (!Editor) return null;
  return (
    <Editor
      kind={intvKind}
      intervention={null}
      showLibrary
      linkToGoalsAllowed
      availableGoals={data.goals}
      linkedGoalIds={[]}
      memberName={patientName}
      onClose={onDone}
      onSave={async (config) => { onDone(); await save(config); }}
    />
  );
}

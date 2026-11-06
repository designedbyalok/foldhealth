import { useEffect, useMemo } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import {
  ASSESSMENT_STEPS, flatSteps, stepsFor, withoutCarePlanStep,
} from '../../patient/right-panel/tabs/care-programs/program-detail/ProgramDetailView/ProgramDetailView.utils';
import { deriveStepStatus, programProgressOf } from '../../patient/right-panel/tabs/care-programs/program-detail/ProgramDetailView/stepStatus';
import { showsProgramCarePlan } from '../../patient/right-panel/tabs/care-programs/care-plan/lib/carePlanMode';

const EMPTY = [];
const EMPTY_MAP = {};

/**
 * A program's steps with each one's real status for this patient, the same
 * way the desktop program view works them out (useProgramDetailView):
 * records first (signed plan, tasks, documents, med rec, appointments), else
 * a Reviewed / Skip someone set on the step.
 */
export function useProgramSteps(patientId, program) {
  const carePlanMode = useAppStore(s => s.carePlanMode);
  const programTypes = useAppStore(s => s.careProgramTypes);
  const fetchCareProgramTypes = useAppStore(s => s.fetchCareProgramTypes);
  const carePlan = useAppStore(s => (patientId && program?.id ? s.patientCarePlans[`${patientId}::${program.id}`] : null));
  const fetchPatientCarePlan = useAppStore(s => s.fetchPatientCarePlan);
  const documents = useAppStore(s => s.programDocuments) || EMPTY;
  const fetchProgramDocuments = useAppStore(s => s.fetchProgramDocuments);
  const appointments = useAppStore(s => s.appointments) || EMPTY;
  const fetchAppointments = useAppStore(s => s.fetchAppointments);
  const tasks = useAppStore(s => s.tasks) || EMPTY;
  const fetchTasks = useAppStore(s => s.fetchTasks);
  const manual = useAppStore(s => (program?.id ? s.programStepStatus[program.id] : null)) || EMPTY_MAP;
  const fetchProgramStepStatus = useAppStore(s => s.fetchProgramStepStatus);
  const patientRow = useAppStore(s => (s.allPatients || []).find(p => String(p.id) === String(patientId)));

  useEffect(() => {
    fetchCareProgramTypes?.();
    fetchProgramDocuments?.();
    fetchAppointments?.();
    fetchTasks?.();
  }, [fetchCareProgramTypes, fetchProgramDocuments, fetchAppointments, fetchTasks]);
  useEffect(() => {
    if (!program?.id) return;
    if (patientId) fetchPatientCarePlan?.(patientId, program.id);
    fetchProgramStepStatus?.(program.id);
  }, [patientId, program?.id, fetchPatientCarePlan, fetchProgramStepStatus]);

  const programCarePlan = showsProgramCarePlan(carePlanMode);
  const ctx = useMemo(() => {
    const ids = new Set([patientId, patientRow?.memberId].filter(Boolean).map(String));
    return {
      manual,
      carePlan,
      program,
      tasks: tasks.filter(t => !t.is_subtask && t.program_code === program?.code && ids.has(String(t.patient_id))),
      documents: documents.filter(d => d.programCode === program?.code && ids.has(String(d.patientId))),
      appointments: appointments.filter(a => ids.has(String(a.patient_id))),
    };
  }, [patientId, patientRow, manual, carePlan, program, tasks, documents, appointments]);

  const stepList = useMemo(() => {
    if (!program?.code) return EMPTY;
    const base = programCarePlan ? stepsFor(program.code) : withoutCarePlanStep(stepsFor(program.code));
    return (base || []).map(step => (step.type === 'section'
      ? { ...step, children: (step.children || []).map(c => ({ ...c, ...deriveStepStatus(c, ctx) })) }
      : { ...step, ...deriveStepStatus(step, ctx) }));
    // careProgramTypes changes the configured steps behind stepsFor.
  }, [program?.code, programCarePlan, ctx, programTypes]); // eslint-disable-line react-hooks/exhaustive-deps

  const flat = useMemo(() => flatSteps(stepList), [stepList]);
  return { stepList, flat, progress: programProgressOf(flat), done: flat.filter(s => s.status === 'completed' || s.status === 'skipped').length };
}

/** Assessment-form steps open a form screen that is desktop only. */
export const isAssessmentStep = (step) => !!(step?.formId || ASSESSMENT_STEPS[step?.screen || step?.name]);

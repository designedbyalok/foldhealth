import { useEffect, useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { resolvePatientStoreId } from '@/lib/resolvePatientStoreId';
import { flatSteps, stepsFor, withoutCarePlanStep } from '../../program-detail/ProgramDetailView/ProgramDetailView.utils';
import { deriveStepStatus, stepContextFor } from '../../program-detail/ProgramDetailView/stepStatus';
import { showsProgramCarePlan } from '../../care-plan/lib/carePlanMode';
import { findPatientRecord } from '../../care-plan/lib/carePlanPrintSettings';
import { carePlanFocusItems } from '../../care-plan/lib/carePlanFocus';
import { computeDueDate } from '../../care-plan/tables/CarePlanInterventionsTable';
import { evaluateReading } from '../../care-plan/lib/goalReadings';
import { clinicalSummary, combinedPlanTotals, nextBestActions, programProgress, whyPrioritized } from './careProgramsOverviewModel';

const EMPTY = [];
const dueOf = i => computeDueDate(i);

/**
 * Everything the Care Programs overview shows, for the active programs: each
 * program's steps and progress, Next Best Actions, Why Prioritized, the
 * combined care plan totals, the clinical summary, active problems and the
 * activity log.
 *
 * Loads through the same cached fetches the program view uses (step status
 * and care plan per program, tasks, documents, appointments, problems,
 * program activity), once each, and reports `ready` once the per-program
 * ones are in so nothing jumps.
 */
export function useCareProgramsOverview(patientId, programs) {
  const programCarePlan = showsProgramCarePlan(useAppStore(s => s.carePlanMode));
  const carePlans = useAppStore(s => s.patientCarePlans);
  const carePlanLoaded = useAppStore(s => s.patientCarePlanLoadedFor);
  const stepStatus = useAppStore(s => s.programStepStatus);
  const tasks = useAppStore(s => s.tasks) || EMPTY;
  const documents = useAppStore(s => s.programDocuments) || EMPTY;
  const appointments = useAppStore(s => s.appointments) || EMPTY;
  const medications = useAppStore(s => s.patientMedications[patientId]) || EMPTY;
  // Strings, not the record: a new object per read would re-render forever.
  const recordId = useAppStore(s => String(findPatientRecord(s, patientId)?.id || ''));
  const recordMemberId = useAppStore(s => String(findPatientRecord(s, patientId)?.memberId || ''));
  const acuity = useAppStore(s => String(findPatientRecord(s, patientId)?.acuity || ''));
  const firstName = useAppStore(s => String(findPatientRecord(s, patientId)?.name || '').split(/\s+/)[0]);
  const problems = useAppStore(s => s.patientProblems[patientId]) || EMPTY;
  const problemsLoaded = useAppStore(s => !!s.patientProblemsLoadedFor[patientId]);
  const activityId = useAppStore(s => resolvePatientStoreId(s, patientId));
  const activity = useAppStore(s => s.patientProgramActivity[activityId]) || EMPTY;
  const store = useAppStore.getState;

  const programIds = programs.map(p => p.id).join('|');
  useEffect(() => {
    const s = store();
    s.fetchProgramDocuments?.();
    s.fetchAppointments?.();
    s.fetchTasks?.();
    s.fetchPatientMedications?.(patientId);
    s.fetchPatientProgramActivity?.(patientId);
    if (patientId && !s.patientProblemsLoadedFor[patientId]) s.fetchPatientProblems?.(patientId);
    for (const p of programs) {
      s.fetchProgramStepStatus?.(p.id);
      if (programCarePlan) s.fetchPatientCarePlan?.(patientId, p.id);
    }
    // programIds stands in for programs: refetch only when the set changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, programIds, programCarePlan]);

  const ready = programs.every(p => stepStatus[p.id] && (!programCarePlan || carePlanLoaded[`${patientId}::${p.id}`]));

  const entries = useMemo(() => {
    if (!ready) return EMPTY;
    const patientIds = [patientId, recordId, recordMemberId];
    return programs.map(program => {
      const carePlan = carePlans[`${patientId}::${program.id}`] || null;
      const ctx = {
        ...stepContextFor({ patientIds, program, carePlan, manual: stepStatus[program.id], tasks, documents, appointments, medications }),
        dueOf,
      };
      const list = programCarePlan ? stepsFor(program.code) : withoutCarePlanStep(stepsFor(program.code));
      const steps = flatSteps(list).map(s => ({ ...s, ...deriveStepStatus(s, ctx) }));
      const attention = carePlan ? carePlanFocusItems({
        goals: carePlan.goals, interventions: carePlan.interventions, barriers: carePlan.barriers,
        measurements: carePlan.measurements || EMPTY, dueOf,
      }) : EMPTY;
      return { program, steps, ctx, carePlan, attention };
    });
  }, [ready, programs, patientId, recordId, recordMemberId, carePlans, stepStatus, tasks, documents, appointments, medications, programCarePlan]);

  return useMemo(() => {
    const actions = nextBestActions(entries);
    const progress = entries.map(programProgress);
    const totals = combinedPlanTotals(entries);
    return {
      ready,
      entries,
      progress,
      actions,
      why: whyPrioritized(actions, { acuity, totals, progress, firstName }),
      totals,
      clinical: clinicalSummary(entries, { problems, acuity, firstName, evaluate: evaluateReading }),
      problems,
      problemsLoaded,
      activity,
      firstName,
      acuity,
    };
  }, [ready, entries, acuity, firstName, problems, problemsLoaded, activity]);
}

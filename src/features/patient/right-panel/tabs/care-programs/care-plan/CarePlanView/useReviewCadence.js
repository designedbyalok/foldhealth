import { useEffect, useMemo } from 'react';
import { useAppStore } from '../../../../../../../store/useAppStore';
import { resolvePatientStoreId } from '../../../../../../../lib/resolvePatientStoreId';
import { nextReviewDue, resolveCadence, reviewStatus, withCadenceDefaults } from '../lib/cadence';

const EMPTY = [];

/**
 * The cadence in force for one patient's plan on one program, the next
 * review date and whether it's due or overdue (care-plan/lib/cadence.js).
 */
export function useReviewCadence({ patientId, program, plan }) {
  const storeId = useAppStore(s => String(resolvePatientStoreId(s, patientId)));
  const types = useAppStore(s => s.careProgramTypes);
  const enrollment = useAppStore(s => (s.careProgramsByPatient[storeId] || s.careProgramsByPatient[patientId] || EMPTY)
    .find(p => p.id === program?.id)) || program;
  const discharges = useAppStore(s => s.patientDischarges[patientId]) || EMPTY;
  const history = useAppStore(s => s.carePlanReviews[`${patientId}::${program?.id}`]?.history) || EMPTY;
  const fetchTypes = useAppStore(s => s.fetchCareProgramTypes);
  const fetchDischarges = useAppStore(s => s.fetchPatientDischarges);
  const fetchReviews = useAppStore(s => s.fetchCarePlanReviews);

  useEffect(() => { if (!types.length) fetchTypes?.(); }, [types.length, fetchTypes]);
  useEffect(() => {
    if (!patientId || !program?.id) return;
    fetchDischarges(patientId);
    fetchReviews(patientId, program.id);
  }, [patientId, program?.id, fetchDischarges, fetchReviews]);

  return useMemo(() => {
    if (!enrollment?.code) return null;
    const type = types.find(t => t.code === enrollment.code);
    const config = withCadenceDefaults(enrollment.code, type?.cadence);
    const override = enrollment.cadenceOverride || null;
    const today = new Date();
    const cadence = resolveCadence({ config, acuity: enrollment.acuity, override, discharges, today });
    const base = resolveCadence({ config, acuity: enrollment.acuity, discharges: [], today });
    const lastReview = history[0]?.finishedAt || null;
    const lastTouch = lastReview || plan?.signedAt || null;
    const due = nextReviewDue({ cadence, lastTouch });
    return {
      config, cadence, base, override, due, lastReview,
      status: reviewStatus({ due, overdueAfterDays: config.overdueAfterDays, today }),
      enrollment,
    };
  }, [enrollment, types, discharges, history, plan?.signedAt]);
}


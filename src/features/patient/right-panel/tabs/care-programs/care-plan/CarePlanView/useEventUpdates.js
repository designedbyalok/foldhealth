import { useEffect, useState } from 'react';
import { useAppStore } from '../../../../../../../store/useAppStore';

/**
 * New patient events that touch this care plan (#84) and the changes
 * proposed for each, still to be decided. `visible` is false once nothing is
 * left (or the tables don't exist yet). `run` accepts or dismisses changes.
 * `fetch: false` only reads what another caller on the plan has loaded.
 */
export function useEventUpdates({ patientId, program, live, fetch = true }) {
  const key = `${patientId}::${program?.id}`;
  const state = useAppStore(s => s.carePlanEventUpdates[key]);
  const fetchUpdates = useAppStore(s => s.fetchCarePlanEventUpdates);
  const decide = useAppStore(s => s.decideCarePlanEventChange);
  const dismissImpactInStore = useAppStore(s => s.dismissCarePlanEventImpact);
  const [busy, setBusy] = useState(null);
  const loaded = !!live?.plan;

  // Once per plan visit: evaluates whatever arrived since the last one.
  useEffect(() => {
    if (fetch && loaded && patientId && program?.id) fetchUpdates(patientId, program, live);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetch, loaded, patientId, program?.id]);

  const pending = (state?.impacts || [])
    .filter(i => i.status === 'pending' && state.events?.[i.eventId])
    .map(i => ({ ...i, event: state.events[i.eventId], open: i.changes.filter(c => !c.decision) }))
    .filter(i => i.open.length || (i.aiError && !i.changes.length))
    .sort((a, b) => new Date(b.event.occurredAt) - new Date(a.event.occurredAt));

  const run = async (impact, changes, decision) => {
    setBusy(impact.id);
    try {
      // One at a time: each decision rewrites the impact's whole changes list,
      // so parallel calls would overwrite each other's decisions.
      for (const c of changes) {
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        await decide(patientId, program, impact.id, c.id, decision);
      }
    } finally { setBusy(null); }
  };

  return {
    pending,
    count: pending.reduce((n, i) => n + i.open.length, 0),
    evaluating: !!state?.evaluating,
    // The first load has finished (whether or not anything is pending).
    loaded: !!state && !state.loading,
    visible: !state?.missing && (pending.length > 0 || !!state?.evaluating),
    // The event tables aren't there (patient_event_stream_migration.sql not run).
    missing: !!state?.missing,
    busy,
    run,
    dismissImpact: impact => dismissImpactInStore(patientId, program, impact.id),
  };
}

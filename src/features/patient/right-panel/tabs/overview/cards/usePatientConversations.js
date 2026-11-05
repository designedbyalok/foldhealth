import { useEffect, useState } from 'react';
import { listPatientConversations } from '../../../../../messages/comms/commsRepo';

// Awaiting Reply and Needs Attention both read the patient's threads. One
// read serves both, and a remount within a minute reuses it rather than
// querying again.
const TTL = 60 * 1000;
const cache = new Map(); // key → { at, promise }

function load(patientId, patientName) {
  const key = `${patientId ?? ''}|${patientName ?? ''}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.promise;
  const promise = listPatientConversations({ patientId, patientName }).catch(() => []);
  cache.set(key, { at: Date.now(), promise });
  return promise;
}

/** The patient's conversation threads; null while loading. */
export function usePatientConversations(patient) {
  const patientId = patient?.id;
  const patientName = patient?.name;
  const [state, setState] = useState({ key: null, list: null });
  const key = `${patientId ?? ''}|${patientName ?? ''}`;

  useEffect(() => {
    let alive = true;
    load(patientId, patientName).then(list => { if (alive) setState({ key, list }); });
    return () => { alive = false; };
  }, [patientId, patientName, key]);

  return state.key === key ? state.list : null;
}

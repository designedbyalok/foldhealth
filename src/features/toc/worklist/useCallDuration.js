import { useAppStore } from '../../../store/useAppStore';
import { formatDuration } from '../../../store/lib/taskDateUtils';

// Call clocks tick in `activeCallSeconds` (the user's call) and
// `agentCallSeconds` (agent calls) only, so a tick re-renders the rows on a
// call instead of every table reading `patients`.
export function useCallDuration(patient) {
  return useAppStore(s => {
    if (s.activeCallPatient === patient.id) return formatDuration(s.activeCallSeconds);
    const agentSecs = s.agentCallSeconds[patient.id];
    return agentSecs != null ? formatDuration(agentSecs) : patient.callDuration;
  });
}

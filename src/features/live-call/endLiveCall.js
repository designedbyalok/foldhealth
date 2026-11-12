import { useAppStore } from '../../store/useAppStore';
import { useLiveCall } from './useLiveCall';

/**
 * Hang up and open Wrap Up Call. The session (transcript, item decisions)
 * stays for the wrap-up; a call ended from the card before the overlay was
 * ever opened loads the patient's script first, so the wrap-up still knows
 * the reason and the items.
 */
export async function endLiveCall(patient) {
  const live = useLiveCall.getState();
  if (live.mode === 'visit') {
    live.startWrap(live.visitSeconds);
    return;
  }
  const { activeCallSeconds, endActiveCall } = useAppStore.getState();
  endActiveCall();
  if (patient) await useLiveCall.getState().prepare(patient);
  useLiveCall.getState().startWrap(activeCallSeconds);
}

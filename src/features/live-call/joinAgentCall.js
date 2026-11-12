import { useAppStore } from '../../store/useAppStore';
import { expandLiveCall } from './liveCallMorph';

/** The call card / overlay's view of a TOC patient record. */
export function livePatientOf(p) {
  return {
    id: p.id,
    memberId: p.memberId || p.id,
    name: p.name,
    initials: p.initials,
    relayNote: p.relayNote,
    admitReason: p.admitReason,
    agent: p.relayBy || p.agentAssigned,
    tags: p.tocType ? [`TOC ${p.tocType}`] : [],
  };
}

// Long enough for the call card to finish sliding in, so the morph starts
// from the card at rest.
const CARD_SETTLE_MS = 320;

/** Take over an agent's live call: the call starts and opens full screen. */
export function joinAgentCall(p) {
  const s = useAppStore.getState();
  s.closeLiveDrawer?.();
  if (String(s.activeCallPatient ?? '') !== String(p.id)) s.startActiveCall(p.id);
  setTimeout(() => expandLiveCall(livePatientOf(p)), CARD_SETTLE_MS);
}

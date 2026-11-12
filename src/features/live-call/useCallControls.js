import { useAppStore } from '../../store/useAppStore';
import { useLiveCall } from './useLiveCall';

/**
 * The in-call controls, shared by the floating call card and the live call
 * overlay so both show the same buttons, in the same order, with the same
 * state. `key` is also the element's morph name (data-lc), so each control
 * travels between the card and the overlay header.
 */
export function useCallControls() {
  const muted = useLiveCall(s => s.muted);
  const held = useLiveCall(s => s.held);
  const toggleMute = useLiveCall(s => s.toggleMute);
  const toggleHold = useLiveCall(s => s.toggleHold);
  const showToast = useAppStore(s => s.showToast);

  return [
    { key: 'mute', label: muted ? 'Unmute' : 'Mute', icon: 'solar:microphone-linear', active: muted, onClick: toggleMute },
    { key: 'hold', label: held ? 'Resume' : 'Hold', icon: held ? 'solar:play-linear' : 'solar:pause-linear', active: held, onClick: () => { toggleHold(); showToast(held ? 'Call resumed' : 'Call on hold · transcript paused'); } },
    { key: 'transfer', label: 'Transfer', icon: 'solar:phone-calling-rounded-linear', onClick: () => showToast('Transfer to: PCP, Pharmacy, Specialist') },
    { key: 'add', label: 'Add participant', icon: 'solar:user-plus-linear', onClick: () => showToast('Add a family member, interpreter or provider to the call') },
    { key: 'keypad', label: 'Keypad', icon: 'tabler:dialpad', onClick: () => showToast('Keypad opens for phone menus') },
    { key: 'more', label: 'More call actions', icon: 'solar:menu-dots-linear', onClick: () => showToast('More: record a voicemail, send a link, schedule a callback') },
  ];
}

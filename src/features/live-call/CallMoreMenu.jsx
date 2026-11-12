import { MenuPopover } from '../../components/MenuPopover/MenuPopover';
import { useAppStore } from '../../store/useAppStore';
import { useLiveCall } from './useLiveCall';

const ITEMS = [
  { key: 'video', label: 'Send Video Link', icon: 'solar:videocamera-record-linear' },
  { key: 'callback', label: 'Schedule a Callback', icon: 'solar:calendar-add-linear' },
  { divider: true },
  { key: 'drop', label: 'Simulate Dropped Call (Demo)', icon: 'solar:phone-calling-rounded-linear' },
];

/** The call's More menu, shared by the card and the full-screen header (one anchor at a time). */
export function CallMoreMenu() {
  const moreRect = useLiveCall(s => s.moreRect);
  const closeMore = useLiveCall(s => s.closeMore);
  const drop = useLiveCall(s => s.drop);
  const showToast = useAppStore(s => s.showToast);
  if (!moreRect) return null;
  const onSelect = (key) => {
    closeMore();
    if (key === 'drop') drop(useAppStore.getState().activeCallSeconds);
    if (key === 'video') showToast('Video link sent by SMS · the call switches to video when they join');
    if (key === 'callback') showToast('Callback request added to Tasks');
  };
  return <MenuPopover anchorRect={moreRect} items={ITEMS} width={240} align="right" ariaLabel="More call actions" onSelect={onSelect} onClose={closeMore} />;
}

import { toast } from '../../components/Toast/sonnerToast';
import { useAppStore } from '../../store/useAppStore';
import { findOrCreateConversation } from '../messages/comms/commsRepo';
import { callFromPhone } from './calls/callLog';
import { useMobileNav } from './MobileNavContext';

/**
 * Call / Chat / SMS / Email tiles for a patient (Figma 759:19906). `more`
 * adds a fifth tile. Chat is off until the patient has the app, as in Figma.
 */
export function useContactActions(contact, { more } = {}) {
  const { push } = useMobileNav();
  const me = useAppStore(s => s.currentUserProfile);
  const phone = contact?.phone || null;
  const email = contact?.email || null;

  const openThread = async (channel) => {
    try {
      const extra = channel === 'chat' ? { group_name: `Care for ${contact.name}` } : {};
      const conversation = await findOrCreateConversation(channel, contact, extra);
      push('thread', { conversation });
    } catch {
      toast.error(`Could not open the ${channel === 'sms' ? 'SMS' : 'chat'} thread.`);
    }
  };

  const callPhone = () => callFromPhone({ number: phone, patient: contact, sender: me });

  const actions = [
    { key: 'call', label: 'Call', icon: 'solar:phone-linear', onClick: callPhone, disabled: !phone },
    { key: 'chat', label: 'Chat', icon: 'solar:chat-round-linear', onClick: () => openThread('chat'), disabled: !contact?.patientAppActive },
    { key: 'sms', label: 'SMS', icon: 'solar:chat-square-linear', onClick: () => openThread('sms'), disabled: !phone },
    { key: 'email', label: 'Email', icon: 'solar:letter-linear', onClick: () => { window.location.href = `mailto:${email}`; }, disabled: !email },
  ];
  if (more) actions.push({ key: 'more', label: 'More', icon: 'solar:menu-dots-linear', ...more });
  return { actions, callPhone, phone };
}

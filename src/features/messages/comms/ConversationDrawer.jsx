import { Drawer } from '../../../components/Drawer/Drawer';
import { useAppStore } from '../../../store/useAppStore';
import { CommsThread } from './CommsThread';
import { PatientEmailThread } from './PatientEmailThread';
import { useCommsPeople } from './useCommsPeople';
import { patientFor } from './commsUtils';
import styles from './Comms.module.css';

const TITLES = { sms: 'View SMS', chat: 'View Chat', email: 'View Email', call: 'View Call' };

/**
 * One conversation opened over the current page (Figma 3540:65953), so a
 * patient's thread can be read and answered without leaving their profile.
 * The thread is the same one the Comms page shows. `focusMessageId` is the
 * message the user came from: it is highlighted and scrolled into view.
 */
export function ConversationDrawer({ conversation, focusMessageId, onClose }) {
  const { patients, me } = useCommsPeople();
  const openCommsDrawer = useAppStore(s => s.openCommsDrawer);
  const patient = patientFor(conversation, patients);
  return (
    <Drawer title={TITLES[conversation.channel] || 'View Conversation'} onClose={onClose} bodyClassName={styles.drawerBody}>
      {conversation.channel === 'email' ? (
        <PatientEmailThread
          key={conversation.id}
          conversation={conversation}
          patient={patient}
          me={me}
          onCompose={initial => openCommsDrawer('email', { initial })}
        />
      ) : (
        <CommsThread key={conversation.id} conversation={conversation} patient={patient} me={me} focusMessageId={focusMessageId} showIntro={false} />
      )}
    </Drawer>
  );
}

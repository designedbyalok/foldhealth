import { useState } from 'react';
import { useAppStore } from '../../../../../../store/useAppStore';
import { membersForConversation, threadTitle } from '../../../../../messages/comms/smsMembers';
import { ConversationDrawer } from '../../../../../messages/comms/ConversationDrawer';
import { Icon } from '../../../../../../components/Icon/Icon';
import { SmsIcon } from '../../../../../../components/Icon/SmsIcon';
import { MissedCallIcon } from '../../../../../../components/Icon/MissedCallIcon';
import { Avatar } from '../../../../../../components/Avatar/Avatar';
import { Badge } from '../../../../../../components/Badge/Badge';
import { useCommsConversations } from '../../../../../messages/comms/useComms';
import { CommsListEmpty } from '../../../../../messages/comms/CommsEmptyState';
import { isMissedCall } from '../../../../../messages/comms/commsUtils';
import { formatTime } from '../../../../../messages/messageUtils';
import { CardSkeleton } from '../../../../../../components/CardSkeleton/CardSkeleton';
import { EmptyState } from '../../../../../../components/EmptyState/EmptyState';
import { Button } from '../../../../../../components/Button/Button';
import msgStyles from '../../../../../messages/MessagesView.module.css';
import styles from './CommsTab.module.css';

function ConvAvatar({ conversation }) {
  const missed = isMissedCall(conversation);
  const icon =
    missed ? <MissedCallIcon size={20} color="var(--status-error)" /> :
    conversation.channel === 'sms' ? <SmsIcon size={20} color="var(--primary-300)" /> :
    conversation.channel === 'call' ? <Icon name="solar:phone-calling-linear" size={20} color="var(--primary-300)" /> :
    conversation.channel === 'email' ? <Icon name="solar:letter-linear" size={20} color="var(--primary-300)" /> :
    <Icon name="solar:users-group-rounded-linear" size={20} color="var(--primary-300)" />;

  return (
    <Avatar
      variant="generic"
      size="36px"
      backgroundColor={missed ? 'var(--status-error-light)' : 'var(--primary-50)'}
      borderColor={missed ? 'color-mix(in srgb, var(--status-error) 30%, transparent)' : 'var(--primary-200)'}
      icon={icon}
    />
  );
}

/**
 * The patient's conversations on every channel (Comms), newest first.
 * Opening one shows it in a drawer, over the profile.
 */
export function CommsTab({ patient }) {
  const { conversations, loading, failed, retry } = useCommsConversations();
  const [openId, setOpenId] = useState(null);

  const id = patient?.id != null ? String(patient.id) : null;
  // A shared number's SMS thread belongs to every member on it (FCS-5677),
  // so it shows on each of their profiles, not just the owner's.
  const patients = useAppStore(st => st.allPatients);
  const mine = conversations.filter(c => (id && c.patient_id === id)
    || (!c.patient_id && patient?.name && c.patient_name === patient.name)
    || (id && c.channel === 'sms' && membersForConversation(c, patients || []).some(m => m.id === id)));

  if (loading) return <CardSkeleton count={4} />;
  // Didn't load (no answer in time, or an error): say so, with a way to retry.
  if (failed) {
    return (
      <div className={styles.state}>
        <EmptyState icon="solar:chat-round-dots-linear" title="Conversations failed to load">
          <Button variant="outline" size="sm" onClick={retry}>Try again</Button>
        </EmptyState>
      </div>
    );
  }
  if (mine.length === 0) return <CommsListEmpty viewKey="all" />;
  const open = mine.find(c => c.id === openId) || null;

  return (
    <div className={msgStyles.convList}>
      {mine.map(c => (
        <button
          type="button"
          key={c.id}
          className={msgStyles.convItem}
          onClick={() => setOpenId(c.id)}
        >
          <ConvAvatar conversation={c} />
          <div className={msgStyles.convInfo}>
            <div className={msgStyles.convNameRow}>
              <div className={[msgStyles.convName, c.unread_count ? '' : styles.readName].join(' ')}>
                {c.channel === 'chat' ? (c.group_name || `Care for ${c.patient_name}`) : c.channel === 'email' ? (c.subject || 'Email') : c.channel === 'sms' ? threadTitle(c, membersForConversation(c, patients || [])) : c.patient_name}
              </div>
              <div className={msgStyles.convTime}>{formatTime(c.last_message_at)}</div>
            </div>
            <div className={msgStyles.convPreviewRow}>
              <div className={msgStyles.convPreview}>{c.last_preview || 'No messages yet'}</div>
              {c.unread_count > 0 && <Badge tone="secondary" variant="solid" label={c.unread_count} />}
            </div>
          </div>
        </button>
      ))}
      {open && <ConversationDrawer conversation={open} onClose={() => setOpenId(null)} />}
    </div>
  );
}

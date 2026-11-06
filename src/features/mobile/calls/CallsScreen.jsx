import { useMemo, useState } from 'react';
import { Avatar } from '../../../components/Avatar/Avatar';
import { BottomSheet, BottomSheetItem } from '../../../components/BottomSheet/BottomSheet';
import { Button } from '../../../components/Button/Button';
import { Icon } from '../../../components/Icon/Icon';
import { SegmentedControl } from '../../../components/SegmentedControl/SegmentedControl';
import { SwipeActions } from '../../../components/SwipeActions/SwipeActions';
import { useCommsConversations, useCommsMessagesFor } from '../../messages/comms/useComms';
import { useCommsPeople } from '../../messages/comms/useCommsPeople';
import { formatPhone, isDialable, patientFor } from '../../messages/comms/commsUtils';
import { MobileRootHeader } from '../MobileHeader';
import { MobileEmpty, MobileListSkeleton, CountBadge } from '../MobileParts';
import { useMobileNav } from '../MobileNavContext';
import { useContactActions } from '../useContactActions';
import { listStamp } from '../mobileFormat';
import { callRow } from './callLog';
import styles from '../mobile.module.css';

/**
 * One call in the log. Swipe right to call back, swipe left for Chat / Task /
 * More (Figma 759:18999 / 759:19010); tap for the caller's details.
 */
function CallRow({ message, conversation, look, patients }) {
  const { push, openMember } = useMobileNav();
  const [moreOpen, setMoreOpen] = useState(false);
  const patient = patientFor(conversation, patients);
  const contact = patient || {
    id: conversation.patient_id, name: conversation.patient_name,
    phone: conversation.patient_phone, email: conversation.patient_email,
  };
  const { callPhone, openThread, sendEmail, phone, email } = useContactActions(contact);
  const name = conversation.patient_name || formatPhone(conversation.patient_phone) || 'Unknown caller';
  const sheet = (fn) => () => { setMoreOpen(false); fn(); };

  return (
    <>
      <SwipeActions
        leading={{ key: 'call', label: 'Call', icon: 'solar:phone-linear', onAction: callPhone, disabled: !isDialable(phone || '') }}
        trailing={[
          { key: 'chat', label: 'Chat', icon: 'solar:chat-round-linear', onAction: () => openThread(patient?.patientAppActive ? 'chat' : 'sms'), disabled: !patient?.patientAppActive && !phone },
          { key: 'task', label: 'Task', icon: 'solar:checklist-minimalistic-linear', onAction: () => push('addTask', { patientId: patient?.id, patientName: patient?.name }), disabled: !patient },
          { key: 'more', label: 'More', icon: 'solar:menu-dots-linear', onAction: () => setMoreOpen(true) },
        ]}
      >
        <button type="button" className={styles.card} onClick={() => push('callDetail', { conversation })}>
          <Avatar type="icon" variant={look.variant} iconName={look.icon} size="XL" />
          <span className={styles.cardText}>
            <span className={[styles.primaryText, look.variant === 'error' ? styles.danger : ''].join(' ')}>{name}</span>
            <span className={styles.secondaryText}>{look.label}</span>
          </span>
          <span className={styles.cardEndRow}>
            <span className={styles.metaText}>{listStamp(message.created_at)}</span>
            <Icon name="solar:info-circle-linear" size={20} />
          </span>
        </button>
      </SwipeActions>
      {moreOpen && (
        <BottomSheet title={name} onClose={() => setMoreOpen(false)}>
          <BottomSheetItem icon="solar:phone-linear" label="Call" onClick={sheet(callPhone)} disabled={!isDialable(phone || '')} />
          <BottomSheetItem icon="solar:chat-square-linear" label="Send SMS" onClick={sheet(() => openThread('sms'))} disabled={!phone} />
          <BottomSheetItem icon="solar:letter-linear" label="Send email" onClick={sheet(sendEmail)} disabled={!email} />
          <BottomSheetItem icon="solar:user-linear" label="View profile" onClick={sheet(() => openMember({ id: patient?.id }))} disabled={!patient} />
          <BottomSheetItem icon="solar:info-circle-linear" label="Call details" onClick={sheet(() => push('callDetail', { conversation }))} />
        </BottomSheet>
      )}
    </>
  );
}

/** Call log, one card per call, newest first (Figma 759:18970 / 759:19718). */
export function CallsScreen() {
  const { push } = useMobileNav();
  const { line, patients } = useCommsPeople();
  const { conversations, loading, failed, retry } = useCommsConversations();
  const [filter, setFilter] = useState('all');

  const callConvs = useMemo(() => conversations.filter(c => c.channel === 'call'), [conversations]);
  const convById = useMemo(() => new Map(callConvs.map(c => [c.id, c])), [callConvs]);
  const messages = useCommsMessagesFor(callConvs.map(c => c.id));

  const calls = useMemo(() => messages
    .filter(m => m.kind === 'call' && convById.has(m.conversation_id))
    .map(m => ({ message: m, conversation: convById.get(m.conversation_id), look: callRow(m) }))
    .sort((a, b) => new Date(b.message.created_at) - new Date(a.message.created_at)), [messages, convById]);

  const missedCount = calls.filter(c => c.look.missed).length;
  const shown = filter === 'missed' ? calls.filter(c => c.look.missed) : calls;

  return (
    <div className={styles.screen}>
      <MobileRootHeader title="Calls" />
      <div className={styles.toolbar}>
        <SegmentedControl
          size="lg"
          aria-label="Show calls"
          value={filter}
          onValueChange={setFilter}
          items={[
            { key: 'all', label: 'All' },
            { key: 'missed', label: <>Missed <CountBadge value={missedCount} /></> },
          ]}
        />
        {line.number && (
          <div className={styles.toolbarEnd}>
            <span className={`${styles.secondaryText} ${styles.lineNumber}`}>{formatPhone(line.number)}</span>
          </div>
        )}
      </div>
      <div className={styles.bodyWrap}>
        <div className={styles.body}>
          {loading ? <MobileListSkeleton /> : failed ? (
            <MobileEmpty icon="solar:danger-circle-linear" title="Couldn't load calls" action={<Button size="lg" variant="outline" onClick={retry}>Try again</Button>} />
          ) : shown.length === 0 ? (
            <MobileEmpty
              icon="solar:phone-linear"
              title={filter === 'missed' ? 'No missed calls' : 'No calls yet'}
              description={filter === 'missed' ? undefined : 'Calls you make or receive show up here.'}
            />
          ) : (
            <div className={styles.list}>
              {shown.map(({ message, conversation, look }) => (
                <CallRow key={message.id} message={message} conversation={conversation} look={look} patients={patients} />
              ))}
            </div>
          )}
        </div>
        <button type="button" className={styles.fab} aria-label="Call a member" onClick={() => push('callMember')}>
          <Icon name="custom:add-call" size={32} color="currentColor" />
        </button>
      </div>
    </div>
  );
}

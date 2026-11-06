import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Avatar } from '../../../components/Avatar/Avatar';
import { ChatBubble, MissedCallMarker } from '../../../components/ChatBubble/ChatBubble';
import { Icon } from '../../../components/Icon/Icon';
import { MessageComposer } from '../../../components/MessageComposer/MessageComposer';
import { toast } from '../../../components/Toast/sonnerToast';
import { addMessage, markConversationRead } from '../../messages/comms/commsRepo';
import { sendSms } from '../../messages/comms/commsSend';
import { callLook, dayLabel, formatPhone, patientFor } from '../../messages/comms/commsUtils';
import { useCommsMessages } from '../../messages/comms/useComms';
import { useCommsPeople } from '../../messages/comms/useCommsPeople';
import { MobileListSkeleton } from '../MobileParts';
import { useMobileNav } from '../MobileNavContext';
import { conversationTitle, dateOf, durationLabel, initialsOf, patientLine, timeOf } from '../mobileFormat';
import common from '../mobile.module.css';
import styles from './ThreadScreen.module.css';

const PLACEHOLDER = { chat: 'Type message here', sms: 'Type SMS here', email: 'Add an internal note' };

/** One member conversation with a composer (Figma 759:20517 / 759:21008). */
export function ThreadScreen({ conversation }) {
  const { pop, push } = useMobileNav();
  const { patients, me } = useCommsPeople();
  const { messages, loading } = useCommsMessages(conversation.id);
  const patient = patientFor(conversation, patients);
  const [draft, setDraft] = useState('');
  const [internal, setInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const isEmail = conversation.channel === 'email';
  const sender = { id: me?.id || null, name: me?.name || '' };

  useEffect(() => { markConversationRead(conversation).catch(() => {}); }, [conversation]);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, loading]);

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setDraft('');
    try {
      if (conversation.channel === 'sms' && !internal) {
        if (!conversation.patient_phone) throw new Error('This patient has no phone number on file.');
        await sendSms({ conversation, sender, to: conversation.patient_phone, body });
      } else {
        await addMessage({
          conversation_id: conversation.id, kind: 'message', direction: 'out', internal: internal || isEmail,
          sender_id: sender.id, sender_name: sender.name, body, status: 'sent',
        });
      }
    } catch (err) {
      setDraft(body);
      toast.error(err.message || 'Could not send the message.');
    } finally {
      setSending(false);
    }
  };

  const meta = [patientLine(patient), conversation.members?.length > 1 ? `${conversation.members.length} Members` : '']
    .filter(Boolean).join(' • ');

  return (
    <div className={common.screen}>
      <header className={styles.head}>
        <button type="button" className={common.iconBtn} aria-label="Back" onClick={pop}>
          <Icon name="solar:arrow-left-linear" size={24} />
        </button>
        <button
          type="button"
          className={styles.who}
          onClick={patient ? () => push('member', { patientId: patient.id }) : undefined}
          disabled={!patient}
        >
          <Avatar variant="patient" size="L" initials={initialsOf(conversationTitle(conversation))} />
          <span className={styles.whoText}>
            <span className={styles.name}>{conversationTitle(conversation)}</span>
            <span className={styles.meta}>{meta || formatPhone(conversation.patient_phone) || conversation.patient_email || ''}</span>
          </span>
        </button>
      </header>
      {conversation.sticky_note && (
        <div className={styles.sticky}>
          <Icon name="solar:notes-linear" size={16} />
          <span className={styles.stickyText}>{conversation.sticky_note}</span>
        </div>
      )}
      <div ref={scrollRef} className={styles.messages}>
        {loading ? <MobileListSkeleton count={4} height={56} /> : messages.map((m, i) => {
          const prev = messages[i - 1];
          const newDay = !prev || dateOf(prev.created_at) !== dateOf(m.created_at);
          return (
            <Fragment key={m.id}>
              {newDay && <p className={styles.day}>{dayLabel(m.created_at)}</p>}
              <ThreadItem message={m} prev={newDay ? null : prev} conversation={conversation} />
            </Fragment>
          );
        })}
      </div>
      <div className={styles.composer}>
        <MessageComposer
          value={draft}
          onChange={setDraft}
          onSend={send}
          sending={sending}
          internal={internal}
          onInternalChange={isEmail ? undefined : setInternal}
          internalOnly={isEmail}
          placeholder={internal ? 'Add an internal note' : PLACEHOLDER[conversation.channel] || PLACEHOLDER.chat}
          showSchedule={false}
        />
      </div>
    </div>
  );
}

function ThreadItem({ message: m, prev, conversation }) {
  const own = m.direction === 'out';
  const name = m.sender_name || (own ? 'Care team' : conversation.patient_name);
  if (m.kind === 'call') {
    if (!own && m.meta?.outcome === 'missed') return <MissedCallMarker from={name} time={timeOf(m.created_at)} />;
    return (
      <ChatBubble
        side={own ? 'right' : 'left'}
        name={name}
        initials={initialsOf(name)}
        call={{ label: callLook(m).label, duration: durationLabel(m.meta?.duration) || undefined, direction: own ? 'out' : 'in' }}
        time={timeOf(m.created_at)}
      />
    );
  }
  const compact = !!prev && prev.direction === m.direction && prev.sender_name === m.sender_name
    && !!prev.internal === !!m.internal && prev.kind === m.kind
    && new Date(m.created_at) - new Date(prev.created_at) < 5 * 60000;
  return (
    <ChatBubble
      side={m.internal ? 'internal' : own ? 'right' : 'left'}
      name={name}
      initials={initialsOf(name)}
      text={m.subject && m.kind === 'email' ? `${m.subject}\n\n${m.body || ''}` : m.body}
      attachment={m.meta?.attachment}
      compact={compact}
      time={timeOf(m.created_at)}
    />
  );
}

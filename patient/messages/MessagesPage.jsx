import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/Input/Input';
import { Button } from '@/components/Button/Button';
import { Icon } from '@/components/Icon/Icon';
import { ChatBubble } from '@/components/ChatBubble/ChatBubble';
import { MessageComposer } from '@/components/MessageComposer/MessageComposer';
import { MessageStatus } from '@/components/MessageStatus/MessageStatus';
import { RadioOptionGroup } from '@/components/RadioOptionGroup/RadioOptionGroup';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { CardSkeleton } from '@/components/CardSkeleton/CardSkeleton';
import { useProfile } from '../lib/profileContext';
import { useMessages } from './messagesContext';
import { bubbleTime, filterConversations, initialsFrom, listTime } from './messageFormat';
import styles from './MessagesPage.module.css';

const THREAD_POLL_MS = 10000;
const ANYONE = '';
const STATUS = { delivered: 'received', read: 'read', sent: 'sent' };

// #/messages?to=<care team name> (message icon on Home) or ?c=<conversation
// id> (Reply in Notifications).
const readLink = () => {
  const h = window.location.hash;
  const q = h.indexOf('?');
  const params = new URLSearchParams(q >= 0 ? h.slice(q + 1) : '');
  const to = params.get('to');
  const c = params.get('c');
  return to || c ? { to, c } : null;
};

function Thread({ memberId, conversation, onChanged }) {
  const [messages, setMessages] = useState(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const endRef = useRef(null);
  const unread = conversation.unread;

  useEffect(() => {
    let alive = true;
    supabase.rpc('patient_conversation_messages', { p_member_id: memberId, p_conversation_id: conversation.id })
      .then(({ data, error: e }) => {
        if (!alive) return;
        if (e) setError('We could not load this conversation.');
        setMessages(data || []);
      });
    return () => { alive = false; };
  }, [memberId, conversation.id, tick]);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), THREAD_POLL_MS);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!unread) return;
    supabase.rpc('patient_mark_conversation_read', { p_member_id: memberId, p_conversation_id: conversation.id })
      .then(() => onChanged());
  }, [memberId, conversation.id, unread, onChanged]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages?.length]);

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setError('');
    try {
      const { error: e } = await supabase.rpc('patient_send_message', {
        p_member_id: memberId, p_conversation_id: conversation.id, p_body: body,
      });
      if (e) { setError(e.message || 'Your message was not sent. Try again.'); return; }
      setDraft('');
      setTick((n) => n + 1);
      onChanged();
    } catch {
      setError('Your message was not sent. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  };

  const names = conversation.member_names || [];
  return (
    <section className={styles.thread} aria-label={conversation.title}>
      <header className={styles.threadHead}>
        <span className={styles.threadIcon}><Icon name="solar:users-group-rounded-linear" size={20} color="currentColor" /></span>
        <div className={styles.threadTitles}>
          <span className={styles.threadTitle}>{conversation.title}</span>
          {names.length > 0 && <span className={styles.threadMembers}>{names.join(', ')}</span>}
        </div>
      </header>
      <div className={styles.messages}>
        {messages === null && <CardSkeleton count={3} />}
        {messages?.map((m) => (
          <ChatBubble
            key={m.id}
            side={m.direction === 'in' ? 'right' : 'left'}
            name={m.sender_name}
            initials={initialsFrom(m.sender_name)}
            avatarVariant="staff"
            text={m.attachment_name && !m.body ? `Attachment: ${m.attachment_name}` : m.body}
            time={bubbleTime(m.created_at)}
            status={m.direction === 'in' ? <MessageStatus status={STATUS[m.status] || 'sent'} /> : undefined}
          />
        ))}
        <div ref={endRef} />
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.composer}>
        <MessageComposer
          value={draft}
          onChange={setDraft}
          onSend={send}
          sending={sending}
          maxLength={4000}
          showSchedule={false}
          placeholder="Type message here • Shift+Enter for a new line"
        />
      </div>
    </section>
  );
}

function NewMessage({ memberId, careTeam, defaultTo, onStarted, onCancel }) {
  const [to, setTo] = useState(defaultTo || ANYONE);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    setSending(true);
    setError('');
    try {
      const { data, error: e } = await supabase.rpc('patient_start_conversation', {
        p_member_id: memberId, p_body: draft.trim(), p_care_team_name: to || null,
      });
      if (e) { setError(e.message || 'Your message was not sent. Try again.'); return; }
      onStarted(data);
    } catch {
      setError('Your message was not sent. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <section className={styles.thread} aria-label="New message">
      <header className={styles.threadHead}>
        <span className={styles.threadIcon}><Icon name="solar:pen-new-square-linear" size={20} color="currentColor" /></span>
        <div className={styles.threadTitles}><span className={styles.threadTitle}>New message</span></div>
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      </header>
      <div className={styles.newBody}>
        <RadioOptionGroup
          label="To"
          value={to}
          onChange={setTo}
          options={[
            { value: ANYONE, label: 'My care team', hint: 'Whoever is available will reply.' },
            ...careTeam.map((m) => ({ value: m.name, label: m.name, hint: m.title || m.role || undefined })),
          ]}
        />
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.composer}>
        <MessageComposer
          value={draft}
          onChange={setDraft}
          onSend={send}
          sending={sending}
          maxLength={4000}
          showSchedule={false}
          placeholder="Write your message • Shift+Enter for a new line"
        />
      </div>
    </section>
  );
}

export function MessagesPage() {
  const { profile } = useProfile();
  const memberId = profile.member_id;
  const { conversations, loading, error, refresh } = useMessages();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [composing, setComposing] = useState(false);
  const [defaultTo, setDefaultTo] = useState(null);
  const [careTeam, setCareTeam] = useState([]);

  useEffect(() => {
    let alive = true;
    supabase.rpc('patient_care_team', { p_member_id: memberId }).then(({ data }) => { if (alive) setCareTeam(data || []); });
    return () => { alive = false; };
  }, [memberId]);

  // Arriving from a care team member's message icon (#/messages?to=<name>):
  // open the thread they're in, or start a new message to them. Cleared as
  // soon as the person picks something else.
  const [pendingLink, setPendingTo] = useState(readLink);
  useEffect(() => {
    if (pendingLink) window.history.replaceState(null, '', '#/messages');
  }, [pendingLink]);
  const pendingTo = pendingLink?.to || null;
  const linked = pendingLink && !loading
    ? conversations.find((c) => (pendingLink.c ? c.id === pendingLink.c : (c.member_names || []).some((name) => name === pendingTo)))
    : null;
  const linkedNew = Boolean(pendingTo && !loading && !linked);

  const shown = useMemo(() => filterConversations(conversations, query), [conversations, query]);
  const showNew = composing || linkedNew;
  const selected = linked || conversations.find((c) => c.id === selectedId) || (!showNew && !pendingLink ? conversations[0] : null);
  const pick = (fn) => { setPendingTo(null); fn(); };
  const onChanged = useCallback(() => refresh(), [refresh]);

  return (
    <div className={styles.page}>
      <aside className={styles.list} aria-label="Conversations">
        <div className={styles.listHead}>
          <h2 className={styles.listTitle}>Messages</h2>
          <Button variant="outline" size="sm" leadingIcon="solar:pen-new-square-linear" onClick={() => pick(() => { setDefaultTo(null); setComposing(true); })}>
            New
          </Button>
        </div>
        <Input
          aria-label="Search conversations"
          leadingIcon="solar:magnifer-linear"
          placeholder="Search for doctor or group"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {loading && <CardSkeleton count={3} />}
        {!loading && error && <p className={styles.error} role="alert">{error}</p>}
        {!loading && !error && shown.length === 0 && (
          <p className={styles.listEmpty}>{query ? 'No conversations match your search.' : 'No messages yet.'}</p>
        )}
        <ul className={styles.items}>
          {shown.map((c) => {
            const active = !showNew && selected?.id === c.id;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  className={`${styles.item} ${active ? styles.itemActive : ''}`}
                  aria-current={active ? 'true' : undefined}
                  onClick={() => pick(() => { setComposing(false); setSelectedId(c.id); })}
                >
                  <span className={styles.itemIcon}><Icon name="solar:chat-round-line-linear" size={18} color="currentColor" /></span>
                  <span className={styles.itemBody}>
                    <span className={styles.itemTop}>
                      <span className={styles.itemTitle}>{c.title}</span>
                      <span className={styles.itemTime}>{listTime(c.last_message_at)}</span>
                    </span>
                    <span className={styles.itemBottom}>
                      <span className={styles.itemPreview}>{c.last_preview || (c.member_names || []).join(', ')}</span>
                      {c.unread > 0 && <span className={styles.unread} aria-label={`${c.unread} unread`}>{c.unread}</span>}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {showNew ? (
        <NewMessage
          key={(linkedNew ? pendingTo : defaultTo) || 'anyone'}
          memberId={memberId}
          careTeam={careTeam}
          defaultTo={linkedNew ? pendingTo : defaultTo}
          onCancel={() => pick(() => setComposing(false))}
          onStarted={(id) => pick(() => { setComposing(false); setSelectedId(id); refresh(); })}
        />
      ) : selected ? (
        <Thread key={selected.id} memberId={memberId} conversation={selected} onChanged={onChanged} />
      ) : (
        <section className={styles.thread}>
          <EmptyState
            icon="solar:chat-round-line-linear"
            title="Message your care team"
            description="Ask a question or share an update. Your care team usually replies within one business day."
            actionLabel="New message"
            onAction={() => pick(() => setComposing(true))}
          />
        </section>
      )}
    </div>
  );
}

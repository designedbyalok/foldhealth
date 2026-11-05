import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../components/Icon/Icon';
import { Button } from '../../components/Button/Button';
import { Avatar } from '../../components/Avatar/Avatar';
import { ChatBubble } from '../../components/ChatBubble/ChatBubble';
import { MessageStatus } from '../../components/MessageStatus/MessageStatus';
import { getPatientThread, sendAsPatient, markReadAsPatient, subscribeLocalComms } from '../messages/comms/commsRepo';
import { initialsOf, dayLabel } from '../messages/comms/commsUtils';
import { usePatientCallee } from './usePatientCallee';
import { patientMediaSigner } from './patientMedia';
import styles from './PatientCommsPage.module.css';

const timeOnly = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
const clock = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

// The page has no session, so Realtime (which applies RLS) sends it nothing:
// it re-reads the thread on this interval while the tab is visible.
const POLL_MS = 4000;

/**
 * What the patient sees (Figma Fold Patient Web App 701:5360), at
 * /#/p/<token> with no sign-in: their chat with the care team, and calls
 * from the team ring here. Staff open it from the chat header to check what
 * the patient sees.
 */
export function PatientCommsPage({ token }) {
  const [thread, setThread] = useState(undefined);
  const reloadRef = useRef(() => {});
  const reload = useCallback(() => reloadRef.current(), []);
  const onSent = useCallback((m) => setThread(t => (
    t && !t.messages.some(x => x.id === m.id) ? { ...t, messages: [...t.messages, m] } : t
  )), []);

  useEffect(() => {
    let alive = true;
    const load = () => getPatientThread(token)
      .then(t => { if (alive) setThread(t); })
      .catch(() => { if (alive) setThread(prev => (prev === undefined ? null : prev)); });
    reloadRef.current = load;
    load();
    const timer = setInterval(() => { if (!document.hidden) load(); }, POLL_MS);
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVisible);
    const off = subscribeLocalComms(load);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      off();
    };
  }, [token]);

  const conversation = thread?.conversation;
  useEffect(() => {
    document.title = conversation ? `Messages · ${conversation.group_name || 'Fold Health'}` : 'Fold Health';
  }, [conversation]);

  if (thread === undefined) return <div className={styles.loading}>Loading…</div>;
  if (!thread) {
    return (
      <div className={styles.loading}>
        <Icon name="solar:link-broken-linear" size={28} color="var(--neutral-300)" />
        This link is no longer active. Ask your care team for a new one.
      </div>
    );
  }
  return (
    <PatientShell
      token={token}
      conversation={thread.conversation}
      messages={thread.messages}
      onSent={onSent}
      reload={reload}
    />
  );
}

function PatientShell({ token, conversation, messages, onSent, reload }) {
  const visible = messages.filter(m => !m.internal && m.status !== 'draft' && m.kind === 'message');
  const call = usePatientCallee(conversation.patient_token);
  const signUrl = useMemo(() => patientMediaSigner(token), [token]);
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState(null);
  const scrollRef = useRef(null);
  const name = conversation.patient_name;
  const members = [...new Set([...(conversation.members || []).map(m => m.name), ...visible.filter(m => m.direction === 'out').map(m => m.sender_name)].filter(Boolean))];

  // Opening the page reads what the team sent.
  const unreadIds = visible.filter(m => m.direction === 'out' && !m.read_at).map(m => m.id).join(',');
  useEffect(() => {
    if (!unreadIds) return;
    markReadAsPatient(token).then(reload).catch(() => { /* retried on the next poll */ });
  }, [unreadIds, token, reload]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visible.length]);

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    setSendError(null);
    try {
      const saved = await sendAsPatient(token, body);
      if (saved) onSent(saved);
    } catch (err) {
      setDraft(body);
      setSendError(err?.message || 'Your message wasn\'t sent. Try again.');
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.main}>
        <header className={styles.top}>
          <span className={styles.topTitle}>Messages</span>
          <span className={styles.topRight}>
            <Avatar variant="patient" size={32} initials={initialsOf(name)} />
          </span>
        </header>

        <div className={styles.body}>
          <aside className={styles.list}>
            <div className={styles.listLabel}>MESSAGES</div>
            <div className={[styles.convRow, styles.convRowActive].join(' ')}>
              <span className={styles.convIcon}><Icon name="solar:chat-round-linear" size={18} /></span>
              <span className={styles.convText}>
                <span className={styles.convName}>{conversation.group_name || 'Your care team'}</span>
                <span className={styles.convPreview}>{conversation.last_preview}</span>
              </span>
            </div>
          </aside>

          <section className={styles.chat}>
            <div className={styles.chatHead}>
              <span className={styles.convIcon}><Icon name="solar:users-group-rounded-linear" size={18} /></span>
              <span className={styles.convText}>
                <span className={styles.convName}>{conversation.group_name || 'Your care team'}</span>
                <span className={styles.convPreview}>{[name.split(' ')[0], ...members].join(', ')}</span>
              </span>
            </div>

            {call.status !== 'idle' && <CallBanner call={call} />}

            <div ref={scrollRef} className={styles.thread}>
              {visible.length === 0 && <div className={styles.empty}>Your care team will message you here.</div>}
              {visible.map((m, i) => {
                const prev = visible[i - 1];
                const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
                const mine = m.direction === 'in';
                const sender = mine ? name : m.sender_name;
                const compact = !newDay && prev && prev.direction === m.direction && prev.sender_name === m.sender_name
                  && new Date(m.created_at) - new Date(prev.created_at) < 5 * 60000;
                return (
                  <Fragment key={m.id}>
                    {newDay && <div className={styles.daySep}>{dayLabel(m.created_at)}</div>}
                    <ChatBubble
                      side={mine ? 'right' : 'left'}
                      name={mine ? 'You' : sender}
                      selfAvatarVariant="patient"
                      initials={initialsOf(sender)}
                      text={m.body}
                      attachment={m.meta?.attachment}
                      signUrl={signUrl}
                      compact={compact}
                      time={timeOnly(m.created_at)}
                      status={mine ? <MessageStatus status={m.read_at ? 'read' : 'sent'} /> : null}
                    />
                  </Fragment>
                );
              })}
            </div>

            <div className={styles.composer}>
              <textarea
                className={styles.input}
                rows={2}
                placeholder="Type message here"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              />
              <div className={styles.composerBar}>
                <Icon name="solar:paperclip-linear" size={16} color="var(--neutral-200)" />
                <button type="button" className={styles.send} onClick={send} disabled={!draft.trim()} aria-label="Send">
                  <Icon name="solar:plain-2-linear" size={16} />
                </button>
              </div>
              {sendError && <p className={styles.sendError} role="alert">{sendError}</p>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function CallBanner({ call }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (call.status !== 'live') return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [call.status]);
  const secs = call.connectedAt ? Math.max(0, Math.round((now - call.connectedAt) / 1000)) : 0;

  return (
    <div className={[styles.callBanner, call.status === 'incoming' ? styles.callRinging : ''].join(' ')} role="status">
      <Icon name="solar:phone-calling-linear" size={18} />
      <span className={styles.callText}>
        {call.status === 'incoming' && <><strong>{call.from}</strong> is calling you</>}
        {call.status === 'connecting' && 'Connecting…'}
        {call.status === 'live' && <>On a call with <strong>{call.from}</strong> • {clock(secs)}</>}
        {call.status === 'ended' && (call.error || 'Call ended')}
      </span>
      {call.status === 'incoming' && (<>
        <Button variant="outline" onClick={call.decline}>Decline</Button>
        <Button variant="soft" tone="success" leadingIcon="solar:phone-linear" onClick={call.accept}>Answer</Button>
      </>)}
      {(call.status === 'live' || call.status === 'connecting') && (<>
        <Button variant="outline" leadingIcon={call.muted ? 'solar:microphone-slash-linear' : 'solar:microphone-linear'} onClick={call.toggleMute}>
          {call.muted ? 'Unmute' : 'Mute'}
        </Button>
        <Button tone="danger" leadingIcon="solar:end-call-rounded-linear" onClick={call.hangup}>End</Button>
      </>)}
      {call.status === 'ended' && <Button variant="outline" onClick={call.dismiss}>Close</Button>}
    </div>
  );
}

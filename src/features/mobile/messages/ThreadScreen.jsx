import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Avatar } from '../../../components/Avatar/Avatar';
import { BottomSheet, BottomSheetItem } from '../../../components/BottomSheet/BottomSheet';
import { Button } from '../../../components/Button/Button';
import { ChatBubble, MissedCallMarker } from '../../../components/ChatBubble/ChatBubble';
import { Icon } from '../../../components/Icon/Icon';
import { Input } from '../../../components/Input/Input';
import { MessageComposer } from '../../../components/MessageComposer/MessageComposer';
import { MessageStatus } from '../../../components/MessageStatus/MessageStatus';
import { Textarea } from '../../../components/Textarea/Textarea';
import { toast } from '../../../components/Toast/sonnerToast';
import {
  addMessage, deleteConversation, ensurePatientToken, listConversations, markConversationRead,
  renameThread, subscribeComms, updateConversation,
} from '../../messages/comms/commsRepo';
import { retrySend, sendSms, SMS_VIA_GATEWAY } from '../../messages/comms/commsSend';
import { callLook, dayLabel, formatPhone, patientFor } from '../../messages/comms/commsUtils';
import { activeSession, loggedFor, membersForConversation, threadTitle, withForPrefix } from '../../messages/comms/smsMembers';
import { useCommsMessages } from '../../messages/comms/useComms';
import { useCommsPeople } from '../../messages/comms/useCommsPeople';
import { MobileListSkeleton } from '../MobileParts';
import { useMobileNav } from '../MobileNavContext';
import { conversationTitle, dateOf, durationLabel, initialsOf, patientLine, timeOf } from '../mobileFormat';
import { AttachSheet, FileInputs } from './AttachSheet';
import { ShareLinkSheet } from './ShareLinkSheet';
import { uploadChatMedia } from './useInternalChats';
import { useLongPress } from './useLongPress';
import { useObjectUrls } from './useObjectUrls';
import common from '../mobile.module.css';
import form from './messageForm.module.css';
import styles from './ThreadScreen.module.css';

const PLACEHOLDER = { chat: 'Type message here', sms: 'Type SMS here', email: 'Add an internal note' };

/** The conversation as it is now (pinned, archived, sticky note…), not as it was when opened. */
function useLiveConversation(initial, onGone) {
  const [conv, setConv] = useState(initial);
  const gone = useRef(onGone);
  useEffect(() => { gone.current = onGone; });
  useEffect(() => {
    let alive = true;
    listConversations().then((all) => {
      const hit = all.find(c => c.id === initial.id);
      if (alive && hit) setConv(c => ({ ...c, ...hit }));
    }).catch(() => {});
    const off = subscribeComms((change) => {
      if (change.table !== 'patient_conversations' || change.row?.id !== initial.id) return;
      if (change.type === 'DELETE') gone.current?.();
      else setConv(c => ({ ...c, ...change.row }));
    });
    return () => { alive = false; off(); };
  }, [initial.id]);
  return conv;
}

/** One member conversation with a composer (Figma 759:20517 / 759:21008). Mirrors desktop CommsThread. */
export function ThreadScreen({ conversation: opened }) {
  const { pop, push, openMember } = useMobileNav();
  const conversation = useLiveConversation(opened, pop);
  const { patients, me } = useCommsPeople();
  const { messages, loading } = useCommsMessages(conversation.id);
  const patient = patientFor(conversation, patients);
  const channel = conversation.channel;
  const [draft, setDraft] = useState('');
  const [internal, setInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState([]);
  // The Send Form / Send Article link waiting in the box; only Send reads it.
  const shareRef = useRef(null);
  const [sheet, setSheet] = useState(null);
  const [messageFor, setMessageFor] = useState(null);
  const inputs = useRef(null);
  const scrollRef = useRef(null);
  const previews = useObjectUrls();
  const isEmail = channel === 'email';
  const sender = { id: me?.id || null, name: me?.name || 'Care team' };

  // A number shared by several members (FCS-5677): each SMS is logged for
  // one, the session member or else the first, and starts "For Liam: ".
  const members = useMemo(() => membersForConversation(conversation, patients || []), [conversation, patients]);
  const shared = channel === 'sms' && members.length > 1;
  const session = shared ? activeSession(conversation) : null;
  const logFor = (session && members.find(m => m.id === session.member_id)) || members[0];

  // Once per thread, however often the live row changes before it's saved.
  const tokenAsked = useRef(false);
  useEffect(() => {
    if (tokenAsked.current || channel !== 'sms' || SMS_VIA_GATEWAY || conversation.patient_token) return;
    tokenAsked.current = true;
    ensurePatientToken(conversation).catch(() => {});
  }, [channel, conversation]);

  // Opening a thread reads it (and so does each new message while it's
  // open). One request at a time, so the live row's echo doesn't repeat it.
  const readable = useRef(true);
  const reading = useRef(false);
  useEffect(() => {
    if (!readable.current || reading.current || !conversation.unread_count) return;
    reading.current = true;
    markConversationRead(conversation).catch(() => {}).finally(() => { reading.current = false; });
  }, [conversation, messages.length]);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, loading]);

  const editDraft = (v) => {
    setDraft(v);
    if (!v.trim()) shareRef.current = null;
  };

  const send = async () => {
    const files = pending.filter(f => f.url);
    // Still uploading at Send: dropped from the box either way.
    const dropped = pending.filter(f => !f.url);
    let body = draft.trim();
    if (!body && !files.length) return;
    const share = shareRef.current;
    setSending(true);
    setDraft('');
    setPending([]);
    try {
      if (channel === 'sms' && !internal) {
        const to = share?.targets?.length ? share.targets : [conversation.patient_phone].filter(Boolean);
        if (!to.length) throw new Error('This patient has no phone number on file.');
        if (shared && logFor && !share?.forName) body = withForPrefix(body, logFor.name);
        const attribution = shared && logFor ? { id: logFor.id, name: logFor.name } : undefined;
        // One at a time, in order: each SMS goes through the gateway's rate limit and lands in the thread in order.
        for (const phone of to) await sendSms({ conversation, sender, to: phone, body, meta: share?.meta, loggedFor: attribution });
      } else {
        // One message per file; the text rides with the last one (desktop CommsThread).
        const items = files.length ? files : [null];
        for (let i = 0; i < items.length; i++) {
          const f = items[i];
          // In order, one at a time: the thread orders by send time and the text must land last.
          await addMessage({
            conversation_id: conversation.id,
            kind: 'message',
            direction: 'out',
            internal: internal || isEmail,
            sender_id: sender.id,
            sender_name: sender.name,
            body: i === items.length - 1 ? body : '',
            status: 'sent',
            ...(f ? { meta: { attachment: { url: f.url, name: f.name, size: f.size, type: f.type.startsWith('image/') ? 'image' : 'file' } } }
              : share?.meta && !internal ? { meta: share.meta } : {}),
          });
        }
      }
      files.forEach(f => previews.revoke(f.id));
      shareRef.current = null;
    } catch (err) {
      setDraft(body);
      setPending(files);
      toast.error(err.message || 'Could not send the message.');
    } finally {
      dropped.forEach(f => previews.revoke(f.id));
      setSending(false);
    }
  };

  const attach = async (file) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const previewUrl = previews.create(id, file);
    setPending(p => [...p, { id, name: file.name, size: file.size, type: file.type, previewUrl, uploading: true }]);
    try {
      const url = await uploadChatMedia(`comms/${conversation.id}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, '_')}`, file);
      setPending(p => p.map(f => (f.id === id ? { ...f, url, uploading: false } : f)));
    } catch {
      previews.revoke(id);
      setPending(p => p.filter(f => f.id !== id));
      toast.error(`Could not upload ${file.name}.`);
    }
  };
  const removePending = (id) => setPending((p) => {
    const f = p.find(x => x.id === id);
    if (f) previews.revoke(f.id);
    return p.filter(x => x.id !== id);
  });

  // Send Form / Send Article put their line in the box; Send sends it.
  const insertShare = ({ text, meta, targets, forName }) => {
    setDraft(prev => (prev.trim() ? `${prev.trimEnd()}\n${text}` : text));
    shareRef.current = { meta, targets, forName };
  };

  const sendPatient = patient || (conversation.patient_id ? {
    id: conversation.patient_id, name: conversation.patient_name, email: conversation.patient_email, phone: conversation.patient_phone,
  } : null);
  const onAttach = (kind) => {
    setSheet(kind === 'form' || kind === 'article' ? { share: kind } : null);
    if (kind === 'camera' || kind === 'media' || kind === 'file') inputs.current?.open(kind);
    if (kind === 'education' || kind === 'assessment') push('patientSend', { kind, patient: sendPatient });
  };

  const markUnread = async () => {
    readable.current = false;
    await updateConversation(conversation.id, { unread_count: Math.max(1, conversation.unread_count || 0) });
    toast.success('Marked As Unread Successfully');
    pop();
  };

  const onMessageAction = async (key, m) => {
    setMessageFor(null);
    if (key === 'task') {
      push('messageTask', {
        member: (m.direction === 'in' && loggedFor(m, conversation)?.name) || conversation.patient_name,
        patientId: conversation.patient_id,
      });
    }
    if (key === 'unread') markUnread();
    if (key === 'retry') {
      const res = await retrySend(m);
      if (res?.status === 'failed') toast.error(`Not sent: ${res.failure_reason}`);
    }
    if (key === 'copy') {
      try { await navigator.clipboard.writeText(m.body || ''); toast.success('Copied'); } catch { toast.error('Could not copy.'); }
    }
  };

  const title = shared ? threadTitle(conversation, members) : conversationTitle(conversation);
  const meta = channel === 'sms'
    ? [formatPhone(conversation.patient_phone), shared ? `${members.length} members` : ''].filter(Boolean).join(' • ')
    : [patientLine(patient), channel === 'chat' ? conversation.group_name : '', conversation.members?.length > 1 ? `${conversation.members.length} Members` : '']
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
          onClick={patient ? () => openMember({ id: patient.id }) : undefined}
          disabled={!patient}
        >
          <Avatar variant="patient" size="L" initials={initialsOf(title)} />
          <span className={styles.whoText}>
            <span className={styles.name}>{title}</span>
            <span className={styles.meta}>{meta || conversation.patient_email || ''}</span>
          </span>
        </button>
        {conversation.pinned && <Icon name="solar:pin-linear" size={16} color="var(--neutral-300)" aria-label="Pinned" />}
        <button type="button" className={common.iconBtn} aria-label="More actions" onClick={() => setSheet({ menu: true })}>
          <Icon name="solar:menu-dots-linear" size={24} />
        </button>
      </header>
      {conversation.sticky_note && (
        <button type="button" className={styles.sticky} onClick={() => setSheet({ note: true })} aria-label="Edit sticky note">
          <Icon name="solar:notes-linear" size={16} />
          <span className={styles.stickyText}>{conversation.sticky_note}</span>
        </button>
      )}
      <div ref={scrollRef} className={styles.messages}>
        {loading ? <MobileListSkeleton count={4} height={56} /> : messages.length === 0 ? (
          <p className={styles.day}>No messages yet. Say hello!</p>
        ) : messages.map((m, i) => {
          const prev = messages[i - 1];
          const newDay = !prev || dateOf(prev.created_at) !== dateOf(m.created_at);
          return (
            <Fragment key={m.id}>
              {newDay && <p className={styles.day}>{dayLabel(m.created_at)}</p>}
              <ThreadItem message={m} prev={newDay ? null : prev} conversation={conversation} onHold={() => setMessageFor(m)} />
            </Fragment>
          );
        })}
      </div>
      <div className={styles.composer}>
        <MessageComposer
          value={draft}
          onChange={editDraft}
          onSend={send}
          sending={sending}
          internal={internal}
          onInternalChange={isEmail ? undefined : setInternal}
          internalOnly={isEmail}
          placeholder={internal ? 'Add an internal note' : PLACEHOLDER[channel] || PLACEHOLDER.chat}
          showSchedule={false}
          maxLength={channel === 'sms' && !internal ? 500 : undefined}
          attachments={pending}
          onRemoveAttachment={removePending}
          tools={isEmail ? [] : [{ key: 'attach', icon: 'solar:paperclip-linear', tooltip: 'Attach', onClick: () => setSheet({ attach: true }) }]}
        />
      </div>
      <FileInputs ref={inputs} onFiles={files => files.forEach(attach)} />

      {sheet?.attach && (
        <AttachSheet
          onClose={() => setSheet(null)}
          onPick={onAttach}
          // Desktop attaches files on Chat only; SMS goes out as text.
          media={channel === 'chat'}
          share
          patientSend={!!sendPatient}
        />
      )}
      {sheet?.share && (
        <ShareLinkSheet
          conversation={conversation}
          kind={sheet.share}
          forName={shared ? logFor?.name : undefined}
          onInsert={insertShare}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.menu && (
        <ThreadMenu
          conversation={conversation}
          shared={shared}
          canSend={!!sendPatient}
          onClose={() => setSheet(null)}
          onPick={(key) => {
            setSheet(key === 'note' || key === 'rename' || key === 'delete' ? { [key]: true } : null);
            if (key === 'unread') markUnread();
            if (key === 'education' || key === 'assessment') push('patientSend', { kind: key, patient: sendPatient });
          }}
        />
      )}
      {sheet?.note && <StickyNoteSheet conversation={conversation} onClose={() => setSheet(null)} />}
      {sheet?.rename && <RenameSheet conversation={conversation} onClose={() => setSheet(null)} />}
      {sheet?.delete && <DeleteSheet conversation={conversation} onClose={() => setSheet(null)} />}
      {messageFor && <MessageActions message={messageFor} onClose={() => setMessageFor(null)} onPick={key => onMessageAction(key, messageFor)} />}
    </div>
  );
}

/** The ••• sheet on a thread (Figma 759:21765), with desktop CommsThread's header actions. */
function ThreadMenu({ conversation: c, shared, canSend, onClose, onPick }) {
  const toggle = async (patch, done) => {
    onClose();
    try { await updateConversation(c.id, patch); toast.success(done); } catch (err) { toast.error(err?.message || 'Could not update the conversation.'); }
  };
  return (
    <BottomSheet title="Actions" onClose={onClose}>
      <BottomSheetItem icon="solar:pin-linear" label={c.pinned ? 'Unpin' : 'Pin'} onClick={() => toggle({ pinned: !c.pinned }, c.pinned ? 'Unpinned Successfully' : 'Pinned Successfully')} />
      <BottomSheetItem icon="solar:archive-down-linear" label={c.archived ? 'Unarchive' : 'Archive'} onClick={() => toggle({ archived: !c.archived }, c.archived ? 'Unarchived Successfully' : 'Archived Successfully')} />
      <BottomSheetItem icon="solar:eye-closed-linear" label="Mark as Unread" onClick={() => onPick('unread')} />
      <BottomSheetItem icon="solar:notes-linear" label={c.sticky_note ? 'Edit Sticky Note' : 'Add Sticky Note'} onClick={() => onPick('note')} />
      {shared && <BottomSheetItem icon="solar:pen-linear" label="Rename Thread" onClick={() => onPick('rename')} />}
      {canSend && <BottomSheetItem icon="solar:book-2-linear" label="Send Education" onClick={() => onPick('education')} />}
      {canSend && <BottomSheetItem icon="solar:clipboard-check-linear" label="Send Assessment" onClick={() => onPick('assessment')} />}
      <BottomSheetItem icon="solar:trash-bin-minimalistic-linear" label="Delete Conversation" tone="danger" onClick={() => onPick('delete')} />
    </BottomSheet>
  );
}

function StickyNoteSheet({ conversation, onClose }) {
  const [text, setText] = useState(conversation.sticky_note || '');
  const save = async (value) => {
    try {
      await updateConversation(conversation.id, { sticky_note: value });
      toast.success(value ? 'Sticky Note Saved Successfully' : 'Sticky Note Removed Successfully');
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Could not save the sticky note.');
    }
  };
  return (
    <BottomSheet title="Sticky Note" onClose={onClose}>
      <div className={form.sheetBody}>
        <Textarea rows={4} placeholder="Add a note everyone on this thread sees" value={text} onValueChange={setText} aria-label="Sticky note" />
        <div className={form.sheetActions}>
          {conversation.sticky_note && <Button size="lg" variant="outline" tone="danger" onClick={() => save(null)}>Remove</Button>}
          <Button size="lg" onClick={() => save(text.trim())} disabled={!text.trim()}>Save</Button>
        </div>
      </div>
    </BottomSheet>
  );
}

/** Rename Thread (FCS-5677): an empty name goes back to the members' names. */
function RenameSheet({ conversation, onClose }) {
  const [name, setName] = useState(conversation.thread_name || '');
  const save = async () => {
    const next = name.trim();
    if (next === (conversation.thread_name || '')) { onClose(); return; }
    try {
      await renameThread(conversation, next);
      toast.success(next ? 'Thread Renamed Successfully' : 'Thread Name Removed Successfully');
      onClose();
    } catch (err) {
      toast.error(err.message || 'Could not rename this thread.');
    }
  };
  return (
    <BottomSheet title="Rename Thread" onClose={onClose}>
      <div className={form.sheetBody}>
        <Input size="lg" label="Thread name" placeholder="Type a thread name" maxLength={60} enterKeyHint="done" value={name} onValueChange={setName} />
        <Button size="lg" fullWidth onClick={save}>Save</Button>
      </div>
    </BottomSheet>
  );
}

function DeleteSheet({ conversation, onClose }) {
  const [busy, setBusy] = useState(false);
  return (
    <BottomSheet title="Delete this conversation?" onClose={onClose}>
      <div className={form.sheetBody}>
        <p className={form.hint}>Every message in it is removed for everyone, permanently. This can&apos;t be undone.</p>
        <div className={form.sheetActions}>
          <Button size="lg" variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            size="lg"
            tone="danger"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              // Stays busy once deleted: the live row's DELETE closes the thread.
              let deleted = false;
              try {
                await deleteConversation(conversation.id);
                deleted = true;
                toast.success('Conversation Deleted Successfully');
              } catch (err) {
                toast.error(err.message || 'Could not delete this conversation.');
                onClose();
              } finally {
                setBusy(deleted);
              }
            }}
          >
            Delete Conversation
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}

/** Press and hold a message: desktop's ••• menu (Create Task, Mark as Unread) plus retry and copy. */
function MessageActions({ message: m, onClose, onPick }) {
  const own = m.direction === 'out';
  return (
    <BottomSheet title="Message" onClose={onClose}>
      {m.status === 'failed' && own && <BottomSheetItem icon="solar:restart-linear" label="Retry Send" onClick={() => onPick('retry')} />}
      <BottomSheetItem icon="solar:clipboard-add-linear" label="Create Task" onClick={() => onPick('task')} />
      {!own && <BottomSheetItem icon="solar:eye-closed-linear" label="Mark as Unread" onClick={() => onPick('unread')} />}
      {m.body && <BottomSheetItem icon="solar:copy-linear" label="Copy Text" onClick={() => onPick('copy')} />}
    </BottomSheet>
  );
}

// Message state → MessageStatus (desktop CommsThread statusOf).
function statusOf(m) {
  if (m.status === 'queued') return 'delay';
  if (m.status === 'failed') return 'failed';
  if (m.read_at || m.status === 'read') return 'read';
  if (m.status === 'delivered') return 'received';
  return 'sent';
}

function ThreadItem({ message: m, prev, conversation, onHold }) {
  const { handlers, guard } = useLongPress(onHold);
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
    <div className={styles.hold} {...handlers} onClickCapture={guard()} data-testid="thread-message">
      <ChatBubble
        side={m.internal ? 'internal' : own ? 'right' : 'left'}
        name={name}
        initials={initialsOf(name)}
        text={m.subject && m.kind === 'email' ? `${m.subject}\n\n${m.body || ''}` : m.body}
        attachment={m.meta?.attachment}
        compact={compact}
        time={timeOf(m.created_at)}
        status={own && !m.internal ? <MessageStatus status={statusOf(m)} onResend={() => retrySend(m)} /> : null}
        footer={m.status === 'failed' && m.failure_reason ? <div className={styles.failed}>{m.failure_reason}</div> : null}
      />
    </div>
  );
}

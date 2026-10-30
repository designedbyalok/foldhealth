import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Icon } from '../../../components/Icon/Icon';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Avatar } from '../../../components/Avatar/Avatar';
import { Badge } from '../../../components/Badge/Badge';
import { InfoBar } from '../../../components/InfoBar/InfoBar';
import { StickyNote } from '../../../components/StickyNote/StickyNote';
import { MessageComposer } from '../../../components/MessageComposer/MessageComposer';
import { MessageStatus } from '../../../components/MessageStatus/MessageStatus';
import { ChatBubble, MissedCallMarker } from '../../../components/ChatBubble/ChatBubble';
import { Link } from '../../../components/Link/Link';
import { CloseButton } from '../../../components/CloseButton/CloseButton';
import { Checkbox } from '../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { MenuPopover } from '../../../components/MenuPopover/MenuPopover';
import { RenamePopover } from '../../../components/RenamePopover/RenamePopover';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { AddTaskDrawer } from '../../tasks/AddTaskDrawer';
import { BulkSelectIcon } from '../../../components/Icon/BulkSelectIcon';
import { CaretRightIcon } from '../../../components/Icon/CaretRightIcon';
import { ArticleIcon } from '../../../components/Icon/ArticleIcon';
import { toast } from '../../../components/Toast/sonnerToast';
import { supabase } from '../../../lib/supabase';
import listStyles from '../MessagesView.module.css';
import { useCommsMessages } from './useComms';
import { addMessage, updateConversation, markConversationRead, findOrCreateConversation, logMessagesFor, renameThread, deleteConversation, ensurePatientToken, setSmsSession, assignMessages } from './commsRepo';
import { sendSms, retrySend, SMS_VIA_GATEWAY } from './commsSend';
import { useBrowserCall } from './call/useBrowserCall';
import { useAppStore } from '../../../store/useAppStore';
import { formatDuration } from './call/rtc';
import {
  initialsOf, patientMetaParts, callLook, fullStamp, dayLabel, patientLink, openInNewTab, formatPhone,
} from './commsUtils';
import { membersForConversation, loggedFor, threadTitle, isUnassigned, withForPrefix, activeSession, forPrefix, keepPrefix } from './smsMembers';
import { LogForChip, LogForCoachmark, SelectMemberModal, AssignSmsModal, MemberOption } from './SmsAttribution';
import styles from './Comms.module.css';

const isSmsText = (m) => m.kind === 'message' && !m.internal;

// Messages that no person sent (meta.source), named this way in their header.
const AUTOMATED_SENDERS = { automation: 'Automation', campaign: 'Campaign' };

const timeOnly = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

/**
 * One patient conversation on Chat, SMS or Calls: header, sticky note, the
 * messages and calls, and the type box. `conversation.channel` decides how
 * a message is sent (chat: saved and shown on the patient's page; SMS: sent
 * through the gateway phone; Calls: internal notes only).
 */
export function CommsThread({ conversation, patient, me, focusMessageId, showIntro = true, onOpenProfile }) {
  const { messages, loading } = useCommsMessages(conversation.id);
  const [draft, setDraft] = useState('');
  const [internal, setInternal] = useState(false);
  const [archiveOnSend, setArchiveOnSend] = useState(false);
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState([]);
  // A form added from Send Form: who it goes to (SMS numbers) and its meta,
  // used by the next Send; cleared once sent or when the box is emptied.
  const [share, setShare] = useState(null);
  const scrollRef = useRef(null);
  const fileInputId = useId();
  const startCall = useBrowserCall(s => s.start);
  const callStatus = useBrowserCall(s => s.status);
  const channel = conversation.channel;
  const openCommsDrawer = useAppStore(s => s.openCommsDrawer);
  const openQuickView = useAppStore(s => s.openQuickView);
  const sender = { id: me?.id || null, name: me?.name || 'Care team' };

  // A number shared by several members (FCS-5677): each SMS is logged for one.
  const patients = useAppStore(s => s.allPatients);
  const members = useMemo(() => membersForConversation(conversation, patients || []), [conversation, patients]);
  const shared = channel === 'sms' && members.length > 1;

  // SMS works like Chat for now (no gateway, see commsSend.js): the patient
  // reads and answers it on their patient page, so an SMS thread gets a link.
  const hasPatientPage = (channel === 'chat' || (channel === 'sms' && !SMS_VIA_GATEWAY)) && !!conversation.patient_token;
  useEffect(() => {
    if (channel === 'sms' && !SMS_VIA_GATEWAY && !conversation.patient_token) ensurePatientToken(conversation).catch(() => {});
  }, [channel, conversation]);
  const [logForId, setLogForId] = useState(null);
  // Rest-of-today session (FCS-5677): assigning a received SMS starts it;
  // until midnight replies go to that member and Log For defaults to them.
  const session = shared ? activeSession(conversation) : null;
  const sessionMember = session ? members.find(m => m.id === session.member_id) : null;
  const [sentFor, setSentFor] = useState(null);
  // While a session runs, Log For defaults to its member: a session that
  // starts or switches (here or elsewhere) clears any earlier pick.
  const [sessionFor, setSessionFor] = useState(session?.member_id ?? null);
  if ((session?.member_id ?? null) !== sessionFor) {
    setSessionFor(session?.member_id ?? null);
    setLogForId(null);
  }
  const logFor = members.find(m => m.id === logForId) || sessionMember || members[0];
  // Switching Log For away from whoever the last SMS went to pre-fills
  // "For Liam: " (editable); back to that member, the tag comes off, since
  // a follow-up to the same person isn't tagged again (FCS-5677).
  // As in New SMS: on a shared number every SMS starts "For Liam: ", locked,
  // following Log For. Not on internal notes (the family never sees them),
  // and not while a form or article line names the member already.
  const tagName = shared && !internal && !share?.forName ? logFor?.name ?? null : null;
  const [appliedTag, setAppliedTag] = useState(null);
  if (tagName !== appliedTag) {
    setAppliedTag(tagName);
    setDraft(d => withForPrefix(d, tagName));
  }
  const tagPrefix = tagName ? forPrefix(tagName) : '';
  const editDraft = (v) => {
    const next = tagPrefix ? keepPrefix(v, tagPrefix, draft) : v;
    setDraft(next);
    if (!next.slice(tagPrefix.length).trim()) setShare(null);
  };
  const pickLogFor = (id) => {
    setLogForId(id);
    // A form or article line already in the box ("…for Annette Brave:")
    // follows the new member too.
    const member = members.find(m => m.id === id);
    const from = share?.forName;
    if (from && member) {
      setDraft(d => d.split(`for ${from}`).join(`for ${member.name}`));
      setShare(sh => ({ ...sh, forName: member.name }));
    }
  };
  const chipRef = useRef(null);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState(() => new Set());
  const [memberModal, setMemberModal] = useState(false);
  const [logging, setLogging] = useState(false);
  const moreRef = useRef(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const membersRef = useRef(null);
  const [membersOpen, setMembersOpen] = useState(false);

  // Rename Thread (FCS-5677), from the pencil; an empty name goes back to
  // the members' names.
  const [renaming, setRenaming] = useState(false);
  const titleRef = useRef(null);
  const commitRename = async (next) => {
    if (next === (conversation.thread_name || '')) return;
    try {
      await renameThread(conversation, next);
      toast.success(next ? 'Thread Renamed Successfully' : 'Thread Name Removed Successfully');
    } catch (err) {
      toast.error(err.message || 'Could not rename this thread.');
    }
  };

  const startSelecting = (id) => { setPicked(new Set(id ? [id] : [])); setSelecting(true); };
  const stopSelecting = () => { setSelecting(false); setPicked(new Set()); };
  const togglePicked = (id) => setPicked((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  // While a session runs, replies that arrive after it started go to its
  // member, so they never sit Unassigned. Each message is tried once.
  const autoAssigned = useRef(new Set());
  useEffect(() => {
    if (!session || !sessionMember) return;
    const since = new Date(session.started_at).getTime();
    const due = messages.filter(m => isSmsText(m) && isUnassigned(m, true)
      && new Date(m.created_at).getTime() >= since && !autoAssigned.current.has(m.id));
    if (!due.length) return;
    due.forEach(m => autoAssigned.current.add(m.id));
    assignMessages(due, { id: sessionMember.id, name: sessionMember.name }, 'session').catch(() => {});
  }, [messages, session, sessionMember]);

  // Assign SMS to Member, for one received SMS. "below" also takes the
  // received SMS after it, up to the next one someone assigned by hand;
  // "today" starts (or moves) the rest-of-today session to the member.
  const [assignFor, setAssignFor] = useState(null);
  const assignReceived = async (member, applyTo) => {
    setLogging(true);
    try {
      const list = [assignFor];
      if (applyTo === 'below') {
        for (const m of messages.slice(messages.findIndex(x => x.id === assignFor.id) + 1)) {
          if (m.direction !== 'in' || !isSmsText(m)) continue;
          if (m.meta?.assigned_by === 'staff') break;
          list.push(m);
        }
      }
      const who = { id: member.id, name: member.name };
      await assignMessages(list, who, 'staff');
      if (applyTo === 'today' || applyTo === 'below') {
        await setSmsSession(conversation, who, { until: applyTo === 'today' ? 'today' : 'manual' });
        setLogForId(null);
        setSentFor(null);
      } else if (session?.ends === 'manual') {
        // Logging an incoming message by hand ends an open-ended session.
        await setSmsSession(conversation, null);
      }
      setAssignFor(null);
      toast.success('SMS Logged For Member Successfully');
      return true;
    } catch (err) {
      toast.error(err.message || 'Could not assign this SMS.');
      return false;
    } finally {
      setLogging(false);
    }
  };

  const logPicked = async (member) => {
    setLogging(true);
    try {
      await logMessagesFor([...picked], { id: member.id, name: member.name });
      if (session?.ends === 'manual' && messages.some(m => picked.has(m.id) && m.direction === 'in')) {
        await setSmsSession(conversation, null);
      }
      setMemberModal(false);
      stopSelecting();
      toast.success('SMS Logged For Member Successfully');
      return true;
    } catch (err) {
      toast.error(err.message || 'Could not log the SMS for this member.');
      return false;
    } finally {
      setLogging(false);
    }
  };

  // Opening a thread reads it, except right after "Mark as Unread": that
  // holds until a new message arrives or the thread is left.
  const unreadAt = useRef(null);
  useEffect(() => {
    if (unreadAt.current === messages.length) return;
    unreadAt.current = null;
    markConversationRead(conversation);
  }, [conversation, messages.length]);
  const [taskFor, setTaskFor] = useState(null);

  // The ••• menu on a message (3540:66129).
  const onMessageAction = (key, m) => {
    if (key === 'task') setTaskFor((m.direction === 'in' && loggedFor(m, conversation)?.name) || conversation.patient_name);
    if (key === 'unread') {
      unreadAt.current = messages.length;
      updateConversation(conversation.id, { unread_count: Math.max(1, conversation.unread_count || 0) });
      toast.success('Marked As Unread Successfully');
    }
    // A received SMS gets "Assign SMS to Member" (with Apply to); a sent one
    // just changes who it's logged for.
    if (key === 'logfor' && m.direction === 'in') setAssignFor(m);
    else if (key === 'logfor') { setPicked(new Set([m.id])); setMemberModal(true); }
  };

  // Opens at the newest message; on first load a focused message out of view
  // is brought to the middle instead, highlighted for 3 seconds.
  const focusedOnce = useRef(false);
  const [focusFaded, setFocusFaded] = useState(false);
  useEffect(() => {
    if (loading || !focusMessageId) return undefined;
    const t = setTimeout(() => setFocusFaded(true), 3000);
    return () => clearTimeout(t);
  }, [loading, focusMessageId]);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    if (loading || focusedOnce.current || !focusMessageId) return;
    const row = el.querySelector('[data-focused="true"]');
    if (!row) return;
    focusedOnce.current = true;
    const box = el.getBoundingClientRect();
    const r = row.getBoundingClientRect();
    if (r.top < box.top || r.bottom > box.bottom) {
      el.scrollTop += r.top - box.top - (box.height - r.height) / 2;
    }
  }, [messages.length, loading, focusMessageId]);

  // Files picked but not sent: they upload right away and wait in the type
  // box until Send.
  const send = async () => {
    const body = draft.trim();
    const files = pending.filter(f => f.url);
    // The tag alone isn't a message.
    if (!draft.slice(tagPrefix.length).trim() && !files.length) return;
    setSending(true);
    setDraft(tagPrefix);
    setPending([]);
    try {
      if (channel === 'sms' && !internal) {
        const to = share?.targets?.length ? share.targets : [conversation.patient_phone].filter(Boolean);
        if (!to.length) throw new Error('This patient has no phone number on file.');
        const attribution = shared && logFor ? { id: logFor.id, name: logFor.name } : undefined;
        for (const phone of to) await sendSms({ conversation, sender, to: phone, body, meta: share?.meta, loggedFor: attribution });
        // Sent for someone other than the session member: offer to switch.
        setSentFor(session && attribution && attribution.id !== session.member_id ? logFor : null);
        // A one-off send for someone else; Log For goes back to the session member.
        if (session) setLogForId(null);
      } else {
        // One message per file; the text rides with the last one.
        const items = files.length ? files : [null];
        for (let i = 0; i < items.length; i++) {
          const f = items[i];
          await addMessage({
            conversation_id: conversation.id,
            kind: 'message',
            direction: 'out',
            internal: internal || channel === 'call',
            sender_id: sender.id,
            sender_name: sender.name,
            body: i === items.length - 1 ? body : '',
            status: 'sent',
            ...(f ? { meta: { attachment: { url: f.url, name: f.name, size: f.size, type: f.type.startsWith('image/') ? 'image' : 'file' } } }
              : share?.meta && !internal ? { meta: share.meta } : {}),
          });
        }
      }
      files.forEach(f => URL.revokeObjectURL(f.previewUrl));
      setShare(null);
      if (archiveOnSend) await updateConversation(conversation.id, { archived: true });
    } catch (err) {
      setDraft(body);
      setPending(files);
      toast.error(err.message || 'Could not send the message.');
    } finally {
      setSending(false);
    }
  };

  const attach = async (file) => {
    if (!file) return;
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const previewUrl = URL.createObjectURL(file);
    setPending(p => [...p, { id, name: file.name, size: file.size, type: file.type, previewUrl, uploading: true }]);
    const path = `comms/${conversation.id}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, '_')}`;
    const { error } = await supabase.storage.from('chat-media').upload(path, file, { upsert: true });
    if (error) {
      URL.revokeObjectURL(previewUrl);
      setPending(p => p.filter(f => f.id !== id));
      toast.error(`Could not upload ${file.name}.`);
      return;
    }
    const { data } = supabase.storage.from('chat-media').getPublicUrl(path);
    setPending(p => p.map(f => (f.id === id ? { ...f, url: data.publicUrl, uploading: false } : f)));
  };

  const removePending = (id) => setPending((p) => {
    const f = p.find(x => x.id === id);
    if (f) URL.revokeObjectURL(f.previewUrl);
    return p.filter(x => x.id !== id);
  });

  const call = async () => {
    try {
      const chat = channel === 'chat' ? conversation : await findOrCreateConversation('chat', {
        id: conversation.patient_id, name: conversation.patient_name, email: conversation.patient_email, phone: conversation.patient_phone,
      });
      startCall({ chat, patient: { id: conversation.patient_id, name: conversation.patient_name, email: conversation.patient_email, phone: conversation.patient_phone }, sender });
    } catch {
      toast.error('Could not start the call.');
    }
  };

  // Chat and SMS type box tools. Attachment (any file) and Media (images and
  // video) attach in Chat; the others are placeholders for now.
  const pickFiles = (accept) => {
    const input = document.getElementById(fileInputId);
    if (!input) return;
    input.accept = accept;
    input.click();
  };
  // Send Form / Send Article put their message in the box; Send sends it.
  const insertShare = ({ text, meta, targets, forName }) => {
    // The line names the member itself, so a "For Liam: " tag would repeat it.
    setDraft((prev) => {
      const d = forName ? withForPrefix(prev, null) : prev;
      return d.trim() ? `${d.trimEnd()}\n${text}` : text;
    });
    setShare({ meta, targets, forName });
  };
  const tools = channel === 'call' ? [] : [
    {
      key: 'attach', icon: 'solar:paperclip-linear', tooltip: 'Attachment',
      onClick: channel === 'chat' ? () => pickFiles('image/*,video/*,.pdf,.doc,.docx,.txt') : undefined,
    },
    { key: 'form', icon: 'solar:document-text-linear', tooltip: 'Forms', onClick: () => openCommsDrawer('forms', { conversation, forName: shared ? logFor?.name : undefined, onInsert: insertShare }) },
    { key: 'article', iconNode: <ArticleIcon />, tooltip: 'Articles', onClick: () => openCommsDrawer('article', { conversation, forName: shared ? logFor?.name : undefined, onInsert: insertShare }) },
    { key: 'appointment', icon: 'solar:calendar-mark-linear', tooltip: 'Appointment Link' },
    {
      key: 'media', icon: 'solar:gallery-linear', tooltip: 'Media',
      onClick: channel === 'chat' ? () => pickFiles('image/*,video/*') : undefined,
    },
    { key: 'scheduled', icon: 'solar:clock-circle-linear', tooltip: 'Scheduled' },
  ];

  return (
    <div className={`${listStyles.chatPanel} ${styles.threadPanel}`}>
      <div className={styles.threadHeader}>
        {shared
          ? <Avatar variant="patient" type="icon" iconName="solar:users-group-rounded-linear" size={40} className={styles.headerAvatar} />
          : <Avatar variant="patient" size={40} initials={initialsOf(conversation.patient_name)} className={styles.headerAvatar} />}
        <div className={styles.headerInfo}>
          <div className={styles.headerNameRow}>
            {shared ? (
              <>
                {/* Every member's first name, or the custom name. */}
                <span ref={titleRef} className={styles.headerName}>{threadTitle(conversation, members)}</span>
                <ActionButton icon="solar:pen-linear" size="sm" tooltip="Rename Thread" onClick={() => setRenaming(o => !o)} />
                {renaming && (
                  <RenamePopover
                    anchorRef={titleRef}
                    label="Thread name"
                    value={conversation.thread_name || ''}
                    placeholder="Type a thread name"
                    maxLength={60}
                    onSave={commitRename}
                    onClose={() => setRenaming(false)}
                  />
                )}
              </>
            ) : (
              <span className={styles.headerName}>{conversation.patient_name}</span>
            )}
            {!shared && <CaretRightIcon />}
          </div>
          {/* An SMS thread belongs to a number: its second line is the number and, when shared, who shares it. */}
          <div className={styles.headerMeta}>
            {channel === 'sms' ? (
              <>
                {conversation.patient_phone && formatPhone(conversation.patient_phone)}
                {shared && (
                  <>
                    {conversation.patient_phone && ' • '}
                    <button
                      ref={membersRef}
                      type="button"
                      className={styles.membersCount}
                      aria-haspopup="menu"
                      aria-expanded={membersOpen}
                      onClick={() => setMembersOpen(o => !o)}
                    >
                      {members.length} members
                    </button>
                  </>
                )}
              </>
            ) : (
              <>
                {patientMetaParts(conversation, patient).map((part, i) => (
                  <Fragment key={i}>
                    {i > 0 && ' • '}
                    {i === 1 && patient?.gender ? <span className={styles.metaGender}>{part}</span> : part}
                  </Fragment>
                ))}
                {channel === 'chat' && conversation.group_name && <span className={styles.metaAccent}> • {conversation.group_name}</span>}
              </>
            )}
          </div>
        </div>
        <div className={styles.headerActions}>
          {shared && (
            <>
              {selecting ? (
                <ActionButton
                  icon="solar:user-circle-linear"
                  tooltip="Log SMS for member"
                  disabled={!picked.size}
                  onClick={() => setMemberModal(true)}
                />
              ) : (
                <ActionButton tooltip="Bulk Select" onClick={() => startSelecting()}>
                  <BulkSelectIcon size={20} color="var(--neutral-300)" />
                </ActionButton>
              )}
              <span className={styles.headerDivider} />
            </>
          )}
          {hasPatientPage && (
            <>
              <ActionButton
                icon="solar:square-top-up-linear"
                tooltip="Open patient view"
                onClick={() => openInNewTab(patientLink(conversation.patient_token))}
              />
              <span className={styles.headerDivider} />
            </>
          )}
          <ActionButton icon="solar:user-check-rounded-linear" tooltip="Assign" />
          <span className={styles.headerDivider} />
          <ActionButton
            icon="solar:archive-down-linear"
            tooltip={conversation.archived ? 'Unarchive' : 'Archive'}
            onClick={() => updateConversation(conversation.id, { archived: !conversation.archived })}
          />
          <span className={styles.headerDivider} />
          <ActionButton
            icon="solar:phone-calling-linear"
            tooltip="Make a Call"
            disabled={!(callStatus === 'idle' || callStatus === 'ended')}
            onClick={call}
          />
          <span className={styles.headerDivider} />
          <ActionButton icon="solar:magnifer-linear" tooltip="Search" />
          <span className={styles.headerDivider} />
          <ActionButton
            ref={moreRef}
            icon="solar:menu-dots-linear"
            tooltip="More Actions"
            tooltipLeft
            onClick={() => setMoreOpen(o => !o)}
          />
          {moreOpen && (
            <MenuPopover
              anchorRef={moreRef}
              width={160}
              items={[
                { key: 'pin', icon: 'solar:pin-linear', label: conversation.pinned ? 'Unpin' : 'Pin' },
                { key: 'delete', icon: 'solar:trash-bin-minimalistic-linear', label: 'Delete Conversation', danger: true },
              ]}
              onSelect={(key) => {
                setMoreOpen(false);
                if (key === 'delete') setConfirmDelete(true);
                if (key === 'pin') updateConversation(conversation.id, { pinned: !conversation.pinned });
              }}
              onClose={() => setMoreOpen(false)}
              ariaLabel="More actions"
            />
          )}
          {membersOpen && (
            <MenuPopover
              anchorRef={membersRef}
              align="left"
              width={280}
              ariaLabel="Members on this number"
              // A row opens that member's profile; one with no profile yet
              // (e.g. a demo family member before its migration) can't be opened.
              items={members.map(m => {
                const hasProfile = (patients || []).some(p => String(p.id) === m.id);
                return { key: m.id, tall: true, disabled: !hasProfile, hint: hasProfile ? 'Open profile' : 'No profile in the app yet', label: <MemberOption member={m} profileArrow={hasProfile} /> };
              })}
              // The arrow opens their profile in a quick view: docked beside the
              // thread on the Messages page, over it everywhere else.
              onSelect={(id) => {
                setMembersOpen(false);
                const p = (patients || []).find(x => String(x.id) === id);
                if (!p) return;
                const snapshot = { id: p.id, name: p.name, initials: p.initials, gender: p.gender, age: p.age, memberId: p.memberId, language: p.language };
                if (onOpenProfile) onOpenProfile(snapshot); else openQuickView(snapshot);
              }}
              onClose={() => setMembersOpen(false)}
            />
          )}
        </div>
      </div>

      <div className={styles.stickyBar}>
        <StickyNote
          notes={conversation.sticky_note ? [{ id: 'note', text: conversation.sticky_note, author_name: '' }] : []}
          onCreate={text => updateConversation(conversation.id, { sticky_note: text })}
          onSave={(_, text) => updateConversation(conversation.id, { sticky_note: text })}
          onDelete={() => updateConversation(conversation.id, { sticky_note: null })}
        />
      </div>

      {selecting && (
        <div className={styles.selectBar}>
          <span className={styles.selectCount}>{picked.size} {picked.size === 1 ? 'Message' : 'Messages'} Selected</span>
          <span className={styles.selectDivider} aria-hidden="true" />
          <CloseButton size={16} label="Stop selecting" onClick={stopSelecting} />
        </div>
      )}

      <div ref={scrollRef} className={styles.thread}>
        {loading ? (
          <div className={styles.threadEmpty}>Loading…</div>
        ) : messages.length === 0 ? (
          <div className={styles.threadEmpty}>
            {channel === 'call' ? 'No calls yet.' : 'No messages yet. Say hello!'}
            {hasPatientPage && (
              <span className={styles.threadEmptyHint}>
                {conversation.patient_name} reads and answers on their{' '}
                <Link onClick={() => openInNewTab(patientLink(conversation.patient_token))}>patient page</Link>.
              </span>
            )}
          </div>
        ) : messages.map((m, i) => {
          const prev = messages[i - 1];
          const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
          const item = (
            <ThreadItem
              message={m}
              prev={newDay ? null : prev}
              conversation={conversation}
              attributed={shared}
              canLogFor={shared && !selecting}
              onAction={onMessageAction}
            />
          );
          return (
            <Fragment key={m.id}>
              {newDay && <div className={styles.daySep}><span>{dayLabel(m.created_at)}</span></div>}
              <SelectableRow
                show={selecting}
                selectable={isSmsText(m)}
                checked={picked.has(m.id)}
                onToggle={() => togglePicked(m.id)}
              >
                {m.id === focusMessageId ? (
                  <div className={`${styles.focusedMessage} ${focusFaded ? styles.focusedMessageDone : ''}`} data-focused="true">
                    {item}
                  </div>
                ) : item}
              </SelectableRow>
            </Fragment>
          );
        })}
      </div>

      {(sessionMember || sentFor) && (
        <div className={styles.sessionBars}>
          {sessionMember && (
            <InfoBar
              className={styles.sessionBar}
              action={(
                <Link
                  onClick={async () => {
                    await setSmsSession(conversation, null);
                    setSentFor(null);
                    toast.success('Auto-Assigning Stopped Successfully');
                  }}
                >
                  Stop auto-assigning
                </Link>
              )}
            >
              Auto-assigning incoming messages to {sessionMember.name}{session.ends === 'manual' ? '' : ' until midnight'}.
            </InfoBar>
          )}
          {sentFor && sessionMember && (
            <InfoBar
              className={styles.sessionBar}
              action={<Link onClick={() => { setSmsSession(conversation, sentFor); setLogForId(null); setSentFor(null); }}>Switch to {sentFor.name}</Link>}
              onClose={() => setSentFor(null)}
            >
              Sent for {sentFor.name}. Incoming messages still go to {sessionMember.name}.
            </InfoBar>
          )}
        </div>
      )}

      <MessageComposer
        value={draft}
        onChange={editDraft}
        onSend={send}
        internal={internal}
        onInternalChange={channel === 'call' ? undefined : setInternal}
        internalOnly={channel === 'call'}
        placeholder={channel === 'call' ? 'Add a note about these calls • only staff can see it' : undefined}
        tools={tools}
        archiveOnSend={archiveOnSend}
        onArchiveOnSendChange={setArchiveOnSend}
        sending={sending}
        attachments={pending}
        onRemoveAttachment={removePending}
        maxLength={channel === 'sms' && !internal ? 500 : undefined}
        toolbarStart={shared && !internal ? (
          <>
            <LogForChip ref={chipRef} members={members} value={logFor?.id} onChange={pickLogFor} />
            {showIntro && <LogForCoachmark anchorRef={chipRef} />}
          </>
        ) : undefined}
      />
      {shared && (
        <SelectMemberModal
          open={memberModal}
          members={members}
          saving={logging}
          onClose={() => { setMemberModal(false); if (!selecting) setPicked(new Set()); }}
          onSave={logPicked}
        />
      )}
      {shared && (
        <AssignSmsModal
          open={!!assignFor}
          members={members}
          saving={logging}
          onClose={() => setAssignFor(null)}
          onSave={assignReceived}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          variant="destructive"
          title="Delete this conversation?"
          description="Every message in it is removed for everyone, permanently. This can't be undone."
          confirmLabel="Delete Conversation"
          cancelLabel="Cancel"
          loading={deleting}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            setDeleting(true);
            try {
              await deleteConversation(conversation.id);
              toast.success('Conversation Deleted Successfully');
            } catch (err) {
              toast.error(err.message || 'Could not delete this conversation.');
              setDeleting(false);
              setConfirmDelete(false);
            }
          }}
        />
      )}
      {taskFor && (
        <AddTaskDrawer
          initialMember={taskFor}
          onClose={() => setTaskFor(null)}
          onTaskCreated={() => setTaskFor(null)}
        />
      )}
      <input
        id={fileInputId}
        type="file"
        hidden
        multiple
        accept="image/*,video/*"
        onChange={e => { [...(e.target.files || [])].forEach(attach); e.target.value = ''; }}
      />
    </div>
  );
}

/** In selection mode, a message with its checkbox at the right. */
function SelectableRow({ show, selectable, checked, onToggle, children }) {
  if (!show) return children;
  return (
    <div className={styles.selectRow}>
      <div className={styles.selectMain}>{children}</div>
      {selectable
        ? <Checkbox checked={checked} onCheckedChange={onToggle} aria-label="Select message" />
        : <span className={styles.selectSpacer} aria-hidden="true" />}
    </div>
  );
}

const sameMember = (a, b) => (a.logged_for_patient_id || null) === (b.logged_for_patient_id || null);

/**
 * `attributed`: the number is shared, so an SMS reads "Sender → Member"
 * (ours) or the member's name (theirs).
 */
function ThreadItem({ message: m, prev, conversation, attributed = false, canLogFor = false, onAction }) {
  const own = m.direction === 'out';
  const sameSender = prev && prev.direction === m.direction && prev.sender_name === m.sender_name
    && prev.kind === m.kind && !!prev.internal === !!m.internal && sameMember(prev, m)
    && new Date(m.created_at) - new Date(prev.created_at) < 5 * 60000;
  const name = m.sender_name || (own ? 'Care team' : conversation.patient_name);
  const unassigned = isSmsText(m) && isUnassigned(m, attributed);
  const member = attributed && isSmsText(m) && !unassigned ? loggedFor(m, conversation) : null;
  const shownName = unassigned
    ? formatPhone(m.from_addr || conversation.patient_phone)
    : member && !own ? member.name : name;
  // Sent by an automation or a campaign: "Automation → Liam Johnson".
  const source = AUTOMATED_SENDERS[m.meta?.source];
  const label = source
    ? <span className={styles.byline}>{source}<Icon name="solar:arrow-right-linear" size={12} />{(member || loggedFor(m, conversation)).name}</span>
    : unassigned
      ? <span className={styles.byline}>{shownName}<Badge tone="grey" size="XS" label="Unassigned" /></span>
      : member && own
        ? <span className={styles.byline}>{name}<Icon name="solar:arrow-right-linear" size={12} />{member.name}</span>
        : shownName;
  // Received: all four; sent: no Mark as Unread. Log For Member only on a
  // shared number's SMS.
  const menuItems = [
    { key: 'task', icon: 'solar:clipboard-add-linear', label: 'Create Task' },
    { key: 'type', icon: 'solar:medal-ribbon-linear', label: 'Assign Message Type' },
    ...(!own ? [{ key: 'unread', icon: 'solar:chat-unread-linear', label: 'Mark as Unread' }] : []),
    ...(canLogFor && isSmsText(m) ? [{ key: 'logfor', icon: 'solar:user-circle-linear', label: 'Log For Member' }] : []),
  ];
  const onMenu = (key) => onAction?.(key, m);

  if (m.kind === 'call') {
    // An unanswered call from the patient reads as a marker across the thread.
    if (!own && m.meta?.outcome === 'missed') {
      return <MissedCallMarker from={m.sender_name || conversation.patient_name} time={timeOnly(m.created_at)} />;
    }
    const look = callLook(m);
    const via = m.meta?.via === 'browser' ? 'Browser' : formatPhone(m.meta?.number || conversation.patient_phone);
    return (
      <ChatBubble
        side={own ? 'right' : 'left'}
        name={name}
        initials={initialsOf(name)}
        call={{
          label: [look.label, via].filter(Boolean).join(' • '),
          duration: m.meta?.duration ? formatDuration(m.meta.duration) : undefined,
          direction: own ? 'out' : 'in',
        }}
        time={fullStamp(m.created_at)}
      />
    );
  }

  const attachment = m.meta?.attachment;
  return (
    <ChatBubble
      side={m.internal ? 'internal' : own ? 'right' : 'left'}
      name={label}
      initials={initialsOf(shownName)}
      avatarIcon={unassigned ? 'solar:user-linear' : undefined}
      text={m.body}
      attachment={attachment}
      // On a shared number each SMS keeps its avatar and "Sender → Member" line.
      compact={sameSender && !m.internal && !(attributed && isSmsText(m))}
      time={timeOnly(m.created_at)}
      status={own && !m.internal ? <MessageStatus status={statusOf(m)} onResend={() => retrySend(m)} /> : null}
      menuItems={menuItems}
      onMenuSelect={onMenu}
      footer={m.status === 'failed' && m.failure_reason ? <div className={styles.failedRow}>{m.failure_reason}</div> : null}
    />
  );
}

// Message state → Fold-Pixel MessageStatus.
function statusOf(m) {
  if (m.status === 'queued') return 'delay';
  if (m.status === 'failed') return 'failed';
  if (m.read_at || m.status === 'read') return 'read';
  if (m.status === 'delivered') return 'received';
  return 'sent';
}

import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import { Avatar } from '../../../components/Avatar/Avatar';
import { ChatBubble } from '../../../components/ChatBubble/ChatBubble';
import { Icon } from '../../../components/Icon/Icon';
import { MessageComposer } from '../../../components/MessageComposer/MessageComposer';
import { MessageStatus } from '../../../components/MessageStatus/MessageStatus';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import { dayLabel } from '../../messages/comms/commsUtils';
import { getDisplayName, getInitials } from '../../messages/messageUtils';
import { MobileListSkeleton } from '../MobileParts';
import { useMobileNav } from '../MobileNavContext';
import { dateOf, initialsOf, timeOf } from '../mobileFormat';
import { AttachSheet, FileInputs } from './AttachSheet';
import { uploadChatMedia, useInternalThread, useStaffProfiles } from './useInternalChats';
import common from '../mobile.module.css';
import styles from './ThreadScreen.module.css';

/** One staff-to-staff chat (desktop Internal Chat, ChatArea): messages, photos and files. */
export function InternalThreadScreen({ userId, profile: given }) {
  const { pop } = useMobileNav();
  const me = useAppStore(s => s.currentUserProfile);
  const profiles = useStaffProfiles();
  const other = given || profiles.find(p => p.id === userId) || { id: userId };
  const { messages, loading, send } = useInternalThread(me?.id, userId);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState([]);
  const [sending, setSending] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const inputs = useRef(null);
  const scrollRef = useRef(null);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, loading]);

  // Files upload right away and wait in the type box until Send (desktop ChatArea.attach).
  const attach = async (file) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const previewUrl = URL.createObjectURL(file);
    setPending(p => [...p, { id, name: file.name, size: file.size, type: file.type, previewUrl, uploading: true }]);
    const ext = file.name.split('.').pop();
    try {
      const url = await uploadChatMedia(`${me?.id}/${Date.now()}-${id}.${ext}`, file);
      setPending(p => p.map(f => (f.id === id ? { ...f, url, uploading: false } : f)));
    } catch (err) {
      URL.revokeObjectURL(previewUrl);
      setPending(p => p.filter(f => f.id !== id));
      toast.error(`Could not upload ${file.name}: ${err.message}`);
    }
  };
  const removePending = (id) => setPending((p) => {
    const f = p.find(x => x.id === id);
    if (f) URL.revokeObjectURL(f.previewUrl);
    return p.filter(x => x.id !== id);
  });

  // One message per file (the text goes with the last), or just the text.
  const doSend = async () => {
    const content = draft.trim();
    const files = pending.filter(f => f.url).map(f => ({ url: f.url, name: f.name, type: f.type.startsWith('image/') ? 'image' : 'file', previewUrl: f.previewUrl }));
    if ((!content && !files.length) || sending) return;
    setSending(true);
    setDraft('');
    setPending([]);
    try {
      const items = files.length ? files : [null];
      for (let i = 0; i < items.length; i++) {
        await send({ content: i === items.length - 1 ? content : '', media: items[i] });
      }
      files.forEach(f => URL.revokeObjectURL(f.previewUrl));
    } catch (err) {
      setDraft(content);
      toast.error(`Could not send: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const name = getDisplayName(other);
  return (
    <div className={common.screen}>
      <header className={styles.head}>
        <button type="button" className={common.iconBtn} aria-label="Back" onClick={pop}>
          <Icon name="solar:arrow-left-linear" size={24} />
        </button>
        <span className={styles.who}>
          <Avatar variant="staff" size="L" initials={getInitials(other)} />
          <span className={styles.whoText}>
            <span className={styles.name}>{name}</span>
            <span className={styles.meta}>{other.email || 'Internal chat'}</span>
          </span>
        </span>
      </header>
      <div ref={scrollRef} className={styles.messages}>
        {loading ? <MobileListSkeleton count={4} height={56} /> : messages.length === 0 ? (
          <p className={styles.day}>No messages yet. Say hello!</p>
        ) : messages.map((m, i) => {
          const prev = messages[i - 1];
          const newDay = !prev || dateOf(prev.created_at) !== dateOf(m.created_at);
          const isOwn = m.sender_id === me?.id;
          const pendingRow = String(m.id).startsWith('opt-');
          const compact = !newDay && prev.sender_id === m.sender_id && new Date(m.created_at) - new Date(prev.created_at) < 5 * 60000;
          return (
            <Fragment key={m.id}>
              {newDay && <p className={styles.day}>{dayLabel(m.created_at)}</p>}
              <ChatBubble
                side={isOwn ? 'right' : 'left'}
                name={isOwn ? 'You' : name}
                initials={isOwn ? initialsOf(me?.name) : getInitials(other)}
                text={m.content || ''}
                attachment={m.media_url ? { url: m.media_url, name: m.media_name || (m.media_type === 'form' ? 'Form' : 'Attachment'), type: m.media_type === 'image' ? 'image' : 'file' } : undefined}
                compact={compact}
                time={timeOf(m.created_at)}
                status={isOwn ? <MessageStatus status={pendingRow ? 'delay' : m.read_at ? 'read' : 'sent'} /> : null}
              />
            </Fragment>
          );
        })}
      </div>
      <div className={styles.composer}>
        <MessageComposer
          value={draft}
          onChange={setDraft}
          onSend={doSend}
          sending={sending}
          showSchedule={false}
          attachments={pending}
          onRemoveAttachment={removePending}
          tools={[{ key: 'attach', icon: 'solar:paperclip-linear', tooltip: 'Attach', onClick: () => setAttachOpen(true) }]}
        />
      </div>
      <FileInputs ref={inputs} onFiles={files => files.forEach(attach)} />
      {attachOpen && (
        <AttachSheet
          onClose={() => setAttachOpen(false)}
          onPick={(kind) => { setAttachOpen(false); inputs.current?.open(kind); }}
          media
        />
      )}
    </div>
  );
}

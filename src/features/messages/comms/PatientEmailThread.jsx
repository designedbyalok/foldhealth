import { useEffect, useState } from 'react';
import { Icon } from '../../../components/Icon/Icon';
import { Avatar } from '../../../components/Avatar/Avatar';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Button } from '../../../components/Button/Button';
import { StickyNote } from '../../../components/StickyNote/StickyNote';
import { MessageComposer } from '../../../components/MessageComposer/MessageComposer';
import { MenuPopover } from '../../../components/MenuPopover/MenuPopover';
import listStyles from '../MessagesView.module.css';
import emailStyles from '../email/EmailWorkspace.module.css';
import { useCommsMessages } from './useComms';
import { addMessage, updateConversation, markConversationRead } from './commsRepo';
import { retrySend } from './commsSend';
import { initialsOf, patientMeta, fullStamp, dayLabel } from './commsUtils';
import styles from './PatientEmailThread.module.css';

/**
 * A patient email thread (Figma 1:25080): subject, the patient, a card per
 * email (latest open, earlier ones folded to a line), failures with their
 * reason and a Retry (1:28665), and Reply / Reply All / Forward / Internal
 * note along the bottom.
 */
export function PatientEmailThread({ conversation, patient, me, onCompose }) {
  const { messages } = useCommsMessages(conversation.id);
  const emails = messages.filter(m => m.status !== 'draft');
  const [openIds, setOpenIds] = useState(() => new Set());
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => { markConversationRead(conversation); }, [conversation, messages.length]);

  const latest = emails[emails.length - 1];
  const lastIn = [...emails].reverse().find(m => m.direction === 'in');
  const subject = conversation.subject || latest?.subject || '(no subject)';
  const isOpen = (m) => m.id === latest?.id || openIds.has(m.id) || m.status === 'failed';
  const toggle = (id) => setOpenIds(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const reply = (all, source = lastIn || latest) => onCompose({
    conversation,
    patient,
    to: [conversation.patient_email].filter(Boolean),
    cc: all && source?.cc ? source.cc.split(/,\s*/).filter(Boolean) : [],
    subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
    bodyText: '',
    useTemplate: false,
  });
  const forward = (source = latest) => onCompose({
    conversation,
    patient,
    to: [],
    subject: subject.startsWith('Fwd:') ? subject : `Fwd: ${subject}`,
    bodyText: source ? `\n\n---------- Forwarded message ----------\nFrom: ${source.sender_name} ${source.from_addr ? `<${source.from_addr}>` : ''}\nDate: ${fullStamp(source.created_at)}\nSubject: ${source.subject || subject}\n\n${source.body}` : '',
    useTemplate: false,
  });

  const saveNote = async () => {
    const body = note.trim();
    if (!body) return;
    setNote('');
    await addMessage({
      conversation_id: conversation.id, kind: 'note', direction: 'out', internal: true,
      sender_id: me?.id || null, sender_name: me?.name || 'Care team', body, status: 'sent',
    });
  };

  return (
    <div className={listStyles.chatPanel}>
      <div className={emailStyles.subjectBar}><span>Subject : {subject}</span></div>
      <div className={listStyles.chatHeader}>
        <Avatar variant="patient" size={40} initials={initialsOf(conversation.patient_name)} />
        <div className={listStyles.chatHeaderInfo}>
          <div className={listStyles.chatHeaderName}>
            {conversation.patient_name}
            <Icon name="solar:alt-arrow-right-linear" size={12} color="var(--neutral-300)" />
          </div>
          <div className={listStyles.chatHeaderMeta}>
            {[patientMeta(conversation, patient), conversation.patient_email].filter(Boolean).join(' • ')}
          </div>
        </div>
        <div className={listStyles.chatHeaderActions}>
          <ActionButton
            icon={conversation.pinned ? 'solar:pin-bold' : 'solar:pin-linear'}
            size="sm"
            tooltip={conversation.pinned ? 'Unpin' : 'Pin'}
            onClick={() => updateConversation(conversation.id, { pinned: !conversation.pinned })}
          />
          <div className={listStyles.divider} />
          <ActionButton
            icon="solar:archive-linear"
            size="sm"
            tooltip={conversation.archived ? 'Unarchive' : 'Archive'}
            onClick={() => updateConversation(conversation.id, { archived: !conversation.archived })}
          />
        </div>
      </div>
      <div className={styles.sticky}>
        <StickyNote
          notes={conversation.sticky_note ? [{ id: 'note', text: conversation.sticky_note, author_name: '' }] : []}
          onCreate={text => updateConversation(conversation.id, { sticky_note: text })}
          onSave={(_, text) => updateConversation(conversation.id, { sticky_note: text })}
          onDelete={() => updateConversation(conversation.id, { sticky_note: null })}
        />
      </div>

      <div className={styles.thread}>
        {emails.map((m, i) => {
          const prev = emails[i - 1];
          const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
          return (
            <div key={m.id} className={styles.group}>
              {newDay && <div className={styles.daySep}><span>{dayLabel(m.created_at)}</span></div>}
              {m.kind === 'note' ? (
                <NoteCard message={m} />
              ) : (
                <EmailCard
                  message={m}
                  open={isOpen(m)}
                  onToggle={() => toggle(m.id)}
                  onReply={() => reply(false, m)}
                  onReplyAll={() => reply(true, m)}
                  onForward={() => forward(m)}
                />
              )}
            </div>
          );
        })}
        {emails.length === 0 && <div className={styles.empty}>No emails in this thread yet.</div>}
      </div>

      {noteOpen ? (
        <MessageComposer
          value={note}
          onChange={setNote}
          onSend={saveNote}
          internalOnly
          placeholder="Internal note • only staff can see it"
          tools={[{ key: 'close', icon: 'solar:close-circle-linear', tooltip: 'Close note', onClick: () => setNoteOpen(false) }]}
        />
      ) : (
        <div className={styles.actions}>
          <Button leadingIcon="solar:reply-linear" onClick={() => reply(false)}>Reply</Button>
          <Button variant="outline" leadingIcon="solar:reply-2-linear" onClick={() => reply(true)}>Reply All</Button>
          <Button variant="outline" leadingIcon="solar:forward-linear" onClick={() => forward()}>Forward</Button>
          <Button variant="outline" leadingIcon="solar:lock-keyhole-minimalistic-linear" onClick={() => setNoteOpen(true)}>Internal note</Button>
        </div>
      )}
    </div>
  );
}

function EmailCard({ message: m, open, onToggle, onReply, onReplyAll, onForward }) {
  const [menu, setMenu] = useState(null);
  const failed = m.status === 'failed';
  const name = m.sender_name || (m.direction === 'in' ? m.from_addr : 'Care team');
  const items = [
    ...(failed ? [{ key: 'retry', icon: 'solar:restart-linear', label: 'Retry sending' }] : []),
    { key: 'reply', icon: 'solar:reply-linear', label: 'Reply' },
    { key: 'replyAll', icon: 'solar:reply-2-linear', label: 'Reply All' },
    { key: 'forward', icon: 'solar:forward-linear', label: 'Forward' },
  ];
  return (
    <article className={[styles.card, failed ? styles.cardFailed : ''].join(' ')}>
      {failed && (
        <div className={styles.failBanner}>
          <Icon name="solar:danger-triangle-linear" size={14} />
          There was an issue sending your email.
        </div>
      )}
      <div className={styles.cardMain}>
        <button type="button" className={styles.cardHead} onClick={onToggle} aria-expanded={open}>
          <Avatar variant={m.direction === 'in' ? 'patient' : 'staff'} size={32} initials={initialsOf(name)} />
          <span className={styles.cardWho}>
            <span className={styles.cardName}>
              {name}
              {m.direction === 'out' && <Icon name="solar:arrow-right-up-linear" size={12} color="var(--neutral-300)" />}
            </span>
            <span className={styles.cardDate}>
              {fullStamp(m.created_at)}
              {m.status === 'queued' && ' • Sending…'}
            </span>
          </span>
        </button>
        <ActionButton icon="solar:menu-dots-bold" size="sm" tooltip="More" onClick={e => setMenu(e.currentTarget.getBoundingClientRect())} />
        {menu && (
          <MenuPopover
            anchorRect={menu}
            items={items}
            onClose={() => setMenu(null)}
            onSelect={(key) => {
              setMenu(null);
              if (key === 'retry') retrySend(m);
              if (key === 'reply') onReply();
              if (key === 'replyAll') onReplyAll();
              if (key === 'forward') onForward();
            }}
          />
        )}
      </div>
      {open ? (
        <div className={styles.cardBody}>
          <div className={styles.addrs}>
            {m.to_addr && <div>To: {m.to_addr}</div>}
            {m.cc && <div>CC: {m.cc}</div>}
            {m.bcc && <div>BCC: {m.bcc}</div>}
          </div>
          {failed && (
            <div className={styles.failBox}>
              <Icon name="solar:danger-triangle-linear" size={16} color="var(--status-error)" />
              <div>
                <div className={styles.failTitle}>Email Failed to Send</div>
                <div>Reason for Failure:</div>
                <div>{m.failure_reason || 'Unknown error.'}</div>
              </div>
            </div>
          )}
          <div className={styles.text}>{m.body}</div>
        </div>
      ) : (
        <div className={styles.snippet}>{(m.body || '').replace(/\s+/g, ' ').slice(0, 160)}</div>
      )}
    </article>
  );
}

function NoteCard({ message: m }) {
  return (
    <article className={[styles.card, styles.noteCard].join(' ')}>
      <div className={styles.cardMain}>
        <div className={styles.cardHead}>
          <Avatar variant="staff" size={32} initials={initialsOf(m.sender_name)} />
          <span className={styles.cardWho}>
            <span className={styles.cardName}>{m.sender_name}<span className={styles.noteTag}>Internal note</span></span>
            <span className={styles.cardDate}>{fullStamp(m.created_at)}</span>
          </span>
        </div>
      </div>
      <div className={styles.cardBody}><div className={styles.text}>{m.body}</div></div>
    </article>
  );
}

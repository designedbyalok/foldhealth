import { Icon } from '../../components/Icon/Icon';
import { MessageStatus } from '../../components/MessageStatus/MessageStatus';
import { ChatBubble } from '../../components/ChatBubble/ChatBubble';
import { getInitials, getDisplayName, formatMsgTime, shouldShowTimestamp } from './messageUtils';
import styles from './MessagesView.module.css';

export function ChatMessagesList({
  messagesRef,
  loading,
  messages,
  currentUser,
  otherUser,
  isOtherTyping,
  onReply,
}) {
  const initials = getInitials(otherUser);
  const displayName = getDisplayName(otherUser);

  return (
    <div ref={messagesRef} className={styles.chatMessages}>
      {loading ? (
        <div className={styles.skeletonMessages}>
          {[
            { own: false, w: 160 }, { own: true, w: 120 }, { own: false, w: 220 },
            { own: true, w: 80 }, { own: false, w: 140 }, { own: true, w: 180 },
          ].map((s, i) => (
            <div key={i} className={[styles.skeletonRow, s.own ? styles.skeletonOwn : ''].filter(Boolean).join(' ')}>
              {!s.own && <div className={styles.skeletonAvatar} />}
              <div className={styles.skeletonBubble} style={{ width: s.w }} />
            </div>
          ))}
        </div>
      ) : messages.length === 0 ? (
        <div className={styles.chatEmpty}>
          <div className={styles.chatEmptyAvatar}>{initials}</div>
          <div style={{ fontSize: 'var(--font-lg)', fontWeight: 600, color: 'var(--neutral-500)' }}>{displayName}</div>
          <div style={{ fontSize: 'var(--font-md)', color: 'var(--neutral-300)' }}>No messages yet. Say hello!</div>
        </div>
      ) : messages.map((msg, idx) => {
        const isOwn    = msg.sender_id === currentUser.id;
        const prevMsg  = messages[idx - 1];
        const showTs   = shouldShowTimestamp(msg, prevMsg);
        const compact  = !showTs && prevMsg && prevMsg.sender_id === msg.sender_id;
        const replyMsg = msg.reply_to_id ? messages.find(m => m.id === msg.reply_to_id) : null;
        const isPending = String(msg.id).startsWith('opt-');
        const name = isOwn ? 'You' : displayName;
        const attachment = msg.media_url
          ? { url: msg.media_url, name: msg.media_name || (msg.media_type === 'form' ? 'Form' : 'Attachment'), type: msg.media_type === 'image' ? 'image' : 'file' }
          : undefined;

        return (
          <div key={msg.id} className={styles.bubbleItem}>
            {showTs && <div className={styles.msgDateSep}>{formatMsgTime(msg.created_at)}</div>}
            <ChatBubble
              side={isOwn ? 'right' : 'left'}
              name={name}
              initials={isOwn ? getInitials(currentUser) : initials}
              text={msg.content || ''}
              attachment={attachment}
              reply={replyMsg ? { name: replyMsg.sender_id === currentUser.id ? 'You' : displayName, text: replyMsg.content || 'Attachment' } : undefined}
              compact={compact}
              time={formatMsgTime(msg.created_at)}
              status={isOwn ? <MessageStatus status={isPending ? 'delay' : msg.read_at ? 'read' : 'sent'} /> : null}
              menuItems={[{ key: 'reply', icon: 'solar:reply-linear', label: 'Reply' }]}
              onMenuSelect={(key) => { if (key === 'reply') onReply(msg); }}
            />
          </div>
        );
      })}

      {isOtherTyping && (
        <div className={styles.typingRow}>
          <div className={styles.msgAvatar}>{initials}</div>
          <div className={styles.typingBubble}>
            <span className={styles.typingDot} />
            <span className={styles.typingDot} />
            <span className={styles.typingDot} />
          </div>
        </div>
      )}
    </div>
  );
}

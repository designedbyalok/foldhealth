import { Icon } from '../../components/Icon/Icon';
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
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--neutral-500)' }}>{displayName}</div>
          <div style={{ fontSize: 13, color: 'var(--neutral-300)' }}>No messages yet. Say hello!</div>
        </div>
      ) : messages.map((msg, idx) => {
        const isOwn    = msg.sender_id === currentUser.id;
        const prevMsg  = messages[idx - 1];
        const showTs   = shouldShowTimestamp(msg, prevMsg);
        const showAv   = !isOwn && (!prevMsg || prevMsg.sender_id !== msg.sender_id);
        const replyMsg = msg.reply_to_id ? messages.find(m => m.id === msg.reply_to_id) : null;
        const isPending = String(msg.id).startsWith('opt-');

        return (
          <div key={msg.id}>
            {showTs && <div className={styles.msgDateSep}>{formatMsgTime(msg.created_at)}</div>}
            <div
              className={[styles.msgRow, isOwn ? styles.own : ''].filter(Boolean).join(' ')}
              style={{ marginTop: showTs || showAv ? 8 : 2 }}
            >
              {!isOwn && (
                <div className={styles.msgAvatar} style={{ visibility: showAv ? 'visible' : 'hidden' }}>
                  {initials}
                </div>
              )}

              <div className={styles.msgBubbleWrap}>
                {replyMsg && (
                  <div className={[styles.msgReplyQuote, isOwn ? styles.own : ''].join(' ')}>
                    <div className={styles.msgReplyBar} />
                    <div>
                      <div className={styles.msgReplyName}>
                        {replyMsg.sender_id === currentUser.id ? 'You' : displayName}
                      </div>
                      <div className={styles.msgReplyText}>{replyMsg.content || '📎 Media'}</div>
                    </div>
                  </div>
                )}
                <div className={[styles.msgBubble, isOwn ? styles.mine : styles.other].join(' ')}>
                  {msg.media_url && msg.media_type === 'image' && (
                    /* A link, not an <img onClick>: opening the full image in a new
                       tab is exactly what an anchor does, it is keyboard-reachable,
                       and it matches the file/form attachments below. */
                    <a
                      href={msg.media_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.msgImageLink}
                    >
                      <img
                        src={msg.media_url}
                        alt={msg.media_name || 'image'}
                        className={styles.msgImage}
                      />
                    </a>
                  )}
                  {msg.media_url && msg.media_type === 'file' && (
                    <a href={msg.media_url} target="_blank" rel="noreferrer" className={styles.msgFile}>
                      <Icon name="solar:file-bold" size={16} />
                      <span>{msg.media_name}</span>
                    </a>
                  )}
                  {msg.media_url && msg.media_type === 'form' && (
                    <a href={msg.media_url} className={styles.msgFormCard}>
                      <span className={styles.msgFormIcon}>
                        <Icon name="solar:clipboard-text-linear" size={18} color="var(--primary-300)" />
                      </span>
                      <span className={styles.msgFormMain}>
                        <span className={styles.msgFormLabel}>Form</span>
                        <span className={styles.msgFormName}>{msg.media_name || 'Open form'}</span>
                      </span>
                      <Icon name="solar:arrow-right-linear" size={14} color="var(--neutral-300)" />
                    </a>
                  )}
                  {msg.content && <span>{msg.content}</span>}
                </div>
                {isOwn && (
                  <div className={[styles.msgStatus, msg.read_at ? styles.msgStatusRead : ''].join(' ')}>
                    {isPending
                      ? <Icon name="solar:clock-circle-linear" size={11} />
                      : msg.read_at
                        ? <Icon name="solar:check-read-bold"   size={12} />
                        : <Icon name="solar:check-bold"        size={12} />}
                  </div>
                )}
              </div>

              <button className={styles.msgReplyBtn} onClick={() => onReply(msg)} title="Reply">
                <Icon name="solar:reply-linear" size={14} />
              </button>
            </div>
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

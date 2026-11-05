import { Icon } from '../../components/Icon/Icon';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { getInitials, getDisplayName } from './messageUtils';
import styles from './MessagesView.module.css';

export function ChatHeader({ otherUser, isOtherTyping }) {
  const initials = getInitials(otherUser);
  const displayName = getDisplayName(otherUser);

  return (
    <div className={styles.chatHeader}>
      <div className={styles.convAvatar} style={{ width: 40, height: 40, borderRadius: 10, fontSize: 'var(--font-base)' }}>
        {initials}
      </div>
      <div className={styles.chatHeaderInfo}>
        <div className={styles.chatHeaderName}>
          {displayName}
          <Icon name="solar:alt-arrow-right-linear" size={12} color="var(--neutral-300)" />
        </div>
        <div className={styles.chatHeaderMeta}>
          {isOtherTyping
            ? <span className={styles.typingMeta}>typing…</span>
            : otherUser.email}
        </div>
      </div>
      <div className={styles.chatHeaderActions}>
        <ActionButton icon="solar:phone-linear"       size="sm" tooltip="Call" />
        <div className={styles.divider} />
        <ActionButton icon="solar:videocamera-linear" size="sm" tooltip="Video" />
        <div className={styles.divider} />
        <ActionButton icon="solar:magnifer-linear"    size="sm" tooltip="Search" />
        <div className={styles.divider} />
        <ActionButton icon="solar:info-circle-linear" size="sm" tooltip="Info" />
        <div className={styles.divider} />
        <ActionButton icon="solar:menu-dots-bold"     size="sm" tooltip="More" />
      </div>
    </div>
  );
}

import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Input } from '../../components/Input/Input';
import { getInitials, getDisplayName } from './messageUtils';
import styles from './MessagesView.module.css';

export function NewChatModal({
  modalRef,
  newChatSearch,
  filteredNewUsers,
  onSearchChange,
  onClose,
  onSelectUser,
}) {
  return (
    <div className={styles.newChatOverlay}>
      <div ref={modalRef} className={styles.newChatBox}>
        <div className={styles.newChatHeader}>
          <div className={styles.newChatTitle}>New Message</div>
          <ActionButton
            icon="solar:close-circle-linear"
            size="S"
            onClick={onClose}
          />
        </div>
        <Input
          autoFocus
          placeholder="Search by name or email…"
          value={newChatSearch}
          onChange={e => onSearchChange(e.target.value)}
          style={{ borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none', height: 40, fontSize: 14 }}
        />
        <div className={styles.newChatList}>
          {filteredNewUsers.length === 0 ? (
            <div className={styles.newChatEmpty}>
              {newChatSearch ? 'No users found' : 'No other users available yet'}
            </div>
          ) : (
            filteredNewUsers.map(p => (
              <button
                type="button"
                key={p.id}
                className={styles.newChatUser}
                onClick={() => onSelectUser(p)}
              >
                <div className={styles.convAvatar}>{getInitials(p)}</div>
                <div className={styles.newChatUserInfo}>
                  <div className={styles.newChatUserName}>{getDisplayName(p)}</div>
                  <div className={styles.newChatUserEmail}>{p.email}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

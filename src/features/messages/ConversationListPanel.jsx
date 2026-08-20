import { Icon } from '../../components/Icon/Icon';
import { Button } from '../../components/Button/Button';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Input } from '../../components/Input/Input';
import { Toggle } from '../../components/Toggle/Toggle';
import { getInitials, getDisplayName, formatTime } from './messageUtils';
import boneStyles from '../../components/TableSkeleton/TableSkeleton.module.css';
import styles from './MessagesView.module.css';

/**
 * Placeholder rows shaped like `.convItem` — avatar circle, name line,
 * preview line. Reuses the shared `.bone` shimmer rather than defining
 * another one.
 */
function ConversationSkeleton({ count = 6 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={styles.convItem} style={{ cursor: 'default' }} aria-hidden>
          <span className={boneStyles.bone} style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
          <div className={styles.convInfo}>
            <span className={boneStyles.bone} style={{ width: '55%', height: 12, display: 'block' }} />
            <span className={boneStyles.bone} style={{ width: '80%', height: 10, display: 'block', marginTop: 6 }} />
          </div>
        </div>
      ))}
    </>
  );
}

export function ConversationListPanel({
  activeChannel,
  showConversations,
  totalUnread,
  showSearch,
  searchQuery,
  filterTab,
  filteredConversations,
  loading,
  profiles,
  selectedUserId,
  onShowNewChat,
  onToggleSearch,
  onSearchChange,
  onClearSearch,
  onFilterTabChange,
  onSelectConversation,
}) {
  return (
    <div className={styles.convPanel}>
      <div className={styles.convHeader}>
        <div className={styles.convHeaderLeft}>
          <div className={styles.convHeaderTitle}>
            {activeChannel === 'all' ? 'All Conversations' : activeChannel === 'internal' ? 'Internal Chats' : 'Chats'}
          </div>
          {showConversations && totalUnread > 0 && (
            <div className={styles.convHeaderSub}>{totalUnread} unread chat{totalUnread !== 1 ? 's' : ''}</div>
          )}
        </div>
        <div className={styles.convHeaderActions}>
          <ActionButton icon="solar:pen-new-square-linear" size="S" tooltip="New chat" onClick={onShowNewChat} />
          <div className={styles.convDivider} />
          <ActionButton
            icon="solar:magnifer-linear"
            size="S"
            tooltip="Search"
            onClick={onToggleSearch}
          />
          <div className={styles.convDivider} />
          <ActionButton icon="custom:filter" size="S" tooltip="Filter" />
          <div className={styles.convDivider} />
          <ActionButton icon="solar:menu-dots-bold" size="S" tooltip="More" />
        </div>
      </div>

      <div className={styles.convTabs}>
        <Toggle
          items={[
            { key: 'all', label: 'All' },
            { key: 'unread', label: 'Unread' },
            { key: 'pinned', label: 'Pinned' },
          ]}
          active={filterTab}
          onChange={onFilterTabChange}
          size="S"
          fullWidth
        />
      </div>

      {showSearch && (
        <div className={styles.convSearch}>
          <div className={styles.convSearchWrap}>
            <span className={styles.convSearchIcon}><Icon name="solar:magnifer-linear" size={13} /></span>
            <Input
              autoFocus
              placeholder="Search conversations…"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              style={{ paddingLeft: 28, paddingRight: 30, fontSize: 'var(--font-sm)' }}
            />
            <button
              className={styles.convSearchClear}
              onClick={onClearSearch}
              aria-label="Clear search"
            >
              <Icon name="solar:close-circle-bold" size={15} />
            </button>
          </div>
        </div>
      )}

      <div className={styles.convList}>
        {!showConversations ? (
          <div className={styles.emptyConv}>
            <div className={styles.emptyConvIcon}>
              <Icon name="solar:widget-linear" size={28} />
            </div>
            <div className={styles.emptyConvText}>Coming soon</div>
          </div>
        ) : loading ? (
          /* Loading, not empty. Rendering the "No conversations yet" empty
             state while the first fetch is still in flight told the user
             they had no chats and offered them a Start-a-chat button — a
             wrong answer, stated confidently, for as long as the round-trip
             took. The skeleton is shaped like `.convItem` so the list does
             not jump when real rows replace it. */
          <ConversationSkeleton />
        ) : filteredConversations.length === 0 ? (
          <div className={styles.emptyConv}>
            <div className={styles.emptyConvIcon}>
              <Icon name="solar:chat-round-linear" size={28} />
            </div>
            <div className={styles.emptyConvText}>
              {searchQuery ? 'No conversations match your search' : 'No conversations yet'}
            </div>
            {!searchQuery && (
              <Button variant="primary" size="L" leadingIcon="solar:pen-new-square-linear" onClick={onShowNewChat}>
                Start a chat
              </Button>
            )}
          </div>
        ) : (
          filteredConversations.map(conv => {
            const profile = profiles[conv.userId];
            const isSelected = selectedUserId === conv.userId;
            return (
              <button
                type="button"
                key={conv.userId}
                aria-current={isSelected ? 'true' : undefined}
                className={[styles.convItem, isSelected ? styles.selected : ''].join(' ')}
                onClick={() => onSelectConversation(conv.userId)}
              >
                <div className={styles.convAvatar}>{getInitials(profile)}</div>
                <div className={styles.convInfo}>
                  <div className={styles.convNameRow}>
                    <div className={[styles.convName, conv.unreadCount === 0 ? styles.muted : ''].join(' ')}>
                      {getDisplayName(profile)}
                    </div>
                    <div className={styles.convTime}>{formatTime(conv.lastTime)}</div>
                  </div>
                  <div className={styles.convPreviewRow}>
                    <div className={styles.convPreview}>{conv.lastMessage}</div>
                    {conv.unreadCount > 0 && <span className={styles.convUnread}>{conv.unreadCount}</span>}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

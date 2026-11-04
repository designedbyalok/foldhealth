import { useState } from 'react';
import { Icon } from '../../components/Icon/Icon';
import { Input } from '../../components/Input/Input';
import { Toggle } from '../../components/Toggle/Toggle';
import { getInitials, getDisplayName, formatTime } from './messageUtils';
import { Skeleton } from '../../components/Skeleton/Skeleton';
import { CommsListEmpty } from './comms/CommsEmptyState';
import { CommsListHeader } from './comms/CommsListHeader';
import { FilterChip } from '../../components/FilterChip/FilterChip';
import { BulkBar } from '../../components/BulkBar/BulkBar';
import { Checkbox } from '../../components/Checkbox/Checkbox';
import commsStyles from './comms/Comms.module.css';

const ACTIVITY_FILTER = { Today: 1, 'Last 7 days': 7, 'Last 30 days': 30 };
import styles from './MessagesView.module.css';

/**
 * Placeholder rows shaped like `.convItem`, avatar circle, name line,
 * preview line, built from `Skeleton`.
 */
function ConversationSkeleton({ count = 6 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={styles.convItem} style={{ cursor: 'default' }} aria-hidden>
          <Skeleton style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
          <div className={styles.convInfo}>
            <Skeleton style={{ width: '55%', height: 12, display: 'block' }} />
            <Skeleton style={{ width: '80%', height: 10, display: 'block', marginTop: 6 }} />
          </div>
        </div>
      ))}
    </>
  );
}

const LIST_TITLES = {
  internal: 'Internal Chat',
  efax: 'eFax',
  assigned: 'Assigned to me',
  mentions: 'Mentions',
  others: 'Assigned to Others',
  unassigned: 'Unassigned',
};

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
  onToggleSearch,
  onSearchChange,
  onClearSearch,
  onFilterTabChange,
  onSelectConversation,
  onMarkRead,
  navCollapsed,
  onToggleNav,
}) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [activity, setActivity] = useState([]);
  const [activityCutoff, setActivityCutoff] = useState(0);
  const [bulk, setBulk] = useState(false);
  const [picked, setPicked] = useState([]);
  const shown = activityCutoff
    ? filteredConversations.filter(c => new Date(c.lastTime).getTime() >= activityCutoff)
    : filteredConversations;

  return (
    <div className={styles.convPanel}>
      <CommsListHeader
        title={LIST_TITLES[activeChannel] || 'Conversations'}
        sub={showConversations && totalUnread > 0 ? `${totalUnread} unread chat${totalUnread !== 1 ? 's' : ''}` : ''}
        navCollapsed={navCollapsed}
        onToggleNav={onToggleNav}
        searchActive={showSearch}
        onSearch={onToggleSearch}
        bulkActive={bulk}
        onBulk={showConversations ? () => { setBulk(v => !v); setPicked([]); } : undefined}
        filterActive={filterOpen || activity.length > 0}
        onFilter={showConversations ? () => setFilterOpen(v => !v) : undefined}
      />

      <div className={styles.convTabs}>
        <Toggle
          items={[
            { key: 'all', label: 'All' },
            { key: 'unread', label: 'Unread' },
            { key: 'pinned', label: 'Pinned' },
          ]}
          value={filterTab}
          onValueChange={onFilterTabChange}
          size="sm"
        />
      </div>

      {filterOpen && (
        <div className={commsStyles.filterRow}>
          <FilterChip
            label="Last Activity"
            singleSelect
            options={Object.keys(ACTIVITY_FILTER)}
            selected={activity}
            onChange={(v) => { setActivity(v); setActivityCutoff(v.length ? Date.now() - ACTIVITY_FILTER[v[0]] * 86400000 : 0); }}
          />
        </div>
      )}

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
          <CommsListEmpty viewKey={activeChannel} />
        ) : loading ? (
          /* Loading, not empty. Rendering the "No conversations yet" empty
             state while the first fetch is still in flight told the user
             they had no chats and offered them a Start-a-chat button, a
             wrong answer, stated confidently, for as long as the round-trip
             took. The skeleton is shaped like `.convItem` so the list does
             not jump when real rows replace it. */
          <ConversationSkeleton />
        ) : shown.length === 0 ? (
          <CommsListEmpty viewKey="internal" label={searchQuery ? 'No conversations match your search' : undefined} />
        ) : (
          shown.map(conv => {
            const profile = profiles[conv.userId];
            const isSelected = selectedUserId === conv.userId;
            return (
              <button
                type="button"
                key={conv.userId}
                aria-current={isSelected ? 'true' : undefined}
                className={[styles.convItem, isSelected ? styles.selected : ''].join(' ')}
                onClick={() => (bulk
                  ? setPicked(p => (p.includes(conv.userId) ? p.filter(x => x !== conv.userId) : [...p, conv.userId]))
                  : onSelectConversation(conv.userId))}
              >
                {bulk && (
                  <span className={commsStyles.rowCheck}>
                    <Checkbox checked={picked.includes(conv.userId)} tabIndex={-1} aria-label={`Select ${getDisplayName(profile)}`} />
                  </span>
                )}
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

      {bulk && (
        <BulkBar
          selectedIds={picked}
          onClear={() => setPicked([])}
          noun={picked.length === 1 ? 'Chat' : 'Chats'}
          actions={[
            { label: 'Mark as Read', icon: 'solar:check-read-linear', variant: 'solid', onClick: (ids) => { onMarkRead?.(ids); setPicked([]); } },
          ]}
        />
      )}
    </div>
  );
}

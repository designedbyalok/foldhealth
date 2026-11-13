import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../../components/Icon/Icon';
import { BulkBar } from '../../../components/BulkBar/BulkBar';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { toast } from '../../../components/Toast/sonnerToast';
import { Checkbox } from '../../../components/Checkbox/Checkbox';
import { Avatar } from '../../../components/Avatar/Avatar';
import { SegmentedControl } from '../../../components/SegmentedControl/SegmentedControl';
import { SearchBar } from '../../../components/SearchBar/SearchBar';
import { Skeleton } from '../../../components/Skeleton/Skeleton';
import listStyles from '../MessagesView.module.css';
import { useAppStore } from '../../../store/useAppStore';
import { membersForConversation, threadTitle } from './smsMembers';
import { formatTime } from '../messageUtils';
import { CHANNEL_META, initialsOf, isMissedCall } from './commsUtils';
import { CommsListEmpty } from './CommsEmptyState';
import { CommsListHeader } from './CommsListHeader';
import { updateConversation, markConversationRead, deleteConversation, listStaffSends, subscribeComms } from './commsRepo';
import { inDatePreset } from '../../../components/DateRangeFilter/dateRangePresets';
import { EMPTY_COMMS_FILTERS, commsFiltersActive, lastStaffSenders } from './commsFilters';
import { collaboratorsOf, inboxOf } from './commsInboxes';
import { CommsFilterChips } from './CommsFilterChips';
import { isAutoReply } from './oooAutoReply';
import { useCovering } from '../../ooo/useCovering';
import { sameName } from '../../ooo/oooUtils';
import styles from './Comms.module.css';

const CHANNEL_FILTER = { Chat: 'chat', SMS: 'sms', Calls: 'call', Email: 'email' };

/**
 * The middle column of Comms for Chat / SMS / Calls / All: the header
 * (collapse the nav, title and count, search, bulk select, filter), tabs,
 * and the conversations.
 */
export function CommsListPanel({
  channel,
  viewKey,
  title,
  showArchived = false,
  conversations,
  loading,
  selectedId,
  onSelect,
  footer,
  navCollapsed,
  onToggleNav,
}) {
  const meta = { ...CHANNEL_META[channel], ...(title ? { title } : {}) };
  const [tab, setTab] = useState('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState(EMPTY_COMMS_FILTERS);
  const setFilter = (patch) => setFilters(f => ({ ...f, ...patch }));
  const { channels } = filters;
  // The date window is fixed when the date filter is picked, not each render.
  const inDate = useMemo(() => inDatePreset(filters.datePreset, filters.dateRange), [filters.datePreset, filters.dateRange]);
  // Covering for: conversations whose inbox has someone I'm covering as a
  // collaborator (the inbox's assignees). A thread with no inbox (Chat) goes
  // by the last staff member who wrote to the patient, as for the auto-reply;
  // those messages load only while that filter is on.
  const { names: coveringNames } = useCovering();
  const [staffOf, setStaffOf] = useState(null); // conversation id → last staff sender name
  const coveringOn = filters.covering.length > 0;
  // By Inbox: the inboxes of this list's channels (SMS, email).
  const inboxes = useAppStore(s => s.commsInboxes);
  const inboxSample = useAppStore(s => s.commsInboxesTableMissing);
  const fetchCommsInboxes = useAppStore(s => s.fetchCommsInboxes);
  const platformUsers = useAppStore(s => s.platformUsers);
  useEffect(() => { fetchCommsInboxes(); }, [fetchCommsInboxes]);
  const listInboxChannels = channel === 'all' ? ['sms', 'email'] : [channel];
  const inboxOptions = inboxes.filter(i => listInboxChannels.includes(i.channel));
  const inboxById = useMemo(() => new Map(inboxes.map(i => [i.id, i])), [inboxes]);
  const coversThread = (c, name) => {
    const inbox = inboxById.get(inboxOf(c, inboxSample));
    if (inbox) return collaboratorsOf(inbox, platformUsers || []).some(u => sameName(u.name, name));
    return sameName(staffOf?.get(c.id), name);
  };
  // Only threads with no inbox need their senders, and only their staff
  // messages' names. Keyed by those ids, so a conversation's preview or unread
  // count changing doesn't refetch; new staff messages update it live.
  const noInboxKey = coveringOn
    ? conversations.filter(c => !inboxById.get(inboxOf(c, inboxSample))).map(c => c.id).sort().join(',')
    : '';
  useEffect(() => {
    if (!noInboxKey) return undefined;
    const ids = noInboxKey.split(',');
    let live = true;
    listStaffSends(ids)
      .then(rows => live && setStaffOf(lastStaffSenders(rows)))
      .catch(() => live && setStaffOf(new Map()));
    const off = subscribeComms(({ table, type, row } = {}) => {
      if (table !== 'patient_messages' || type !== 'INSERT' || !row || !ids.includes(row.conversation_id)) return;
      if (row.direction !== 'out' || row.internal || isAutoReply(row) || !row.sender_name) return;
      setStaffOf(prev => new Map(prev || []).set(row.conversation_id, row.sender_name));
    });
    return () => { live = false; off(); };
  }, [noInboxKey]);
  const [bulk, setBulk] = useState(false);
  const [picked, setPicked] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const mixed = channel === 'all';

  const tabs = channel === 'call'
    ? [{ key: 'all', label: 'All' }, { key: 'unanswered', label: 'Unanswered' }, { key: 'pinned', label: 'Pinned' }]
    : [{ key: 'all', label: 'All' }, { key: 'unread', label: 'Unread' }, { key: 'pinned', label: 'Pinned' }];

  // Shared SMS numbers read "Annette, Liam, +1" or their custom name, and search
  // finds them by that name or any member's.
  const patients = useAppStore(s => s.allPatients);
  const smsMembers = useMemo(() => new Map(conversations
    .filter(c => c.channel === 'sms')
    .map(c => [c.id, membersForConversation(c, patients || [])])), [conversations, patients]);
  const titleOf = (c) => (c.channel === 'sms' ? threadTitle(c, smsMembers.get(c.id), { max: 2 }) : c.patient_name || 'Unknown');

  const q = query.trim().toLowerCase();
  const list = conversations.filter((c) => {
    if (!!c.archived !== showArchived) return false;
    if (tab === 'unread' && !c.unread_count) return false;
    if (tab === 'unanswered' && !isMissedCall(c)) return false;
    if (tab === 'pinned' && !c.pinned) return false;
    if (channels.length && !channels.some(k => CHANNEL_FILTER[k] === c.channel)) return false;
    if (filters.datePreset && !inDate(c.last_message_at)) return false;
    if (coveringOn && !filters.covering.some(n => coversThread(c, n))) return false;
    if (filters.inbox && inboxOf(c, inboxSample) !== filters.inbox) return false;
    if (!q) return true;
    const memberNames = (smsMembers.get(c.id) || []).map(m => m.name).join(' ');
    return `${c.patient_name} ${c.thread_name || ''} ${memberNames} ${c.group_name || ''} ${c.last_preview} ${c.patient_phone || ''}`.toLowerCase().includes(q);
  });

  const unread = conversations.filter(c => !!c.archived === showArchived && c.unread_count > 0).length;
  const missed = conversations.filter(c => !!c.archived === showArchived && isMissedCall(c)).length;
  const sub = channel === 'call'
    ? (missed ? `${missed} Missed Call${missed === 1 ? '' : 's'}` : '')
    : (unread ? `${unread} unread ${meta.noun}${unread === 1 || meta.noun === 'SMS' ? '' : 's'}` : '');

  return (
    <div className={listStyles.convPanel}>
      <CommsListHeader
        title={meta.title}
        sub={sub}
        navCollapsed={navCollapsed}
        onToggleNav={onToggleNav}
        searchActive={searchOpen}
        onSearch={() => { setSearchOpen(v => !v); setQuery(''); }}
        bulkActive={bulk}
        onBulk={() => { setBulk(v => !v); setPicked([]); }}
        filterActive={filterOpen || commsFiltersActive(filters)}
        onFilter={() => setFilterOpen(v => !v)}
      />

      <div className={listStyles.convTabs}>
        <SegmentedControl items={tabs} value={tab} onValueChange={setTab} size="sm" />
      </div>

      {filterOpen && (
        <CommsFilterChips
          filters={filters}
          onChange={setFilter}
          inboxes={inboxOptions}
          channels={mixed ? Object.keys(CHANNEL_FILTER) : []}
          coveringNames={coveringNames}
        />
      )}

      {searchOpen && (
        <div className={styles.listSearch}>
          <SearchBar
            placeholder={`Search ${meta.title.toLowerCase()}`}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onClose={() => { setSearchOpen(false); setQuery(''); }}
          />
        </div>
      )}

      <div className={listStyles.convList}>
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={listStyles.convItem} aria-hidden>
              <Skeleton className={styles.boneAvatar} />
              <div className={listStyles.convInfo}>
                <Skeleton className={styles.boneLine} />
                <Skeleton className={styles.boneLineShort} />
              </div>
            </div>
          ))
        ) : list.length === 0 ? (
          <CommsListEmpty
            viewKey={viewKey}
            label={q ? 'No conversations match your search' : tab === 'all' ? undefined : `No ${tabs.find(t => t.key === tab)?.label} Conversations`}
          />
        ) : list.map(c => (
          <button
            type="button"
            key={c.id}
            aria-current={selectedId === c.id ? 'true' : undefined}
            className={[listStyles.convItem, selectedId === c.id ? listStyles.selected : ''].join(' ')}
            onClick={() => (bulk
              ? setPicked(p => (p.includes(c.id) ? p.filter(x => x !== c.id) : [...p, c.id]))
              : onSelect(c))}
          >
            {bulk && (
              <span className={styles.rowCheck}>
                <Checkbox checked={picked.includes(c.id)} tabIndex={-1} aria-label={`Select ${c.patient_name}`} />
              </span>
            )}
            {c.channel === 'call' ? (
              <span className={[styles.callAvatar, isMissedCall(c) ? styles.callAvatarMissed : ''].join(' ')}>
                <Icon name={isMissedCall(c) ? 'solar:end-call-rounded-linear' : 'solar:phone-calling-linear'} size={18} />
              </span>
            ) : (
              (smsMembers.get(c.id)?.length > 1
                ? <Avatar variant="patient" type="icon" iconName="solar:users-group-rounded-linear" size={36} />
                : <Avatar variant="patient" size={36} initials={initialsOf(c.patient_name)} />)
            )}
            <div className={listStyles.convInfo}>
              <div className={listStyles.convNameRow}>
                <div className={[listStyles.convName, c.unread_count ? '' : listStyles.muted].join(' ')}>
                  {titleOf(c)}
                </div>
                {channel === 'all' && <Icon name={CHANNEL_META[c.channel]?.icon} size={12} color="var(--neutral-300)" />}
                <div className={listStyles.convTime}>{formatTime(c.last_message_at)}</div>
              </div>
              <div className={listStyles.convPreviewRow}>
                <div className={[listStyles.convPreview, isMissedCall(c) ? styles.previewMissed : ''].join(' ')}>
                  {c.last_preview || (c.subject ? c.subject : 'No messages yet')}
                </div>
                {c.unread_count > 0 && <span className={listStyles.convUnread}>{c.unread_count}</span>}
              </div>
            </div>
          </button>
        ))}
      </div>

      {footer}

      {bulk && (
        <BulkBar
          selectedIds={picked}
          onClear={() => setPicked([])}
          noun={picked.length === 1 ? 'Conversation' : 'Conversations'}
          actions={[
            { label: 'Mark as Read', icon: 'solar:check-read-linear', variant: 'outline', onClick: (ids) => { ids.forEach(id => markConversationRead(conversations.find(c => c.id === id))); setPicked([]); } },
            { label: 'Pin', icon: 'solar:pin-linear', variant: 'outline', onClick: (ids) => { ids.forEach(id => updateConversation(id, { pinned: true })); setPicked([]); } },
            { label: showArchived ? 'Unarchive' : 'Archive', icon: 'solar:archive-linear', variant: 'solid', onClick: (ids) => { ids.forEach(id => updateConversation(id, { archived: !showArchived })); setPicked([]); } },
            { label: 'Delete', icon: 'solar:trash-bin-minimalistic-linear', variant: 'soft', tone: 'danger', onClick: () => setConfirmDelete(true) },
          ]}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          variant="destructive"
          title={`Delete ${picked.length} ${picked.length === 1 ? 'conversation' : 'conversations'}?`}
          description="Every message in them is removed for everyone, permanently. This can't be undone."
          confirmLabel="Delete"
          cancelLabel="Cancel"
          loading={deleting}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            setDeleting(true);
            const ids = [...picked];
            const results = await Promise.allSettled(ids.map(id => deleteConversation(id)));
            const failed = results.filter(r => r.status === 'rejected').length;
            if (failed) toast.error(`${failed} of ${ids.length} could not be deleted.`);
            else toast.success(ids.length === 1 ? 'Conversation Deleted Successfully' : 'Conversations Deleted Successfully');
            setPicked([]);
            setDeleting(false);
            setConfirmDelete(false);
          }}
        />
      )}
    </div>
  );
}

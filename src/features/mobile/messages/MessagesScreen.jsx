import { useMemo, useState } from 'react';
import { Avatar } from '../../../components/Avatar/Avatar';
import { BottomSheet, BottomSheetItem } from '../../../components/BottomSheet/BottomSheet';
import { Button } from '../../../components/Button/Button';
import { FilterChip } from '../../../components/FilterChip/FilterChip';
import { Icon } from '../../../components/Icon/Icon';
import { Input } from '../../../components/Input/Input';
import { SegmentedControl } from '../../../components/SegmentedControl/SegmentedControl';
import { toast } from '../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../store/useAppStore';
import { markConversationRead, updateConversation } from '../../messages/comms/commsRepo';
import { useCommsConversations } from '../../messages/comms/useComms';
import { membersForConversation } from '../../messages/comms/smsMembers';
import { getDisplayName, getInitials } from '../../messages/messageUtils';
import { MobileRootHeader } from '../MobileHeader';
import { MobileEmpty, MobileListSkeleton, CountBadge } from '../MobileParts';
import { useMobileNav } from '../MobileNavContext';
import { conversationTitle, listStamp } from '../mobileFormat';
import { markInternalRead, useInternalConversations, useStaffProfiles } from './useInternalChats';
import { useLongPress } from './useLongPress';
import styles from '../mobile.module.css';
import own from './MessagesScreen.module.css';

// Channels a provider messages on from the phone (calls live under Calls).
const CHANNELS = [
  { key: 'all', label: 'All', leadingIcon: 'solar:inbox-linear' },
  { key: 'chat', label: 'Chats', leadingIcon: 'solar:chat-round-linear' },
  { key: 'sms', label: 'SMS', leadingIcon: 'solar:chat-square-linear' },
  { key: 'email', label: 'Emails', leadingIcon: 'solar:letter-linear' },
];
const CHANNEL_ICON = { chat: 'solar:chat-round-linear', sms: 'solar:chat-square-linear', email: 'solar:letter-linear' };
const ASSIGNED_TO_ME = 'Assigned to me';
// Desktop CommsListPanel tabs (All / Unread / Pinned) and the Archived view.
const SHOW_MEMBERS = ['Unread', 'Pinned', 'Archived'];
// Desktop Internal Chat filters by Unread only.
const SHOW_INTERNAL = ['Unread'];

// Desktop Create New, minus Voice Call (that's the Calls tab's dialer).
const CREATE = [
  { key: 'chat', icon: 'solar:chat-round-linear', label: 'New Chat' },
  { key: 'sms', icon: 'solar:chat-square-linear', label: 'New SMS' },
  { key: 'email', icon: 'solar:letter-linear', label: 'New Email' },
  { key: 'internal', icon: 'solar:user-speak-linear', label: 'Internal Chat' },
];

/** Member conversations across chat, SMS and email, and internal staff chat (Figma 759:22704). */
export function MessagesScreen() {
  const { push } = useMobileNav();
  const me = useAppStore(s => s.currentUserProfile);
  const patients = useAppStore(s => s.allPatients);
  const { conversations, loading, failed, retry } = useCommsConversations();
  const [audience, setAudience] = useState('members');
  const [channel, setChannel] = useState('all');
  const [assigned, setAssigned] = useState([]);
  const [show, setShow] = useState([]);
  const [query, setQuery] = useState('');
  const [actionsFor, setActionsFor] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const internal = audience === 'internal';
  const view = show[0] || 'All';
  const q = query.trim().toLowerCase();

  // Same client filter as desktop CommsListPanel.
  const shown = useMemo(() => conversations.filter((c) => {
    if (c.channel === 'call') return false;
    if (!!c.archived !== (view === 'Archived')) return false;
    if (view === 'Unread' && !c.unread_count) return false;
    if (view === 'Pinned' && !c.pinned) return false;
    if (channel !== 'all' && c.channel !== channel) return false;
    if (assigned.length && !(me?.id && String(c.assigned_to) === String(me.id))) return false;
    if (!q) return true;
    const memberNames = c.channel === 'sms' ? membersForConversation(c, patients || []).map(m => m.name).join(' ') : '';
    return `${c.patient_name} ${c.thread_name || ''} ${memberNames} ${c.group_name || ''} ${c.last_preview} ${c.patient_phone || ''}`.toLowerCase().includes(q);
  }), [conversations, channel, assigned, me, view, q, patients]);

  const switchAudience = (a) => { setAudience(a); setShow([]); };
  const create = (key) => {
    setCreateOpen(false);
    if (key === 'chat' || key === 'internal') push('newChat', { initialType: key === 'internal' ? 'internal' : 'patient' });
    if (key === 'sms') push('newSms');
    if (key === 'email') push('composeEmail');
  };

  return (
    <div className={styles.screen}>
      <MobileRootHeader title="Messages" />
      <div className={styles.search}>
        <Input
          leadingIcon="solar:magnifer-linear"
          size="lg"
          type="search"
          placeholder="Search"
          enterKeyHint="search"
          aria-label={internal ? 'Search internal chats' : 'Search conversations'}
          value={query}
          onValueChange={setQuery}
        />
      </div>
      <div className={styles.toolbar}>
        <SegmentedControl
          size="lg"
          aria-label="Conversations with"
          value={audience}
          onValueChange={switchAudience}
          items={[{ key: 'members', label: 'Members' }, { key: 'internal', label: 'Internal' }]}
        />
        <div className={`${styles.toolbarEnd} ${own.filters}`}>
          {!internal && <FilterChip label="Assigned" options={[ASSIGNED_TO_ME]} selected={assigned} onChange={setAssigned} singleSelect />}
          <FilterChip label="Show" options={internal ? SHOW_INTERNAL : SHOW_MEMBERS} selected={show} onChange={setShow} singleSelect />
        </div>
      </div>
      <div className={styles.bodyWrap}>
        <div className={styles.body}>
          {internal ? <InternalList meId={me?.id} query={q} unreadOnly={view === 'Unread'} /> : (
            <>
              <div className={styles.channelBar}>
                <SegmentedControl size="lg" variant="ghost" fullWidth aria-label="Channel" value={channel} onValueChange={setChannel} items={CHANNELS} />
              </div>
              {loading ? <MobileListSkeleton /> : failed ? (
                <MobileEmpty icon="solar:danger-circle-linear" title="Couldn't load messages" action={<Button size="lg" variant="outline" onClick={retry}>Try again</Button>} />
              ) : shown.length === 0 ? (
                <MobileEmpty
                  icon={view === 'Archived' ? 'solar:archive-linear' : 'solar:chat-round-linear'}
                  title={q ? 'No conversations match your search' : view === 'All' ? 'No conversations' : `No ${view} Conversations`}
                  description={q || view !== 'All' ? undefined : 'Start one with the button below.'}
                />
              ) : (
                <div className={`${styles.list} ${styles.listAfterBar}`}>
                  {shown.map(c => (
                    <ConversationRow key={c.id} conversation={c} onOpen={() => push('thread', { conversation: c })} onActions={() => setActionsFor(c)} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <button type="button" className={styles.fab} aria-label="New message" onClick={() => (internal ? push('newChat', { initialType: 'internal' }) : setCreateOpen(true))}>
          <Icon name="solar:chat-round-line-linear" size={32} color="currentColor" />
        </button>
      </div>
      {actionsFor && <ConversationActions conversation={actionsFor} onClose={() => setActionsFor(null)} />}
      {createOpen && (
        <BottomSheet title="Create New" onClose={() => setCreateOpen(false)}>
          {CREATE.map(item => <BottomSheetItem key={item.key} icon={item.icon} label={item.label} onClick={() => create(item.key)} />)}
        </BottomSheet>
      )}
    </div>
  );
}

function ConversationRow({ conversation: c, onOpen, onActions }) {
  const { handlers, guard } = useLongPress(onActions);
  return (
    <button type="button" className={`${styles.card} ${own.row}`} onClick={guard(onOpen)} {...handlers}>
      <Avatar
        type="icon"
        variant="primary"
        iconName={(c.members?.length > 1) ? 'solar:users-group-rounded-linear' : CHANNEL_ICON[c.channel] || 'solar:chat-round-linear'}
        size="XL"
      />
      <span className={styles.cardText}>
        <span className={[styles.primaryText, c.unread_count ? styles.strong : ''].join(' ')}>{conversationTitle(c)}</span>
        <span className={styles.secondaryText}>{c.last_preview || c.subject || 'No messages yet'}</span>
      </span>
      <span className={styles.cardEnd}>
        <span className={styles.metaText}>{listStamp(c.last_message_at)}</span>
        <span className={styles.cardEndRow}>
          {c.pinned && <Icon name="solar:pin-linear" size={16} className={own.pin} aria-label="Pinned" />}
          <CountBadge value={c.unread_count} />
        </span>
      </span>
    </button>
  );
}

/** Press-and-hold actions on a conversation (Figma 1041:44202), desktop's bulk / More actions. */
function ConversationActions({ conversation: c, onClose }) {
  const run = async (fn, done) => {
    onClose();
    try { await fn(); toast.success(done); } catch (err) { toast.error(err?.message || 'Could not update the conversation.'); }
  };
  return (
    <BottomSheet title="Actions" onClose={onClose}>
      <BottomSheetItem icon="solar:pin-linear" label={c.pinned ? 'Unpin' : 'Pin'} onClick={() => run(() => updateConversation(c.id, { pinned: !c.pinned }), c.pinned ? 'Unpinned Successfully' : 'Pinned Successfully')} />
      <BottomSheetItem icon="solar:archive-down-linear" label={c.archived ? 'Unarchive' : 'Archive'} onClick={() => run(() => updateConversation(c.id, { archived: !c.archived }), c.archived ? 'Unarchived Successfully' : 'Archived Successfully')} />
      {c.unread_count > 0 ? (
        <BottomSheetItem icon="solar:eye-linear" label="Mark as Read" onClick={() => run(() => markConversationRead(c), 'Marked As Read Successfully')} />
      ) : (
        <BottomSheetItem icon="solar:eye-closed-linear" label="Mark as Unread" onClick={() => run(() => updateConversation(c.id, { unread_count: Math.max(1, c.unread_count || 0) }), 'Marked As Unread Successfully')} />
      )}
    </BottomSheet>
  );
}

/** Staff-to-staff chats (desktop Internal Chat), one per person. */
function InternalList({ meId, query, unreadOnly }) {
  const { push } = useMobileNav();
  const profiles = useStaffProfiles();
  const byId = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles]);
  const { list, loading, reload } = useInternalConversations(meId);
  const [actionsFor, setActionsFor] = useState(null);

  const shown = list.filter((conv) => {
    if (unreadOnly && !conv.unreadCount) return false;
    if (!query) return true;
    const p = byId.get(conv.userId);
    return getDisplayName(p).toLowerCase().includes(query) || (p?.email || '').toLowerCase().includes(query);
  });

  if (loading) return <MobileListSkeleton />;
  if (!shown.length) {
    return (
      <MobileEmpty
        icon="solar:users-group-rounded-linear"
        title={query ? 'No chats match your search' : unreadOnly ? 'No Unread Chats' : 'No internal chats yet'}
        description={query || unreadOnly ? undefined : 'Message someone on your team with the button below.'}
      />
    );
  }
  return (
    <>
      <div className={styles.list}>
        {shown.map(conv => (
          <InternalRow
            key={conv.userId}
            conv={conv}
            profile={byId.get(conv.userId)}
            onOpen={() => push('internalThread', { userId: conv.userId, profile: byId.get(conv.userId) })}
            onActions={() => setActionsFor(conv)}
          />
        ))}
      </div>
      {actionsFor && (
        <BottomSheet title="Actions" onClose={() => setActionsFor(null)}>
          <BottomSheetItem
            icon="solar:eye-linear"
            label="Mark as Read"
            disabled={!actionsFor.unreadCount}
            onClick={async () => {
              const id = actionsFor.userId;
              setActionsFor(null);
              await markInternalRead(meId, [id]);
              reload();
              toast.success('Marked As Read Successfully');
            }}
          />
        </BottomSheet>
      )}
    </>
  );
}

function InternalRow({ conv, profile, onOpen, onActions }) {
  const { handlers, guard } = useLongPress(onActions);
  return (
    <button type="button" className={`${styles.card} ${own.row}`} onClick={guard(onOpen)} {...handlers}>
      <Avatar variant="staff" size="XL" initials={getInitials(profile)} />
      <span className={styles.cardText}>
        <span className={[styles.primaryText, conv.unreadCount ? styles.strong : ''].join(' ')}>{getDisplayName(profile)}</span>
        <span className={styles.secondaryText}>{conv.lastMessage || ' '}</span>
      </span>
      <span className={styles.cardEnd}>
        <span className={styles.metaText}>{listStamp(conv.lastTime)}</span>
        <CountBadge value={conv.unreadCount} />
      </span>
    </button>
  );
}

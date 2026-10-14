import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Icon } from '../../components/Icon/Icon';
import { MissedCallIcon } from '../../components/Icon/MissedCallIcon';
import { createPortal } from 'react-dom';
import { TopBar } from '../../components/TopBar/TopBar';
import { useFloatingSubNavSlot } from '../../components/FloatingSidebar/floatingSubNavSlot';
import { Button } from '../../components/Button/Button';
import { SideNav } from '../../components/SideNav/SideNav';
import { useAppStore } from '../../store/useAppStore';
import { ChatArea } from './ChatArea';
import { ConversationListPanel } from './ConversationListPanel';
import { EmailWorkspace } from './email/EmailWorkspace';
import { useReferralEmails } from './email/useReferralEmails';
import { getDisplayName } from './messageUtils';
import { MenuPopover } from '../../components/MenuPopover/MenuPopover';
import { useCommsConversations } from './comms/useComms';
import { useCommsPeople } from './comms/useCommsPeople';
import { CommsWorkspace } from './comms/CommsWorkspace';
import { isMissedCall } from './comms/commsUtils';
import { CommsPanelEmpty } from './comms/CommsEmptyState';
import styles from './MessagesView.module.css';

const INBOX_ITEMS = [
  { id: 'assigned',    icon: 'solar:user-check-linear',         label: 'Assigned to me' },
  { id: 'mentions',   icon: 'solar:mention-square-linear',      label: 'Mentions' },
  { id: 'others',     icon: 'solar:users-group-rounded-linear', label: 'Assigned to Others' },
  { id: 'unassigned', icon: 'solar:user-cross-linear',          label: 'Unassigned' },
  { id: 'missed',     icon: 'solar:call-missed-linear',         label: 'Missed Calls', isCustomIcon: true },
  { id: 'starred',    icon: 'solar:star-linear',                label: 'Starred' },
  { id: 'archived',   icon: 'solar:archive-linear',             label: 'Archived' },
];

// Views backed by patient conversations (Chat, SMS, Calls and the inbox
// filters that apply to them). Internal Chat stays staff-to-staff.
const COMMS_VIEWS = new Set(['all', 'chat', 'sms', 'calls', 'missed', 'starred', 'archived']);

const CREATE_ITEMS = [
  { key: 'chat',  icon: 'solar:chat-round-linear',      label: 'New Chat' },
  { key: 'sms',   icon: 'solar:chat-square-linear',     label: 'New SMS' },
  { key: 'email', icon: 'solar:letter-linear',          label: 'New Email' },
  { key: 'call',  icon: 'solar:phone-calling-linear',   label: 'Voice Call' },
  { key: 'internal', icon: 'solar:user-speak-linear',   label: 'Internal Chat' },
];

const CHANNEL_ITEMS = [
  { id: 'all',      icon: 'solar:chat-round-call-linear', label: 'All Conversations' },
  { id: 'chat',     icon: 'solar:chat-round-linear',      label: 'Chat' },
  { id: 'sms',      icon: 'solar:chat-square-linear',     label: 'SMS' },
  { id: 'calls',    icon: 'solar:phone-calling-linear',   label: 'Calls' },
  { id: 'email',    icon: 'solar:letter-linear',          label: 'Email' },
  { id: 'efax',     icon: 'solar:printer-linear',         label: 'E-fax' },
  { id: 'internal', icon: 'solar:user-speak-linear',      label: 'Internal Chat' },
];

export function MessagesView() {
  const msgSidebarShape = useAppStore(s => s.sidebarShape);
  const msgFloatingSlot = useFloatingSubNavSlot();
  const msgFloating = msgSidebarShape === 'floating' && msgFloatingSlot;
  const setMessagesUnreadCount = useAppStore(s => s.setMessagesUnreadCount);
  const pendingChatUserEmail = useAppStore(s => s.pendingChatUserEmail);
  const setPendingChatUserEmail = useAppStore(s => s.setPendingChatUserEmail);
  const addNotification = useAppStore(s => s.addNotification);
  const pendingEmailReferralId = useAppStore(s => s.pendingEmailReferralId);
  const fetchCaregapReferrals = useAppStore(s => s.fetchCaregapReferrals);
  const { unread: unreadEmails } = useReferralEmails();

  const [currentUser, setCurrentUser]     = useState(null);
  const [profiles, setProfiles]           = useState({});
  const [allProfiles, setAllProfiles]     = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [filterTab, setFilterTab]         = useState('all');
  const [activeChannel, setActiveChannel] = useState('chat');
  const [searchQuery, setSearchQuery]     = useState('');
  const [convRefreshKey, setConvRefreshKey] = useState(0);
  // Starts true so the very first paint is a skeleton, not the empty state.
  // Only the FIRST load flips it — background refreshes (a realtime nudge
  // bumping convRefreshKey) must not blank a list the user is reading.
  const [convLoading, setConvLoading] = useState(true);
  const [showSearch, setShowSearch]       = useState(false);
  const createBtnRef = useRef(null);
  const [createOpen, setCreateOpen] = useState(false);
  // The Comms menu folds to an icon rail from the list header's collapse button.
  const [navCollapsed, setNavCollapsed] = useState(false);
  const toggleNav = () => setNavCollapsed(v => !v);
  const openCommsDrawer = useAppStore(s => s.openCommsDrawer);
  const commsFocus = useAppStore(s => s.commsFocus);
  const [seenCommsFocus, setSeenCommsFocus] = useState(null);
  const [selectedCommsId, setSelectedCommsId] = useState(null);
  const [emailFocusConvId, setEmailFocusConvId] = useState(null);
  const { conversations: commsConversations, loading: commsLoading } = useCommsConversations();
  const { patients, me } = useCommsPeople();

  // getSession() reads the persisted session locally; getUser() makes a
  // network call to re-validate it. Nothing here needs re-validation — the
  // app is already behind an auth gate and only `user.id` is used — and that
  // round-trip measured ~131ms during which `loadConversations` could not
  // even start, because it is gated on `currentUser`. That was the single
  // biggest cost in getting the chat list on screen.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data?.session?.user;
      if (user) setCurrentUser(user);
      else setConvLoading(false); // signed out: nothing to load, don't hang on a skeleton
    });
  }, []);

  // Named columns instead of `*`: the full row set measured 43.7KB across 57
  // profiles versus 9.4KB for the fields the chat list and New Chat actually
  // read. Everything else on the row (clinical roles, authz fields, tour
  // state) is dead weight on this path.
  const refreshProfiles = useCallback(() => {
    supabase.from('profiles')
      .select('id, full_name, first_name, last_name, email, avatar_url')
      .then(({ data, error }) => {
        if (error) {
          console.warn('[MessagesView] profiles fetch failed — chat names will show as "Unknown" and New Chat list will be empty.', error);
          return;
        }
        setAllProfiles(data || []);
        const map = {};
        (data || []).forEach(p => { map[p.id] = p; });
        setProfiles(map);
      });
  }, []);

  useEffect(() => { refreshProfiles(); }, [refreshProfiles]);

  useEffect(() => {
    const ch = supabase
      .channel('profiles-watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, refreshProfiles)
      .subscribe();
    return () => ch.unsubscribe();
  }, [refreshProfiles]);

  const loadConversations = useCallback(async () => {
    if (!currentUser) return;
    // Named columns rather than `*` — the reduce below only reads these five,
    // and `*` drags any media/attachment columns along for every message in
    // the history.
    const { data } = await supabase
      .from('direct_messages')
      .select('sender_id, recipient_id, content, created_at, read_at')
      .or(`sender_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`)
      .order('created_at', { ascending: false });

    // Clear the skeleton even on a failed/empty fetch, otherwise an error
    // leaves the panel shimmering forever with no way out.
    setConvLoading(false);
    if (!data) return;

    const convMap = {};
    data.forEach(msg => {
      const otherId = msg.sender_id === currentUser.id ? msg.recipient_id : msg.sender_id;
      if (!convMap[otherId]) {
        convMap[otherId] = { userId: otherId, lastMessage: msg.content, lastTime: msg.created_at, unreadCount: 0 };
      }
      if (msg.recipient_id === currentUser.id && !msg.read_at) {
        convMap[otherId].unreadCount++;
      }
    });

    const convList = Object.values(convMap).sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));
    setConversations(convList);

    const total = convList.reduce((sum, c) => sum + c.unreadCount, 0);
    setMessagesUnreadCount(total);
  }, [currentUser, setMessagesUnreadCount]);

  useEffect(() => {
    if (currentUser) loadConversations();
  }, [currentUser, loadConversations, convRefreshKey]);

  useEffect(() => {
    if (!currentUser) return;
    const ch = supabase
      .channel('msg-inbox')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'direct_messages',
        filter: `recipient_id=eq.${currentUser.id}`,
      }, (payload) => {
        setConvRefreshKey(k => k + 1);
        // Fire a bell notification for the arrival — but not if I'm
        // already looking at the chat with that sender (the message will
        // land in the open view; nothing to announce). Also skip echoes
        // where I somehow received my own message.
        const row = payload?.new;
        if (!row || row.read_at) return;
        if (row.sender_id === currentUser.id) return;
        if (row.sender_id === selectedUserId) return;
        const sender = allProfiles.find(p => p.id === row.sender_id);
        const senderName = sender ? getDisplayName(sender) : 'Someone';
        const preview = (row.content || '').slice(0, 90);
        addNotification?.({
          type: 'message.received',
          title: `New message from ${senderName}`,
          body: preview || (row.media_type ? 'Sent an attachment' : ''),
          action: 'openChat',
          chatUserEmail: sender?.email || null,
        });
      })
      .subscribe();
    return () => ch.unsubscribe();
  }, [currentUser, selectedUserId, allProfiles, addNotification]);

  const handleConversationUpdate = useCallback(() => setConvRefreshKey(k => k + 1), []);

  useEffect(() => {
    if (!pendingChatUserEmail || !allProfiles.length) return;
    const match = allProfiles.find(p => p.email === pendingChatUserEmail);
    if (match) {
      setProfiles(prev => ({ ...prev, [match.id]: match }));
      setSelectedUserId(match.id);
      setActiveChannel('internal');
    }
    setPendingChatUserEmail(null);
  }, [pendingChatUserEmail, allProfiles, setPendingChatUserEmail]);

  // Email count in the channel list needs referrals loaded before the Email
  // channel is opened; a referral-email notification switches to it.
  useEffect(() => { fetchCaregapReferrals(); }, [fetchCaregapReferrals]);
  const [seenEmailReferralId, setSeenEmailReferralId] = useState(null);
  if (pendingEmailReferralId && pendingEmailReferralId !== seenEmailReferralId) {
    setSeenEmailReferralId(pendingEmailReferralId);
    setActiveChannel('email');
  }

  const showConversations = activeChannel === 'internal';

  const filteredConversations = conversations.filter(conv => {
    if (filterTab === 'unread' && conv.unreadCount === 0) return false;
    if (!searchQuery) return true;
    const profile = profiles[conv.userId];
    const q = searchQuery.toLowerCase();
    return getDisplayName(profile).toLowerCase().includes(q) || (profile?.email || '').toLowerCase().includes(q);
  });

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  const selectedProfile = selectedUserId ? profiles[selectedUserId] : null;

  const openConversation = (userId) => setSelectedUserId(userId);
  // Bulk "Mark as Read" on Internal Chat: everything those people sent me.
  const markInternalRead = async (userIds) => {
    if (!currentUser || !userIds.length) return;
    await supabase.from('direct_messages').update({ read_at: new Date().toISOString() })
      .in('sender_id', userIds).eq('recipient_id', currentUser.id).is('read_at', null);
    handleConversationUpdate();
  };

  const openCreate = (key, props = {}) => {
    setCreateOpen(false);
    openCommsDrawer(key, key === 'internal' ? { initialType: 'internal' } : props);
  };
  const compose = (initial) => openCommsDrawer('email', { initial });

  // After a new chat / SMS / email (from here or the top bar), land on it.
  if (commsFocus && commsFocus !== seenCommsFocus) {
    setSeenCommsFocus(commsFocus);
    if (commsFocus.channel === 'email') {
      setActiveChannel('email');
      setEmailFocusConvId(commsFocus.conversationId);
    } else {
      setActiveChannel(commsFocus.channel === 'call' ? 'calls' : commsFocus.channel);
      setSelectedCommsId(commsFocus.conversationId);
    }
  }

  const live = commsConversations.filter(c => !c.archived);
  const unreadIn = (pick) => live.filter(c => pick(c) && c.unread_count > 0).length;
  const commsCounts = {
    all: unreadIn(() => true),
    chat: unreadIn(c => c.channel === 'chat'),
    sms: unreadIn(c => c.channel === 'sms'),
    calls: unreadIn(c => c.channel === 'call'),
    missed: live.filter(isMissedCall).length,
    email: (unreadEmails || 0) + unreadIn(c => c.channel === 'email'),
  };

  return (
    <div className={styles.page}>
      <TopBar />

      <div className={styles.panels}>
        {(() => {
          const sideNavEl = (
            <SideNav
              width={msgFloating ? '100%' : 200}
              sectionLabelVariant="sentence"
              collapsed={navCollapsed}
              header={
                <Button
                  variant="primary"
                  size="L"
                  leadingIcon="solar:add-circle-bold"
                  fullWidth
                  iconOnly={navCollapsed}
                  aria-label="Create New"
                  ref={createBtnRef}
                  onClick={() => setCreateOpen(v => !v)}
                >
                  {navCollapsed ? null : 'Create New'}
                </Button>
              }
              sections={[
                {
                  key: 'inbox',
                  label: 'Inbox',
                  items: INBOX_ITEMS.map(item => ({
                    key: item.id,
                    label: item.label,
                    icon: item.isCustomIcon ? undefined : item.icon,
                    iconElement: item.isCustomIcon
                      ? <MissedCallIcon size={16} color={activeChannel === item.id ? 'var(--primary-300)' : 'var(--neutral-300)'} />
                      : undefined,
                    count: commsCounts[item.id] || undefined,
                  })),
                },
                {
                  key: 'channels',
                  label: 'Channels',
                  items: CHANNEL_ITEMS.map(item => ({
                    key: item.id,
                    label: item.label,
                    icon: item.icon,
                    count: item.id === 'internal'
                      ? (totalUnread || undefined)
                      : (commsCounts[item.id] || undefined),
                  })),
                },
              ]}
              activeKey={activeChannel}
              onSelect={setActiveChannel}
            />
          );
          return msgFloating ? createPortal(sideNavEl, msgFloatingSlot) : sideNavEl;
        })()}

        {activeChannel === 'email' ? (
          <EmailWorkspace
            onCompose={compose}
            selectConversationId={emailFocusConvId}
            onSelectedConversation={() => setEmailFocusConvId(null)}
            navCollapsed={navCollapsed}
            onToggleNav={toggleNav}
          />
        ) : COMMS_VIEWS.has(activeChannel) ? (
          <CommsWorkspace
            view={activeChannel}
            conversations={commsConversations}
            loading={commsLoading}
            patients={patients}
            me={me}
            selectedId={selectedCommsId}
            onSelect={setSelectedCommsId}
            onCreate={() => openCreate(activeChannel === 'sms' ? 'sms' : activeChannel === 'calls' || activeChannel === 'missed' ? 'call' : 'chat')}
            onCreateType={openCreate}
            navCollapsed={navCollapsed}
            onToggleNav={toggleNav}
            onCompose={compose}
            onDial={(number) => openCreate('call', { initialMode: 'dial', initialNumber: number })}
          />
        ) : (<>
        <ConversationListPanel
          activeChannel={activeChannel}
          showConversations={showConversations}
          totalUnread={totalUnread}
          showSearch={showSearch}
          searchQuery={searchQuery}
          filterTab={filterTab}
          filteredConversations={filteredConversations}
          loading={convLoading}
          profiles={profiles}
          selectedUserId={selectedUserId}
          onMarkRead={markInternalRead}
          navCollapsed={navCollapsed}
          onToggleNav={toggleNav}
          onToggleSearch={() => { setShowSearch(v => !v); if (showSearch) setSearchQuery(''); }}
          onSearchChange={setSearchQuery}
          onClearSearch={() => { setSearchQuery(''); setShowSearch(false); }}
          onFilterTabChange={setFilterTab}
          onSelectConversation={openConversation}
        />

        {showConversations && selectedUserId && selectedProfile && currentUser ? (
          <ChatArea
            key={selectedUserId}
            currentUser={currentUser}
            otherUser={selectedProfile}
            onConversationUpdate={handleConversationUpdate}
          />
        ) : (
          <CommsPanelEmpty
            viewKey={activeChannel}
            hasConversations={showConversations && conversations.length > 0}
            onCreate={openCreate}
          />
        )}
        </>)}
      </div>

      {createOpen && (
        <MenuPopover
          anchorRef={createBtnRef}
          align="left"
          width={184}
          items={CREATE_ITEMS}
          onSelect={(key) => openCreate(key)}
          onClose={() => setCreateOpen(false)}
          ariaLabel="Create new"
        />
      )}

    </div>
  );
}

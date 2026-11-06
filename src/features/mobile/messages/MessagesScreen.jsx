import { useMemo, useState } from 'react';
import { Avatar } from '../../../components/Avatar/Avatar';
import { Button } from '../../../components/Button/Button';
import { FilterChip } from '../../../components/FilterChip/FilterChip';
import { Icon } from '../../../components/Icon/Icon';
import { SegmentedControl } from '../../../components/SegmentedControl/SegmentedControl';
import { useAppStore } from '../../../store/useAppStore';
import { useCommsConversations } from '../../messages/comms/useComms';
import { MobileRootHeader } from '../MobileHeader';
import { MobileEmpty, MobileListSkeleton, CountBadge } from '../MobileParts';
import { useMobileNav } from '../MobileNavContext';
import { conversationTitle, listStamp } from '../mobileFormat';
import styles from '../mobile.module.css';

// Channels a provider messages on from the phone (calls live under Calls).
const CHANNELS = [
  { key: 'all', label: 'All', leadingIcon: 'solar:inbox-linear' },
  { key: 'chat', label: 'Chats', leadingIcon: 'solar:chat-round-linear' },
  { key: 'sms', label: 'SMS', leadingIcon: 'solar:chat-square-linear' },
  { key: 'email', label: 'Emails', leadingIcon: 'solar:letter-linear' },
];
const CHANNEL_ICON = { chat: 'solar:chat-round-linear', sms: 'solar:chat-square-linear', email: 'solar:letter-linear' };
const ASSIGNED_TO_ME = 'Assigned to me';

/** Member conversations across chat, SMS and email (Figma 759:22502). */
export function MessagesScreen() {
  const { push } = useMobileNav();
  const me = useAppStore(s => s.currentUserProfile);
  const { conversations, loading, failed, retry } = useCommsConversations();
  const [audience, setAudience] = useState('members');
  const [channel, setChannel] = useState('all');
  const [assigned, setAssigned] = useState([]);

  const shown = useMemo(() => conversations.filter(c => (
    c.channel !== 'call' && !c.archived
    && (channel === 'all' || c.channel === channel)
    && (!assigned.length || (me?.id && String(c.assigned_to) === String(me.id)))
  )), [conversations, channel, assigned, me]);

  return (
    <div className={styles.screen}>
      <MobileRootHeader title="Messages" />
      <div className={styles.toolbar}>
        <SegmentedControl
          size="lg"
          aria-label="Conversations with"
          value={audience}
          onValueChange={setAudience}
          items={[{ key: 'members', label: 'Members' }, { key: 'internal', label: 'Internal' }]}
        />
        {audience === 'members' && (
          <div className={styles.toolbarEnd}>
            <FilterChip label="Assigned" options={[ASSIGNED_TO_ME]} selected={assigned} onChange={setAssigned} singleSelect />
          </div>
        )}
      </div>
      <div className={styles.bodyWrap}>
        <div className={styles.body}>
          {audience === 'internal' ? (
            <MobileEmpty
              icon="solar:users-group-rounded-linear"
              title="Internal chat is coming to mobile"
              description="Message your team from Fold Health on a computer for now."
            />
          ) : (
            <>
              <div className={styles.channelBar}>
                <SegmentedControl size="lg" variant="ghost" fullWidth aria-label="Channel" value={channel} onValueChange={setChannel} items={CHANNELS} />
              </div>
              {loading ? <MobileListSkeleton /> : failed ? (
                <MobileEmpty icon="solar:danger-circle-linear" title="Couldn't load messages" action={<Button variant="outline" onClick={retry}>Try again</Button>} />
              ) : shown.length === 0 ? (
                <MobileEmpty icon="solar:chat-round-linear" title="No conversations" description="Start one with the button below." />
              ) : (
                <div className={`${styles.list} ${styles.listAfterBar}`}>
                  {shown.map(c => (
                    <button key={c.id} type="button" className={styles.card} onClick={() => push('thread', { conversation: c })}>
                      <Avatar
                        type="icon"
                        variant="primary"
                        iconName={(c.members?.length > 1) ? 'solar:users-group-rounded-linear' : CHANNEL_ICON[c.channel] || 'solar:chat-round-linear'}
                        size="XL"
                      />
                      <span className={styles.cardText}>
                        <span className={[styles.primaryText, c.unread_count ? styles.strong : ''].join(' ')}>{conversationTitle(c)}</span>
                        <span className={styles.secondaryText}>{c.last_preview || ' '}</span>
                      </span>
                      <span className={styles.cardEnd}>
                        <span className={styles.metaText}>{listStamp(c.last_message_at)}</span>
                        <CountBadge value={c.unread_count} />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        {audience === 'members' && (
          <button type="button" className={styles.fab} aria-label="New message" onClick={() => push('pickMember', { purpose: 'message' })}>
            <Icon name="solar:chat-round-line-linear" size={32} color="currentColor" />
          </button>
        )}
      </div>
    </div>
  );
}

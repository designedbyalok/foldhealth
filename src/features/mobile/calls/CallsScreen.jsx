import { useMemo, useState } from 'react';
import { Avatar } from '../../../components/Avatar/Avatar';
import { Button } from '../../../components/Button/Button';
import { Icon } from '../../../components/Icon/Icon';
import { SegmentedControl } from '../../../components/SegmentedControl/SegmentedControl';
import { useCommsConversations, useCommsMessagesFor } from '../../messages/comms/useComms';
import { useCommsPeople } from '../../messages/comms/useCommsPeople';
import { formatPhone } from '../../messages/comms/commsUtils';
import { MobileRootHeader } from '../MobileHeader';
import { MobileEmpty, MobileListSkeleton, CountBadge } from '../MobileParts';
import { useMobileNav } from '../MobileNavContext';
import { listStamp } from '../mobileFormat';
import { callRow } from './callLog';
import styles from '../mobile.module.css';

/** Call log, one card per call, newest first (Figma 759:18970 / 759:19718). */
export function CallsScreen() {
  const { push } = useMobileNav();
  const { line } = useCommsPeople();
  const { conversations, loading, failed, retry } = useCommsConversations();
  const [filter, setFilter] = useState('all');

  const callConvs = useMemo(() => conversations.filter(c => c.channel === 'call'), [conversations]);
  const convById = useMemo(() => new Map(callConvs.map(c => [c.id, c])), [callConvs]);
  const messages = useCommsMessagesFor(callConvs.map(c => c.id));

  const calls = useMemo(() => messages
    .filter(m => m.kind === 'call' && convById.has(m.conversation_id))
    .map(m => ({ message: m, conversation: convById.get(m.conversation_id), look: callRow(m) }))
    .sort((a, b) => new Date(b.message.created_at) - new Date(a.message.created_at)), [messages, convById]);

  const missedCount = calls.filter(c => c.look.missed).length;
  const shown = filter === 'missed' ? calls.filter(c => c.look.missed) : calls;

  return (
    <div className={styles.screen}>
      <MobileRootHeader title="Calls" />
      <div className={styles.toolbar}>
        <SegmentedControl
          size="lg"
          aria-label="Show calls"
          value={filter}
          onValueChange={setFilter}
          items={[
            { key: 'all', label: 'All' },
            { key: 'missed', label: <>Missed <CountBadge value={missedCount} /></> },
          ]}
        />
        {line.number && (
          <div className={styles.toolbarEnd}>
            <span className={`${styles.secondaryText} ${styles.lineNumber}`}>{formatPhone(line.number)}</span>
          </div>
        )}
      </div>
      <div className={styles.bodyWrap}>
        <div className={styles.body}>
          {loading ? <MobileListSkeleton /> : failed ? (
            <MobileEmpty icon="solar:danger-circle-linear" title="Couldn't load calls" action={<Button variant="outline" onClick={retry}>Try again</Button>} />
          ) : shown.length === 0 ? (
            <MobileEmpty
              icon="solar:phone-linear"
              title={filter === 'missed' ? 'No missed calls' : 'No calls yet'}
              description={filter === 'missed' ? undefined : 'Calls you make or receive show up here.'}
            />
          ) : (
            <div className={styles.list}>
              {shown.map(({ message, conversation, look }) => (
                <button
                  key={message.id}
                  type="button"
                  className={styles.card}
                  onClick={() => push('callDetail', { conversation })}
                >
                  <Avatar type="icon" variant={look.variant} iconName="solar:phone-linear" size="XL" />
                  <span className={styles.cardText}>
                    <span className={[styles.primaryText, look.variant === 'error' ? styles.danger : ''].join(' ')}>
                      {conversation.patient_name || formatPhone(conversation.patient_phone) || 'Unknown caller'}
                    </span>
                    <span className={styles.secondaryText}>{look.label}</span>
                  </span>
                  <span className={styles.cardEndRow}>
                    <span className={styles.metaText}>{listStamp(message.created_at)}</span>
                    <Icon name="solar:info-circle-linear" size={20} />
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="button" className={styles.fab} aria-label="Make a call" onClick={() => push('dialer')}>
          <Icon name="solar:phone-calling-linear" size={32} color="currentColor" />
        </button>
      </div>
    </div>
  );
}

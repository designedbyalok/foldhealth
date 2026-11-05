import { useState } from 'react';
import { DashboardCard, DashboardCardBody, DashboardCardSkeleton } from '../../../../../../components/DashboardCard/DashboardCard';
import { PanelSectionItem } from '../../../../../../components/PanelSection/PanelSection';
import { Avatar } from '../../../../../../components/Avatar/Avatar';
import { Badge } from '../../../../../../components/Badge/Badge';
import { useAppStore } from '../../../../../../store/useAppStore';
import { usePatientConversations } from './usePatientConversations';
import { CappedRows } from './CappedRows';
import { awaitingReply, waitLabel } from './awaitingReply';
import styles from './overviewCards.module.css';
import { CardHeaderActions, CardInsights } from '../attention/CardInsights';

const CHANNEL = {
  sms: { label: 'SMS', icon: 'solar:chat-line-linear' },
  email: { label: 'Email', icon: 'solar:letter-linear' },
  call: { label: 'Call', icon: 'solar:phone-calling-linear' },
  chat: { label: 'Chat', icon: 'solar:users-group-rounded-linear' },
};
const TONE_CLASS = { error: styles.textError, warning: styles.textWarning };

/**
 * Messages from the patient nobody on the team has opened yet: how long each
 * has waited and who should reply, so a thread doesn't go unanswered or get
 * answered twice. One read per patient; no live subscription.
 */
export function AwaitingReplyCard({ patient }) {
  const goToComms = useAppStore(s => s.goToComms);
  const [insightsOpen, setInsightsOpen] = useState(false);
  // Same match as the Comms tab: the patient's id, or the name for threads without one.
  const conversations = usePatientConversations(patient);
  const threads = conversations === null ? null : awaitingReply(conversations);

  if (threads === null) return <DashboardCardSkeleton icon="solar:chat-unread-linear" title="Awaiting Reply" />;

  return (
    <DashboardCard icon="solar:chat-unread-linear" title="Awaiting Reply" count={threads.length || null} actions={<CardHeaderActions insightsOpen={insightsOpen} onToggleInsights={() => setInsightsOpen(v => !v)}></CardHeaderActions>}>
      <CardInsights open={insightsOpen} />
      <DashboardCardBody className={styles.listBody}>
        {threads.length === 0 ? (
          <p className={styles.empty}>No messages waiting on the team.</p>
        ) : (
          <CappedRows
            items={threads}
            render={(c) => {
              const channel = CHANNEL[c.channel] || CHANNEL.chat;
              const wait = waitLabel(c.last_message_at);
              return (
                <div key={c.id} className={styles.clickRow}>
                  <PanelSectionItem
                    inset
                    leading={<Avatar type="icon" variant="patient" iconName={channel.icon} size="S" />}
                    title={(
                      <button
                        type="button"
                        className={`${styles.titleButton} ${styles.stretch}`}
                        onClick={() => goToComms({ channel: c.channel, conversationId: c.id })}
                      >
                        {c.last_preview || c.subject || `${channel.label} thread`}
                      </button>
                    )}
                    meta={[
                      channel.label,
                      <span key="wait" className={TONE_CLASS[wait.tone]}>Waiting {wait.label}</span>,
                      c.assigned_to ? `Reply: ${c.assigned_to}` : 'Unassigned',
                    ]}
                    trailing={<Badge tone="info" size="sm" label={String(c.unread_count)} />}
                  />
                </div>
              );
            }}
          />
        )}
      </DashboardCardBody>
    </DashboardCard>
  );
}

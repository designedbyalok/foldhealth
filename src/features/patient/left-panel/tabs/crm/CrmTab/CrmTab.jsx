import { useEffect, useMemo, useState } from 'react';
import { ActivityLog, MetaLine } from '../../../../../../components/ActivityLog/ActivityLog';
import { historyTimelineStyles as htStyles } from '../../../../../../components/HistoryTimeline/HistoryTimeline';
import { Link } from '../../../../../../components/Link/Link';
import { ActionButton } from '../../../../../../components/ActionButton/ActionButton';
import { Avatar } from '../../../../../../components/Avatar/Avatar';
import { Icon } from '../../../../../../components/Icon/Icon';
import { SubTabs } from '../../../../../../components/SubTabs/SubTabs';
import { TimelineSkeleton } from '../../../../../../components/TimelineSkeleton/TimelineSkeleton';
import { useAppStore } from '../../../../../../store/useAppStore';
import { CRM_CHANNELS, CRM_STATUS_COLOR } from '../../../../data/crmActivity';
import { usePatientSmsLog } from '../../../../../messages/comms/useComms';
import { findOrCreateConversation, listPatientConversations } from '../../../../../messages/comms/commsRepo';
import { toast } from '../../../../../../components/Toast/sonnerToast';
import { ConversationDrawer } from '../../../../../messages/comms/ConversationDrawer';
import styles from './CrmTab.module.css';

const EMPTY = [];
// CRM is communication with the patient only: the channels its tabs list.
const COMMS = new Set(Object.keys(CRM_CHANNELS).filter(k => CRM_CHANNELS[k].filter));

// All, then a tab per communication channel, each with its colour dot.
const FILTER_TABS = [
  { key: 'all', label: 'All' },
  ...Object.entries(CRM_CHANNELS)
    .filter(([, c]) => c.filter)
    .map(([key, c]) => ({
      key,
      label: (
        <span className={styles.tabLabel}>
          <span className={styles.dot} style={{ background: c.color }} aria-hidden="true" />
          {c.label}
        </span>
      ),
    })),
];

const pad = (n) => String(n).padStart(2, '0');
const monthLabel = (d) => d.toLocaleString('en-US', { month: 'short', year: 'numeric' });

/** The channel's icon on its own tint, the rail tile Figma shows. */
function ChannelTile({ channel }) {
  const c = CRM_CHANNELS[channel] || CRM_CHANNELS.chat;
  return (
    <Avatar
      variant="icon"
      size={24}
      backgroundColor={c.tint}
      borderColor={c.color}
      icon={<Icon name={c.icon} size={14} color={c.color} />}
    />
  );
}

/** An SMS logged for the patient (FCS-5677 3540:65716), with View SMS. */
function SmsLogBody({ entry }) {
  const { message, conversation, onView } = entry.sms;
  // A received SMS on a shared number is from whoever it's logged for; its
  // stored sender is always the thread's owner.
  const who = message.direction === 'in'
    ? message.logged_for_name || message.sender_name || conversation.patient_name
    : message.sender_name || 'Care team';
  return (
    <>
      <MetaLine entry={entry} />
      <div className={htStyles.headlineRow}>
        <span className={htStyles.headline}>
          {who} sent a SMS{conversation.patient_phone && <span className={styles.smsOn}> on {conversation.patient_phone}</span>}
        </span>
      </div>
      <Link className={styles.viewSms} onClick={onView}>
        View SMS
        <Icon name="solar:alt-arrow-right-linear" size={12} />
      </Link>
    </>
  );
}

/** Activity → ActivityLog entries, newest first, with a header per month. */
function toEntries(list, onViewChat) {
  const out = [];
  let month = null;
  [...list]
    .sort((a, b) => (b.occurredAt || '').localeCompare(a.occurredAt || ''))
    .forEach((a) => {
      const d = new Date(a.occurredAt);
      const label = monthLabel(d);
      if (label !== month) { out.push({ t: 'group', label }); month = label; }
      if (a.sms) {
        out.push({
          t: 'sms',
          avatar: <ChannelTile channel="sms" />,
          date: `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`,
          time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          sms: a.sms,
          render: e => <SmsLogBody entry={e} />,
        });
        return;
      }
      out.push({
        // The outreach body is a meta line, a title and a coloured outcome,
        // with View more for a note: what every CRM entry needs.
        t: 'outreach',
        avatar: <ChannelTile channel={a.channel} />,
        date: `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`,
        time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        by: a.performedBy,
        title: a.title,
        outcome: a.status || undefined,
        outcomeColor: CRM_STATUS_COLOR[a.status],
        note: a.note,
        // A chat opens its thread, from the same link Timeline uses for details.
        ...(a.channel === 'chat' ? { onViewDetails: onViewChat, viewDetailsLabel: 'View Chat' } : {}),
      });
    });
  return out;
}

/**
 * CRM Activity (Figma P360 Revamp 727:261699): every communication with the
 * patient, newest first by month, on the shared ActivityLog. Only Chat, Call,
 * Email, SMS and eFax count; visits, assessments, tasks and the like belong
 * to Timeline. Tabs narrow it to one channel.
 *
 * @param {string} props.patientId
 */
export function CrmTab({ patientId }) {
  const activities = useAppStore(s => (patientId ? s.patientCrmActivities[patientId] : null)) || EMPTY;
  const loadedFor = useAppStore(s => (patientId ? s.patientCrmActivitiesLoadedFor[patientId] : false));
  const fetchPatientCrmActivities = useAppStore(s => s.fetchPatientCrmActivities);
  const [channel, setChannel] = useState('all');
  const smsLog = usePatientSmsLog(patientId);
  const [viewing, setViewing] = useState(null);

  useEffect(() => {
    if (patientId) fetchPatientCrmActivities(patientId);
  }, [patientId, fetchPatientCrmActivities]);

  // SMS logged for this patient sit alongside the recorded activity.
  const all = useMemo(() => [
    ...activities.filter(a => COMMS.has(a.channel)),
    ...smsLog.map(({ message, conversation }) => ({
      id: `sms-${message.id}`,
      channel: 'sms',
      occurredAt: message.created_at,
      sms: { message, conversation, onView: () => setViewing({ conversation, messageId: message.id }) },
    })),
  ], [activities, smsLog]);
  // View Chat opens the patient's chat thread (starting it if there isn't one).
  const patient = useAppStore(s => (s.allPatients || []).find(x => String(x.id) === String(patientId)));
  const openChat = useMemo(() => async () => {
    try {
      const convs = await listPatientConversations({ patientId, patientName: patient?.name });
      const chat = convs.find(c => c.channel === 'chat')
        || (patient && await findOrCreateConversation('chat', patient, { group_name: `Care for ${patient.name}` }));
      if (chat) setViewing({ conversation: chat });
      else toast.error('This patient has no chat yet.');
    } catch {
      toast.error('The chat could not be opened. Try again.');
    }
  }, [patientId, patient]);
  const entries = useMemo(
    () => toEntries(channel === 'all' ? all : all.filter(a => a.channel === channel), openChat),
    [all, channel, openChat],
  );
  const loading = !!patientId && !loadedFor;
  const channelLabel = CRM_CHANNELS[channel]?.label;

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <SubTabs tabs={FILTER_TABS} activeKey={channel} onChange={setChannel} />
        <ActionButton icon="custom:filter" size="sm" tooltip="Filter" tooltipLeft />
      </div>
      {loading
        ? <TimelineSkeleton rows={5} />
        : (
          <ActivityLog
            entries={entries}
            emptyLabel={channelLabel ? `No ${channelLabel} activity yet.` : 'No communication recorded yet.'}
          />
        )}
      {viewing && <ConversationDrawer conversation={viewing.conversation} focusMessageId={viewing.messageId} onClose={() => setViewing(null)} />}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { BottomSheet } from '../../../components/BottomSheet/BottomSheet';
import { Icon } from '../../../components/Icon/Icon';
import { listPatientConversations } from '../../messages/comms/commsRepo';
import { MobileListSkeleton } from '../MobileParts';
import { useMobileNav } from '../MobileNavContext';
import { listStamp } from '../mobileFormat';
import own from './PatientSheets.module.css';

const CHANNEL = {
  chat: { icon: 'solar:chat-round-linear', label: 'Chat' },
  sms: { icon: 'solar:chat-square-linear', label: 'SMS' },
  email: { icon: 'solar:letter-linear', label: 'Email' },
  call: { icon: 'solar:phone-linear', label: 'Calls' },
};

/**
 * The patient's inbox (Figma 759:19989, the tray beside the avatar): their
 * chat, SMS, email and call threads, newest first. A thread opens in the
 * Messages thread view, a call log in Call Detail.
 */
export function InboxSheet({ patient, onClose }) {
  const { push } = useMobileNav();
  const [threads, setThreads] = useState(null);

  useEffect(() => {
    let live = true;
    listPatientConversations({ patientId: patient.id, patientName: patient.name })
      .then(rows => { if (live) setThreads(rows); })
      .catch(() => { if (live) setThreads([]); });
    return () => { live = false; };
  }, [patient.id, patient.name]);

  const open = (conversation) => {
    onClose();
    push(conversation.channel === 'call' ? 'callDetail' : 'thread', { conversation });
  };

  return (
    <BottomSheet title="Inbox" onClose={onClose}>
      {threads == null ? <MobileListSkeleton count={3} height={56} /> : threads.length === 0 ? (
        <p className={own.empty}>No conversations with {patient.name} yet.</p>
      ) : (
        <div className={own.rows}>
          {threads.map(c => {
            const ch = CHANNEL[c.channel] || CHANNEL.chat;
            return (
              <button key={c.id} type="button" className={`${own.row} ${own.rowButton}`} onClick={() => open(c)}>
                <Icon name={ch.icon} size={24} color="var(--neutral-300)" />
                <span className={own.rowText}>
                  <span className={own.rowTitle}>{c.group_name || ch.label}</span>
                  {c.last_preview && <span className={own.rowMeta}>{c.last_preview}</span>}
                </span>
                <span className={own.rowMeta}>{listStamp(c.last_message_at)}</span>
              </button>
            );
          })}
        </div>
      )}
    </BottomSheet>
  );
}

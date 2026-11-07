import { useEffect, useMemo } from 'react';
import { Avatar } from '../../../components/Avatar/Avatar';
import { useAppStore } from '../../../store/useAppStore';
import { useCommsMessages } from '../../messages/comms/useComms';
import { useCommsPeople } from '../../messages/comms/useCommsPeople';
import { formatPhone, patientFor } from '../../messages/comms/commsUtils';
import { ContactHero } from '../ContactHero';
import { MobileListSkeleton } from '../MobileParts';
import { useMobileNav } from '../MobileNavContext';
import { useContactActions } from '../useContactActions';
import { durationLabel, longStamp, patientLine } from '../mobileFormat';
import { callRow } from './callLog';
import styles from '../mobile.module.css';

function CallCard({ message }) {
  const look = callRow(message);
  const duration = durationLabel(message.meta?.duration);
  return (
    <div className={styles.card}>
      <Avatar type="icon" variant={look.variant} iconName={look.icon} size="XL" />
      <span className={styles.cardText}>
        <span className={styles.secondaryText}>{longStamp(message.created_at)}</span>
        <span className={styles.primaryText}>{[look.label, duration].filter(Boolean).join(' • ')}</span>
      </span>
    </div>
  );
}

/** One caller: who they are, quick actions and their call history (Figma 759:19880). */
export function CallDetailScreen({ conversation }) {
  const { openMember } = useMobileNav();
  const { patients } = useCommsPeople();
  const patient = patientFor(conversation, patients);
  const pid = patient?.id ?? conversation.patient_id;
  const p360 = useAppStore(s => (pid ? s.p360ProfilesById?.[pid] : null));
  const fetchP360Profile = useAppStore(s => s.fetchP360Profile);
  useEffect(() => { if (pid) fetchP360Profile?.(pid); }, [pid, fetchP360Profile]);

  const contact = patient || {
    id: conversation.patient_id, name: conversation.patient_name,
    phone: conversation.patient_phone, email: conversation.patient_email,
  };
  const { actions, callPhone, phone } = useContactActions(contact, {
    more: { onClick: () => openMember({ id: patient?.id }), disabled: !patient },
  });

  const { messages, loading } = useCommsMessages(conversation.id);
  const [recent, ...previous] = useMemo(
    () => messages.filter(m => m.kind === 'call').sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [messages],
  );

  return (
    <div className={styles.screen}>
      <ContactHero
        name={contact.name || formatPhone(contact.phone) || 'Unknown caller'}
        pronoun={p360?.pronoun}
        meta={patientLine(patient)}
        phone={phone}
        onCallPhone={callPhone}
        actions={actions}
      />
      <div className={styles.body}>
        {loading ? <MobileListSkeleton count={3} /> : (
          <>
            {recent && (
              <>
                <p className={styles.sectionLabel}>Recent</p>
                <div className={styles.list}><CallCard message={recent} /></div>
              </>
            )}
            {previous.length > 0 && (
              <>
                <p className={styles.sectionLabel}>Previous</p>
                <div className={styles.list}>{previous.map(m => <CallCard key={m.id} message={m} />)}</div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

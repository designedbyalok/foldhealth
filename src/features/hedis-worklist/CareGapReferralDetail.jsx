import { Fragment } from 'react';
import { Avatar } from '../../components/Avatar/Avatar';
import { Badge } from '../../components/Badge/Badge';
import { Icon } from '../../components/Icon/Icon';
import { openStoredLink } from '../../lib/openSafeUrl';
import { REFERRAL_CHANNELS } from './useCareGapReferralForm';
import styles from './CareGapReferralDetail.module.css';

const initialsOf = (name) => String(name || '?').split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
const statusTone = (status) => (status === 'Draft' ? 'warning' : 'success');

/**
 * Care Gap drawer: read-only "Referral Details" pane (Figma New Care Gap
 * Workflow 693:77758). Status, patient, Referred By → Referred to, the
 * attachments and the referral's reason / note (or, for Email, its subject
 * and message).
 *
 * @param {object} props
 * @param {object} props.referral   – caregap_referrals record
 * @param {object} props.member     – { name, in, gender, age, memberId }
 * @param {Array}  props.providers  – referral directory (specialty lookup)
 */
export function CareGapReferralDetail({ referral: r, member, providers = [] }) {
  const channel = REFERRAL_CHANNELS.find(c => c.key === r.channel)?.label || r.channel;
  const find = (id, name) => (id && providers.find(p => p.id === id))
    || providers.filter(p => (p.name || '').toLowerCase() === String(name || '').toLowerCase()).find(p => p.specialty)
    || null;
  const from = find(r.sentById, r.sentBy);
  const to = find(r.providerId, r.providerName);
  const isEmail = r.channel === 'email';

  return (
    <div className={styles.root}>
      <Badge tone={statusTone(r.status)} size="md" label={r.status || 'Sent'} className={styles.status} />

      <section className={styles.section}>
        <span className={styles.label}>Patient</span>
        <div className={styles.person}>
          <Avatar variant="patient" size="M" initials={member?.in || initialsOf(member?.name || r.memberName)} />
          <div className={styles.personText}>
            <span className={styles.name}>{member?.name || r.memberName}</span>
            <span className={styles.sub}>
              {[member?.gender, member?.age, member?.memberId && `#${member.memberId}`].filter(Boolean).join(' • ')}
            </span>
          </div>
        </div>
      </section>

      <section className={styles.parties}>
        <div className={styles.section}>
          <span className={styles.label}>Referred By</span>
          <Person name={r.sentBy} sub={[from?.specialty, r.senderValue && `${channel} : ${r.senderValue}`]} />
        </div>
        <Icon name="solar:arrow-right-linear" size={16} color="var(--neutral-300)" className={styles.arrow} />
        <div className={styles.section}>
          <span className={styles.label}>Referred to</span>
          <Person name={r.providerName || 'Provider not selected'} sub={[to?.specialty, r.providerContact && `${channel} : ${r.providerContact}`]} />
        </div>
      </section>

      {(r.attachments || []).length > 0 && (
        <section className={styles.section}>
          <span className={styles.label}>Attachment</span>
          <ul className={styles.attachments}>
            {r.attachments.map((a, i) => {
              const body = (
                <>
                  <Icon name="custom:pdf-file" size={20} color="var(--neutral-400)" />
                  <span className={styles.attachmentName} title={a.name}>{a.name}</span>
                </>
              );
              return (
                <li key={a.documentId || a.storagePath || `${a.name}-${i}`}>
                  {a.url
                    ? <a className={styles.attachment} href={a.url} target="_blank" rel="noopener noreferrer" onClick={e => openStoredLink(e, a.url)}>{body}</a>
                    : <span className={styles.attachment}>{body}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {isEmail ? (
        <>
          <TextSection label="Subject" text={r.emailSubject} />
          <TextSection label="Message" text={r.emailBody} />
        </>
      ) : (
        <>
          <TextSection label="Reason for Referral" text={r.reason} />
          <TextSection label="Additional Note" text={r.note} />
        </>
      )}
    </div>
  );
}

function Person({ name, sub = [] }) {
  const parts = sub.filter(Boolean);
  return (
    <div className={styles.person}>
      <Avatar variant="staff" size={32} initials={initialsOf(name)} />
      <div className={styles.personText}>
        <span className={styles.name}>{name}</span>
        {parts.length > 0 && (
          <span className={styles.sub}>
            {parts.map((p, i) => <Fragment key={p}>{i > 0 && ' • '}{p}</Fragment>)}
          </span>
        )}
      </div>
    </div>
  );
}

function TextSection({ label, text }) {
  if (!text?.trim()) return null;
  return (
    <section className={styles.section}>
      <span className={styles.label}>{label}</span>
      <p className={styles.text}>{text}</p>
    </section>
  );
}

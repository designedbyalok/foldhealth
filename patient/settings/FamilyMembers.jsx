import { AvatarBase } from '@/components/Avatar/AvatarBase';
import { Badge } from '@/components/Badge/Badge';
import { useProfile } from '../lib/profileContext';
import { initialsOf, sexAndAge } from '../lib/profileFormat';
import styles from './Settings.module.css';

const RELATIONSHIP = { self: 'You', dependent: 'Your child or dependent', caregiver: 'You care for them' };

// Everyone this sign-in can act for. Staff add or remove people from the
// patient's Profile tab in the staff app.
export function FamilyMembers() {
  const { profiles, profile, select, viewingAs } = useProfile();
  return (
    <div className={styles.stack}>
      <ul className={styles.card}>
        {profiles.map((p) => (
          <li key={p.member_id} className={styles.row}>
            <AvatarBase variant="patient" size="M" initials={initialsOf(p)} />
            <span className={styles.text}>
              <span className={styles.main}>{p.name || p.member_id}</span>
              <span className={styles.sub}>
                {[viewingAs ? 'Viewing as this patient' : RELATIONSHIP[p.relationship], sexAndAge(p)].filter(Boolean).join(' • ')}
              </span>
            </span>
            {p.member_id === profile.member_id
              ? <Badge size="S" tone="primary" label="Current" />
              : <button type="button" className={styles.link} onClick={() => select(p.member_id)}>Switch</button>}
          </li>
        ))}
      </ul>
      <p className={styles.note}>To add or remove a family member, message your care team.</p>
    </div>
  );
}

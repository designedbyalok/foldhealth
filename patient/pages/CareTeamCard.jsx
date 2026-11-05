import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AvatarBase } from '@/components/Avatar/AvatarBase';
import { ActionButton } from '@/components/ActionButton/ActionButton';
import { CardSkeleton } from '@/components/CardSkeleton/CardSkeleton';
import { initialsFrom } from '../messages/messageFormat';
import styles from './HomePage.module.css';

// Home's Care Team card (frame 701:4555): who looks after this patient, each
// with a shortcut to message them.
export function CareTeamCard({ memberId, onMessage }) {
  const [team, setTeam] = useState(null);

  useEffect(() => {
    let alive = true;
    supabase.rpc('patient_care_team', { p_member_id: memberId }).then(({ data }) => { if (alive) setTeam(data || []); });
    return () => { alive = false; };
  }, [memberId]);

  return (
    <section className={styles.card} aria-labelledby="care-team">
      <h2 id="care-team" className={styles.columnTitle}>Care team</h2>
      {team === null && <CardSkeleton count={1} />}
      {team?.length === 0 && <p className={styles.meta}>Your care team will show here once it is set up.</p>}
      {team?.length > 0 && (
        <ul className={styles.team}>
          {team.map((m) => (
            <li key={m.name} className={styles.teamRow}>
              <AvatarBase variant="staff" size="M" initials={m.initials || initialsFrom(m.name)} />
              <span className={styles.identityText}>
                <span className={styles.teamName}>{m.name}</span>
                {(m.title || m.role) && <span className={styles.meta}>{m.title || m.role}</span>}
              </span>
              <ActionButton icon="solar:chat-round-line-linear" size="sm" tooltip={`Message ${m.name}`} onClick={() => onMessage(m.name)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

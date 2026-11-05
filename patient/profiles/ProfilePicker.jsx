import { supabase } from '@/lib/supabase';
import { AvatarBase } from '@/components/Avatar/AvatarBase';
import { initialsOf, shortName } from '../lib/profileFormat';
import { IntroCarousel } from '../auth/IntroCarousel';
import loginStyles from '../auth/LoginPage.module.css';
import styles from './ProfilePicker.module.css';

export function ProfilePicker({ profiles, onSelect }) {
  return (
    <main className={loginStyles.page}>
      <IntroCarousel />
      <div className={loginStyles.side}>
        <div className={`${loginStyles.card} ${styles.card}`}>
          <h1 className={styles.title}>Who are you here for?</h1>
          <p className={styles.subtitle}>You can switch between profiles at any time.</p>
          <ul className={styles.tiles}>
            {profiles.map((p) => (
              <li key={p.member_id}>
                <button type="button" className={styles.tile} onClick={() => onSelect(p.member_id)}>
                  <AvatarBase variant="patient" size="L" initials={initialsOf(p)} />
                  <span className={styles.name}>{shortName(p, profiles)}</span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className={styles.signOut} onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </div>
    </main>
  );
}

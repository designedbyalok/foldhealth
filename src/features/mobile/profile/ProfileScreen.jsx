import { useState } from 'react';
import { Avatar } from '../../../components/Avatar/Avatar';
import { Icon } from '../../../components/Icon/Icon';
import { useAppStore } from '../../../store/useAppStore';
import { supabase } from '../../../lib/supabase';
import { clearUserStorage } from '../../../lib/clearUserStorage';
import { OOO_ICON } from '../../ooo/oooUtils';
import { useMobileNav } from '../MobileNavContext';
import { initialsOf } from '../mobileFormat';
import common from '../mobile.module.css';
import styles from './ProfileScreen.module.css';

const locationLabel = (l) => (typeof l === 'string' ? l : l?.name || l?.label || '');
const locationAddress = (l) => (typeof l === 'string' ? '' : l?.address || '');

/** The signed-in provider (Figma 759:25732). */
export function ProfileScreen() {
  const { pop, push } = useMobileNav();
  const me = useAppStore(s => s.currentUserProfile);
  const person = useAppStore(s => s.platformPeople.find(p => p.id === me?.id));
  const [showLocations, setShowLocations] = useState(true);
  const locations = person?.locations || [];
  const role = (me?.clinicalRoles || person?.clinicalRoles || [])[0] || (me?.adminRole ? 'Admin' : '');

  const signOut = async () => {
    await supabase.auth.signOut();
    clearUserStorage();
    sessionStorage.removeItem('__auth_bypass');
    try { sessionStorage.removeItem('__auth_bypass_user'); } catch { /* storage blocked */ }
    window.location.hash = '#/login';
  };

  return (
    <div className={common.screen}>
      <div className={common.body}>
        <section className={styles.hero}>
          <button type="button" className={common.iconBtn} aria-label="Back" onClick={pop}>
            <Icon name="solar:arrow-left-linear" size={24} />
          </button>
          <Avatar variant="staff" size="DXL" initials={person?.initials || initialsOf(me?.name)} className={styles.avatar} />
          <h1 className={styles.name}>{me?.name || 'My profile'}</h1>
          {role && <p className={styles.role}>{role}</p>}
          {me?.email && <p className={styles.email}>{me.email}</p>}
        </section>

        <div className={styles.cards}>
          <div className={styles.card}>
            <button type="button" className={styles.row} aria-expanded={showLocations} onClick={() => setShowLocations(v => !v)}>
              <Icon name="solar:map-point-linear" size={24} />
              <span className={styles.rowLabel}>My Locations</span>
              <Icon name={showLocations ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'} size={16} />
            </button>
            {showLocations && (locations.length === 0 ? (
              <p className={styles.sub}>No locations assigned</p>
            ) : locations.map((l, i) => (
              <div key={`${locationLabel(l)}-${i}`} className={styles.location}>
                <Icon name="solar:buildings-2-linear" size={24} />
                <span>
                  <span className={styles.locName}>{locationLabel(l)}</span>
                  {locationAddress(l) && <span className={styles.sub}>{locationAddress(l)}</span>}
                </span>
              </div>
            )))}
          </div>
          <button type="button" className={`${styles.card} ${styles.row}`} onClick={() => push('alerts')}>
            <Icon name="solar:bell-linear" size={24} />
            <span className={styles.rowLabel}>Alerts</span>
            <Icon name="solar:alt-arrow-right-linear" size={16} />
          </button>
          <button type="button" className={`${styles.card} ${styles.row}`} onClick={() => push('ooo')}>
            <Icon name={OOO_ICON} size={24} />
            <span className={styles.rowLabel}>Out of Office</span>
            <Icon name="solar:alt-arrow-right-linear" size={16} />
          </button>
          <button type="button" className={`${styles.card} ${styles.row} ${styles.danger}`} onClick={signOut}>
            <Icon name="solar:logout-2-linear" size={24} />
            <span className={styles.rowLabel}>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}

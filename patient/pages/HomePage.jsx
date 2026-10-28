import { useState } from 'react';
import { AvatarBase } from '@/components/Avatar/AvatarBase';
import { Icon } from '@/components/Icon/Icon';
import { Button } from '@/components/Button/Button';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { CardSkeleton } from '@/components/CardSkeleton/CardSkeleton';
import { useProfile } from '../lib/profileContext';
import { initialsOf, sexAndAge } from '../lib/profileFormat';
import { ProfileSwitcher } from '../profiles/ProfileSwitcher';
import { useUpcomingVisits } from '../appointments/useUpcomingVisits';
import { goTo } from '../lib/useHashRoute';
import { visitWhen } from '../appointments/slotFormat';
import { EditProfileDrawer } from '../profiles/EditProfileDrawer';
import { CareTeamCard } from './CareTeamCard';
import { HomeTabs } from './HomeTabs';
import styles from './HomePage.module.css';

function VisitCard({ visit }) {
  const when = visitWhen(visit);
  const virtual = /virtual/i.test(visit.mode || '');
  return (
    <li className={styles.visit}>
      <div className={styles.visitDate} aria-hidden="true">
        <span className={styles.visitMonth}>{when.month}</span>
        <span className={styles.visitDay}>{when.day}</span>
      </div>
      <div className={styles.visitBody}>
        <span className={styles.visitTitle}>{visit.type_name || 'Visit'}</span>
        {visit.provider_name && <span className={styles.visitMeta}>with {visit.provider_name}</span>}
        <span className={styles.visitMeta}>
          <Icon name="solar:clock-circle-linear" size={14} color="currentColor" />
          {when.weekday} {when.month} {when.day}, {when.time}
        </span>
        <span className={styles.visitMeta}>
          <Icon name={virtual ? 'solar:videocamera-record-linear' : 'solar:map-point-linear'} size={14} color="currentColor" />
          {virtual ? 'Video visit' : visit.location || visit.mode || 'In person'}
        </span>
        {visit.member_instruction && <span className={styles.visitNote}>{visit.member_instruction}</span>}
      </div>
    </li>
  );
}

const PROMO_KEY = 'patient-packages-promo-hidden';
const readPromoHidden = () => { try { return localStorage.getItem(PROMO_KEY) === '1'; } catch { return false; } };
const hidePromo = () => { try { localStorage.setItem(PROMO_KEY, '1'); } catch { /* shows again next visit */ } };

// "Introducing Packages" (frame 701:4555), dismissible.
function PackagesPromo({ onDismiss }) {
  return (
    <div className={styles.card}>
      <div className={styles.promoHead}>
        <span className={styles.promoIcon}><Icon name="solar:box-linear" size={28} color="currentColor" /></span>
        <button type="button" className={styles.promoClose} aria-label="Dismiss" onClick={onDismiss}>
          <Icon name="solar:close-linear" size={16} color="currentColor" />
        </button>
      </div>
      <span className={styles.promoTitle}>Introducing Packages</span>
      <span className={styles.promoText}>
        Health packages are customised care activities and routines. You can explore and enrol in one that suits you the best.
      </span>
      <Button variant="secondary" size="L" leadingIcon="solar:box-linear" fullWidth onClick={() => goTo('settings/packages?tab=available')}>
        Explore Package
      </Button>
    </div>
  );
}

export function HomePage({ refreshKey, onBook, onMessage }) {
  const { profile, updateProfile } = useProfile();
  const [editing, setEditing] = useState(false);
  const [promoHidden, setPromoHidden] = useState(readPromoHidden);
  const { loading, error, visits } = useUpcomingVisits(profile.member_id, refreshKey);

  return (
    <div className={styles.grid}>
      <aside className={styles.column} aria-label="Profile">
        <section className={styles.card}>
          <div className={styles.cardHead}><ProfileSwitcher /></div>
          <div className={styles.identity}>
            <AvatarBase variant="patient" size="L" initials={initialsOf(profile)} />
            <div className={styles.identityText}>
              <span className={styles.name}>{profile.name}</span>
              <span className={styles.meta}>{sexAndAge(profile)}</span>
            </div>
          </div>
          {profile.email && (
            <span className={styles.contact}><Icon name="solar:letter-linear" size={16} color="currentColor" />{profile.email}</span>
          )}
          {profile.phone && (
            <span className={styles.contact}><Icon name="solar:phone-linear" size={16} color="currentColor" />{profile.phone}</span>
          )}
          <button type="button" className={styles.editProfile} onClick={() => setEditing(true)}>
            <Icon name="solar:pen-linear" size={16} color="currentColor" />
            Edit Profile
          </button>
        </section>
        <CareTeamCard memberId={profile.member_id} onMessage={onMessage} />
      </aside>

      <section className={`${styles.column} ${styles.events}`} aria-labelledby="upcoming-visits">
        <h2 id="upcoming-visits" className={styles.columnTitle}>Upcoming visits</h2>
        {loading && <CardSkeleton count={2} />}
        {!loading && error && <p className={styles.error} role="alert">{error}</p>}
        {!loading && !error && visits.length === 0 && (
          <div className={styles.card}>
            <EmptyState
              icon="solar:calendar-linear"
              title="No upcoming visits"
              description="Book a visit with your care team when you need one."
              actionLabel="Book a visit"
              onAction={onBook}
            />
          </div>
        )}
        {visits.length > 0 && (
          <>
            <ul className={styles.visits}>
              {visits.map((v) => <VisitCard key={v.id} visit={v} />)}
            </ul>
            <Button variant="secondary" size="L" leadingIcon="solar:calendar-add-linear" onClick={onBook}>
              Book another visit
            </Button>
          </>
        )}
        {!promoHidden && <PackagesPromo onDismiss={() => { hidePromo(); setPromoHidden(true); }} />}
      </section>

      <section className={styles.column} aria-label="Care">
        <HomeTabs memberId={profile.member_id} />
      </section>
      {editing && (
        <EditProfileDrawer
          key={profile.member_id}
          profile={profile}
          onClose={() => setEditing(false)}
          onSaved={(patch) => updateProfile(profile.member_id, patch)}
        />
      )}
    </div>
  );
}

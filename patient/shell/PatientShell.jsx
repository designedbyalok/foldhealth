import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { NavRail } from '@/components/NavRail/NavRail';
import { Button } from '@/components/Button/Button';
import { Icon } from '@/components/Icon/Icon';
import { AvatarBase } from '@/components/Avatar/AvatarBase';
import { ErrorBoundary } from '@/components/ErrorBoundary/ErrorBoundary';
import { goTo, useHashRoute } from '../lib/useHashRoute';
import { useProfile } from '../lib/profileContext';
import { initialsOf } from '../lib/profileFormat';
import { HomePage } from '../pages/HomePage';
import { ComingSoonPage } from '../pages/ComingSoonPage';
import { BookVisitDrawer } from '../appointments/BookVisitDrawer';
import { MessagesPage } from '../messages/MessagesPage';
import { SettingsPage } from '../settings/SettingsPage';
import { NotificationsDrawer } from '../notifications/NotificationsDrawer';
import { MessagesContext, useConversationsPoll } from '../messages/messagesContext';
import styles from './PatientShell.module.css';

const NAV = [
  { id: 'home', label: 'Home', icon: 'solar:home-2-linear' },
  { id: 'messages', label: 'Messages', icon: 'solar:chat-round-line-linear' },
  { id: 'settings', label: 'Settings', icon: 'solar:settings-linear' },
];
const FOOTER_NAV = [
  { id: 'help', label: 'Help', icon: 'solar:question-circle-linear' },
  { id: 'logout', label: 'Logout', icon: 'solar:logout-2-linear' },
];
const PAGES = {
  home: { title: 'Home', render: (p) => <HomePage {...p} /> },
  messages: { title: 'Messages', render: () => <MessagesPage /> },
  settings: { title: 'Settings', render: () => <SettingsPage /> },
  help: { title: 'Help', render: () => <ComingSoonPage icon="solar:question-circle-linear" title="Help" /> },
};

export function PatientShell() {
  const { profile, viewingAs } = useProfile();
  const [route, navigate] = useHashRoute('home');
  const [booking, setBooking] = useState(false);
  const [visitsVersion, setVisitsVersion] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const page = PAGES[route] || PAGES.home;
  const messages = useConversationsPoll(profile.member_id);
  const nav = NAV.map((item) => (item.id === 'messages' ? { ...item, count: messages.unread } : item));

  const handleSelect = (id) => {
    if (id === 'logout') supabase.auth.signOut();
    else navigate(id);
  };

  return (
    <div className={styles.shell}>
      <NavRail items={nav} footerItems={FOOTER_NAV} activeId={PAGES[route] ? route : 'home'} onSelect={handleSelect} />
      <div className={styles.main}>
        {viewingAs && (
          <div className={styles.viewingAs} role="status">
            <Icon name="solar:eye-linear" size={16} color="currentColor" />
            <span>
              Viewing as <strong>{profile.name || profile.member_id}</strong> ({profile.member_id}). Messages and bookings are recorded as yours.
            </span>
            <button type="button" className={styles.switchPatient} onClick={viewingAs.switchPatient}>
              Switch patient
            </button>
          </div>
        )}
        <header className={styles.header}>
          <h1 className={styles.title}>{page.title}</h1>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.iconButton}
              aria-label={messages.unread ? `Notifications, ${messages.unread} unread` : 'Notifications'}
              onClick={() => setNotificationsOpen(true)}
            >
              <Icon name="solar:bell-linear" size={20} color="var(--neutral-300)" />
              {messages.unread > 0 && <span className={styles.bellBadge} aria-hidden="true">{messages.unread > 99 ? '99+' : messages.unread}</span>}
            </button>
            <Button variant="primary" size="L" leadingIcon="solar:calendar-add-linear" onClick={() => setBooking(true)}>
              Book Appointment
            </Button>
            <AvatarBase variant="patient" size="M" initials={initialsOf(profile)} />
          </div>
        </header>
        <div className={styles.content}>
          <MessagesContext.Provider value={messages}>
            <ErrorBoundary resetKeys={[route, profile.member_id]}>
            {page.render({
              refreshKey: `${profile.member_id}:${visitsVersion}`,
              onBook: () => setBooking(true),
              onMessage: (name) => goTo(`messages?to=${encodeURIComponent(name)}`),
            })}
            </ErrorBoundary>
          </MessagesContext.Provider>
        </div>
      </div>
      {notificationsOpen && (
        <NotificationsDrawer key={profile.member_id} memberId={profile.member_id} onClose={() => setNotificationsOpen(false)} />
      )}
      {booking && (
        <BookVisitDrawer
          key={profile.member_id}
          profile={profile}
          onClose={() => setBooking(false)}
          onBooked={() => setVisitsVersion((v) => v + 1)}
        />
      )}
    </div>
  );
}

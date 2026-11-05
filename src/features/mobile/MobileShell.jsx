import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../components/Icon/Icon';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { useAppStore } from '../../store/useAppStore';
import { MobileNavContext } from './MobileNavContext';
import { MobileRootHeader } from './MobileHeader';
import { CallsScreen } from './calls/CallsScreen';
import { CallDetailScreen } from './calls/CallDetailScreen';
import { DialerScreen } from './calls/DialerScreen';
import { MessagesScreen } from './messages/MessagesScreen';
import { ThreadScreen } from './messages/ThreadScreen';
import { ScheduleScreen } from './schedule/ScheduleScreen';
import { MembersScreen, PickMemberScreen } from './members/MembersScreen';
import { MemberProfileScreen } from './members/MemberProfileScreen';
import { ProfileScreen } from './profile/ProfileScreen';
import { AlertsScreen } from './profile/AlertsScreen';
import shell from './MobileShell.module.css';
import styles from './mobile.module.css';

// Bottom tabs, in Figma order (Nav Menu Provider 759:19104). `page` is the
// desktop activePage the tab mirrors, so the URL and a resize to desktop
// land on the same place.
const TABS = [
  { key: 'calls', icon: 'solar:phone-linear', label: 'Calls', page: 'calls' },
  { key: 'messages', icon: 'solar:chat-round-linear', label: 'Messages', page: 'messages' },
  { key: 'tasks', icon: 'solar:checklist-minimalistic-linear', label: 'Tasks', page: 'tasks' },
  { key: 'calendar', icon: 'solar:calendar-minimalistic-linear', label: 'Schedule', page: 'calendar' },
  { key: 'members', icon: 'solar:users-group-rounded-linear', label: 'Members', page: null },
];

const ROOTS = {
  calls: CallsScreen,
  messages: MessagesScreen,
  tasks: TasksComingSoon,
  calendar: ScheduleScreen,
  members: MembersScreen,
};

const SCREENS = {
  callDetail: CallDetailScreen,
  dialer: DialerScreen,
  thread: ThreadScreen,
  member: MemberProfileScreen,
  pickMember: PickMemberScreen,
  profile: ProfileScreen,
  alerts: AlertsScreen,
};

// Sub-screens that need the whole height (a composer or keypad at the bottom).
const FULL_SCREEN = new Set(['thread', 'dialer']);

function initialTab(activePage) {
  if (activePage === 'population') return 'members';
  return TABS.some(t => t.page === activePage) ? activePage : 'calls';
}

/** The provider mobile app: one tab at a time, sub-screens stacked over it. */
export function MobileShell() {
  const activePage = useAppStore(s => s.activePage);
  const setActivePage = useAppStore(s => s.setActivePage);
  const unreadMessages = useAppStore(s => s.messagesUnreadCount);
  const [tab, setTabState] = useState(() => initialTab(activePage));
  const [stack, setStack] = useState([]);
  const stackRef = useRef(stack);
  useEffect(() => { stackRef.current = stack; }, [stack]);

  // Each sub-screen is a browser history entry, so the phone's back gesture
  // closes it instead of leaving the app.
  useEffect(() => {
    const onPop = () => setStack(s => s.slice(0, -1));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const push = useCallback((screen, props = {}) => {
    window.history.pushState({ mobileScreen: screen }, '');
    setStack(s => [...s, { screen, props }]);
  }, []);
  const pop = useCallback(() => {
    if (stackRef.current.length) window.history.back();
  }, []);
  const setTab = useCallback((key) => {
    const depth = stackRef.current.length;
    if (depth) {
      setStack([]);
      window.history.go(-depth);
    }
    setTabState(key);
    const page = TABS.find(t => t.key === key)?.page;
    if (page) setActivePage(page);
  }, [setActivePage]);

  const nav = useMemo(() => ({ push, pop, setTab }), [push, pop, setTab]);
  const top = stack[stack.length - 1];
  const Root = ROOTS[tab];
  const Sub = top ? SCREENS[top.screen] : null;
  const showNav = !top || !FULL_SCREEN.has(top.screen);

  return (
    <MobileNavContext.Provider value={nav}>
      <div className={shell.shell}>
        <main className={shell.content}>
          {Sub ? <Sub key={stack.length} {...top.props} /> : <Root />}
        </main>
        {showNav && (
          <nav className={shell.nav} aria-label="Main">
            {TABS.map(t => {
              const active = t.key === tab;
              const badge = t.key === 'messages' && unreadMessages > 0 ? unreadMessages : 0;
              return (
                <button
                  key={t.key}
                  type="button"
                  className={[shell.navItem, active ? shell.navItemActive : ''].filter(Boolean).join(' ')}
                  aria-label={badge ? `${t.label}, ${badge} unread` : t.label}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setTab(t.key)}
                >
                  <span className={shell.navIcon}>
                    <Icon name={t.icon} size={32} color="currentColor" />
                    {badge > 0 && <span className={`${styles.count} ${shell.navBadge}`}>{badge > 99 ? '99+' : badge}</span>}
                  </span>
                </button>
              );
            })}
          </nav>
        )}
      </div>
    </MobileNavContext.Provider>
  );
}

function TasksComingSoon() {
  return (
    <div className={styles.screen}>
      <MobileRootHeader title="Tasks" />
      <div className={styles.body}>
        <div className={styles.center}>
          <EmptyState
            icon="solar:checklist-minimalistic-linear"
            title="Tasks are coming to mobile"
            description="Open Fold Health on a computer to work your task list for now."
          />
        </div>
      </div>
    </div>
  );
}

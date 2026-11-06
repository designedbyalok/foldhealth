import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../components/Icon/Icon';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { toast } from '../../components/Toast/sonnerToast';
import { useAppStore } from '../../store/useAppStore';
import { useCan } from '../../lib/useCan';
import { findPatientMemberId } from '../../lib/router';
import { MobileNavContext } from './MobileNavContext';
import { HomeScreen } from './home/HomeScreen';
import { MyWorklistScreen } from './home/MyWorklistScreen';
import { WorklistsScreen, WorklistComingScreen } from './worklists/WorklistsScreen';
import { CallsScreen } from './calls/CallsScreen';
import { CallDetailScreen } from './calls/CallDetailScreen';
import { DialerScreen } from './calls/DialerScreen';
import { MessagesScreen } from './messages/MessagesScreen';
import { ThreadScreen } from './messages/ThreadScreen';
import { ScheduleScreen } from './schedule/ScheduleScreen';
import { MembersScreen, PickMemberScreen } from './members/MembersScreen';
import { MemberProfileScreen } from './members/MemberProfileScreen';
import { resolveAllPatient } from './members/resolvePatient';
import { ensureAllPatients } from './members/ensureAllPatients';
import { TasksScreen } from './tasks/TasksScreen';
import { AddTaskScreen } from './tasks/AddTaskScreen';
import { TaskDetailScreen } from './tasks/TaskDetailScreen';
import { AppointmentScreen } from './schedule/AppointmentScreen';
import { BookAppointmentScreen } from './schedule/book/BookAppointmentScreen';
import { ProgramScreen } from './care/ProgramScreen';
import { CarePlanScreen } from './care/CarePlanScreen';
import { ProfileScreen } from './profile/ProfileScreen';
import { AlertsScreen } from './profile/AlertsScreen';
import { OooScreen } from './ooo/OooScreen';
import { OooFormScreen } from './ooo/OooFormScreen';
import shell from './MobileShell.module.css';
import styles from './mobile.module.css';

// Bottom tabs. `page` is the desktop activePage the tab mirrors (so the URL
// and a resize to desktop land on the same place); `perm` is the same nav
// permission the desktop sidebar checks.
const TABS = [
  { key: 'home', icon: 'solar:home-2-linear', label: 'Home', page: 'home', perm: 'nav:home' },
  { key: 'worklists', icon: 'solar:clipboard-list-linear', label: 'Worklists', page: 'population', perm: 'nav:population' },
  { key: 'messages', icon: 'solar:chat-round-linear', label: 'Messages', page: 'messages', perm: 'nav:messages' },
  { key: 'calls', icon: 'solar:phone-linear', label: 'Calls', page: 'calls', perm: 'nav:calls' },
  { key: 'calendar', icon: 'solar:calendar-minimalistic-linear', label: 'Schedule', page: 'calendar', perm: 'nav:calendar' },
];

const ROOTS = {
  home: HomeScreen,
  worklists: WorklistsScreen,
  messages: MessagesScreen,
  calls: CallsScreen,
  calendar: ScheduleScreen,
};

const SCREENS = {
  callDetail: CallDetailScreen,
  dialer: DialerScreen,
  thread: ThreadScreen,
  member: MemberProfileScreen,
  pickMember: PickMemberScreen,
  allPatients: MembersScreen,
  myWorklist: MyWorklistScreen,
  worklist: WorklistComingScreen,
  tasks: TasksScreen,
  addTask: AddTaskScreen,
  taskDetail: TaskDetailScreen,
  appointment: AppointmentScreen,
  bookAppointment: BookAppointmentScreen,
  program: ProgramScreen,
  carePlan: CarePlanScreen,
  profile: ProfileScreen,
  alerts: AlertsScreen,
  ooo: OooScreen,
  oooForm: OooFormScreen,
};

// Sub-screens that need the whole height (a composer or keypad at the bottom).
const FULL_SCREEN = new Set(['thread', 'dialer', 'addTask', 'taskDetail', 'oooForm', 'bookAppointment']);

function initialTab(activePage, allowed) {
  const byPage = TABS.find(t => t.page === activePage && allowed.includes(t.key));
  return byPage?.key || allowed[0] || null;
}

/** The provider mobile app: one tab at a time, sub-screens stacked over it. */
export function MobileShell() {
  const activePage = useAppStore(s => s.activePage);
  const setActivePage = useAppStore(s => s.setActivePage);
  const unreadMessages = useAppStore(s => s.messagesUnreadCount);
  const selectedPatientId = useAppStore(s => s.selectedPatientId);
  // Until roles and access rules load, canAccess allows everything, so
  // links wait for them before the Patient Details check.
  const accessReady = useAppStore(s => !!s.currentUserProfile?.id && s.accessRolesDidFetch && !s.accessRolesLoading);
  const can = useCan();
  const visibleTabs = useMemo(() => TABS.filter(t => can(t.perm)), [can]);
  const allowed = useMemo(() => visibleTabs.map(t => t.key), [visibleTabs]);
  const [tabState, setTabState] = useState(() => initialTab(activePage, allowed));
  const tab = allowed.includes(tabState) ? tabState : allowed[0] || null;
  const [stack, setStack] = useState([]);
  // 'push' plays the slide-in; going back or switching tabs doesn't.
  const [motion, setMotion] = useState('none');
  const stackRef = useRef(stack);
  useEffect(() => { stackRef.current = stack; }, [stack]);

  // Each sub-screen is a browser history entry, so the phone's back gesture
  // closes it instead of leaving the app.
  useEffect(() => {
    const onPop = () => { setMotion('none'); setStack(s => s.slice(0, -1)); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const push = useCallback((screen, props = {}) => {
    window.history.pushState({ mobileScreen: screen }, '');
    setMotion('push');
    setStack(s => [...s, { screen, props }]);
  }, []);
  const pop = useCallback(() => {
    if (stackRef.current.length) window.history.back();
  }, []);
  const canTab = useCallback((key) => allowed.includes(key), [allowed]);
  const setTab = useCallback((key) => {
    if (!allowed.includes(key)) return;
    const depth = stackRef.current.length;
    if (depth) {
      setStack([]);
      window.history.go(-depth);
    }
    setMotion('none');
    setTabState(key);
    const page = TABS.find(t => t.key === key)?.page;
    if (page) setActivePage(page);
  }, [allowed, setActivePage]);

  // Open a patient from any id space (worklist rows, tasks, links), checking
  // the same Patient Details permission as desktop.
  const openMember = useCallback(async ({ id, memberId, name, tab } = {}) => {
    if (!can('patient:details')) {
      toast.error("You don't have access to patient details.");
      return;
    }
    await ensureAllPatients();
    const hit = resolveAllPatient(useAppStore.getState(), { id, memberId, name });
    if (!hit && id == null) {
      toast.error(`Couldn't find ${name || 'this patient'}.`);
      return;
    }
    // `exact`: already resolved to this all_patients row, so don't re-match.
    push('member', hit ? { patientId: hit.id, exact: true, tab } : { patientId: id, tab });
  }, [can, push]);

  // A patient link (navigateToPatient, a notification, or the URL on load)
  // opens that patient's mobile profile. The selection is cleared once taken
  // so the next link to the same patient opens it again.
  const takingLink = useRef(false);
  useEffect(() => {
    if (selectedPatientId == null || !accessReady || takingLink.current) return;
    takingLink.current = true;
    // The router stores whichever worklist row matched the link's Fold ID;
    // map it back to that Fold ID.
    const memberId = findPatientMemberId(useAppStore.getState(), selectedPatientId);
    openMember({ id: selectedPatientId, memberId }).finally(() => {
      useAppStore.setState({ selectedPatientId: null });
      takingLink.current = false;
    });
  }, [selectedPatientId, accessReady, openMember]);

  const nav = useMemo(() => ({ push, pop, setTab, canTab, openMember }), [push, pop, setTab, canTab, openMember]);
  const top = stack[stack.length - 1];
  const Root = tab ? ROOTS[tab] : NoAccess;
  const Sub = top ? SCREENS[top.screen] : null;
  const showNav = allowed.length > 0 && (!top || !FULL_SCREEN.has(top.screen));

  return (
    <MobileNavContext.Provider value={nav}>
      <div className={shell.shell}>
        <main className={shell.content}>
          {Sub ? (
            <div key={stack.length} className={[shell.screen, motion === 'push' ? shell.pushed : ''].filter(Boolean).join(' ')}>
              <Sub {...top.props} />
            </div>
          ) : <Root />}
        </main>
        {showNav && (
          <nav className={shell.nav} aria-label="Main">
            {visibleTabs.map(t => {
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

function NoAccess() {
  return (
    <div className={styles.screen}>
      <div className={styles.center}>
        <EmptyState icon="solar:lock-keyhole-linear" title="Nothing to show yet" description="Ask your admin for access to Fold Health's pages." />
      </div>
    </div>
  );
}

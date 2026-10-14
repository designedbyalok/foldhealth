import { useCallback, useState } from 'react';
import { FloatingSidebar } from '../FloatingSidebar/FloatingSidebar';
import { SubNav } from '../SubNav/SubNav';
import { HelpPopover } from '../HelpPopover/HelpPopover';
import { WhatsNewDrawer } from '../WhatsNewDrawer/WhatsNewDrawer';
import { useAppStore } from '../../store/useAppStore';

/**
 * SidebarFloating.
 *
 * Store-wired variant of the primary navigation chrome. Mirrors every
 * behaviour of the standard `<Sidebar />` + page-column `<SubNav />` pair,
 * then composes them inside the `<FloatingSidebar />` floating card.
 *
 * Nav item list, click handling, Help popover warming, changelog badge,
 * and Featurebase feedback flow all mirror `Sidebar.jsx` so switching
 * between the two shapes from the user profile menu is a pure visual
 * swap: the user never loses access to any entry point.
 *
 * The sub-panel is the live `<SubNav />` component, so section data stays
 * in one place (worklist order, counts, selection) regardless of which
 * sidebar shape is mounted.
 */
const NAV_ITEMS = [
  { key: 'home', icon: 'solar:home-2-linear', filledIcon: 'solar:home-2-bold', label: 'Home', shortcut: '⌘1', page: 'home' },
  { key: 'population', icon: 'solar:users-group-rounded-linear', filledIcon: 'solar:users-group-rounded-bold', label: 'Population', shortcut: '⌘2', page: 'population' },
  { key: 'calendar', icon: 'solar:calendar-linear', filledIcon: 'solar:calendar-bold', label: 'Calendar', shortcut: '⌘3', page: 'calendar' },
  { key: 'tasks', icon: 'solar:checklist-minimalistic-linear', filledIcon: 'solar:checklist-minimalistic-bold', label: 'Tasks', shortcut: '⌘4', page: 'tasks' },
  { key: 'messages', icon: 'solar:chat-round-dots-linear', filledIcon: 'solar:chat-round-dots-bold', label: 'Comms', shortcut: '⌘5', page: 'messages' },
  { key: 'calls', icon: 'solar:phone-linear', filledIcon: 'solar:phone-bold', label: 'Calls', shortcut: '⌘6', page: 'calls' },
  { key: 'leads', icon: 'solar:user-speak-linear', filledIcon: 'solar:user-speak-bold', label: 'Leads', shortcut: '⌘7', page: 'leads' },
  { key: 'campaign', icon: 'custom:campaign', filledIcon: 'custom:campaign-bold', label: 'Campaign', shortcut: '⌘8', page: 'campaign' },
  { key: 'analytics', icon: 'solar:chart-linear', filledIcon: 'solar:chart-bold', label: 'Analytics', shortcut: '⌘9', page: 'analytics' },
  { key: 'settings', icon: 'solar:settings-linear', filledIcon: 'solar:settings-bold', label: 'Settings', shortcut: '⌘,', page: 'settings' },
];

const BOTTOM_ITEMS = [
  { key: 'help', icon: 'solar:question-circle-linear', filledIcon: 'solar:question-circle-bold', label: 'Help', shortcut: '⌘/', action: 'help' },
];

const IMPLEMENTED_PAGES = ['home', 'population', 'settings', 'analytics', 'calendar', 'messages', 'calls', 'tasks', 'campaign'];

function openFeedbackPortal() {
  const portal = 'https://foldhealth.featurebase.app/';
  const jwt = useAppStore.getState().featurebaseJwt;
  const url = jwt
    ? `https://foldhealth.featurebase.app/api/v1/auth/access/jwt?jwt=${encodeURIComponent(jwt)}&return_to=${encodeURIComponent(portal)}`
    : portal;
  window.open(url, '_blank', 'noopener');
}

export function SidebarFloating() {
  const activePage = useAppStore(s => s.activePage);
  const requestNavigate = useAppStore(s => s.requestNavigate);
  const setCurrentPage = useAppStore(s => s.setCurrentPage);
  const setSettingsNavItem = useAppStore(s => s.setSettingsNavItem);
  const setMemberLeadsTab = useAppStore(s => s.setMemberLeadsTab);
  const navigateBackToWorklist = useAppStore(s => s.navigateBackToWorklist);
  const showToast = useAppStore(s => s.showToast);

  // Unread counts for the two badged items — same selectors Sidebar uses, so
  // the number on the floating variant stays in sync with the standard one.
  const messagesUnreadCount = useAppStore(s => s.messagesUnreadCount);
  const taskNotificationsUnread = useAppStore(
    s => (s.notifications || []).filter(n => !n.read && (n.type || '').startsWith('task.')).length,
  );

  // Help menu wiring — identical to Sidebar.jsx: warm the changelog +
  // Featurebase JWT the moment the user reaches for Help so the popover
  // reads correct unread counts and the feedback link survives popup
  // blockers.
  const [helpOpen, setHelpOpen] = useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const fetchChangelog = useAppStore(s => s.fetchChangelog);
  const ensureFeaturebaseJwt = useAppStore(s => s.ensureFeaturebaseJwt);
  const changelogEntries = useAppStore(s => s.changelogEntries);
  const changelogSeenAt = useAppStore(s => s.changelogSeenAt);
  const changelogUnread = changelogEntries.filter(
    e => new Date(e.created_at) > new Date(changelogSeenAt || 0),
  ).length;
  const warmHelpMenu = useCallback(() => {
    fetchChangelog();
    ensureFeaturebaseJwt();
  }, [fetchChangelog, ensureFeaturebaseJwt]);

  const items = NAV_ITEMS.map(item => ({
    ...item,
    badge:
      item.page === 'tasks' ? taskNotificationsUnread
        : item.page === 'messages' ? messagesUnreadCount
          : undefined,
  }));

  const activeKey = (() => {
    const match = NAV_ITEMS.find(
      it => activePage === it.page || (it.page === 'settings' && activePage === 'builder'),
    );
    return match?.key;
  })();

  const handleNavigate = (key, item) => {
    if (item.action === 'help') {
      warmHelpMenu();
      setHelpOpen(v => !v);
      return;
    }
    const page = item.page;
    if (!page) return;
    if (!IMPLEMENTED_PAGES.includes(page)) {
      showToast(`${page.charAt(0).toUpperCase() + page.slice(1)} – coming soon`);
      return;
    }
    // Reproduce Sidebar.jsx's special-case navigation so switching shapes
    // doesn't lose the "always land on Care Team" / "always close patient
    // profile" behaviours.
    if (page === 'settings') {
      setSettingsNavItem('member/leads');
      setMemberLeadsTab('care-team');
    }
    if (page === 'population') navigateBackToWorklist();
    requestNavigate(page);
    setCurrentPage(1);
  };

  // The sub-panel is the live SubNav, so section data (worklists, patients
  // groups, leads) remains in one place regardless of which rail is mounted.
  // Only renders when the active page actually has sub-nav content.
  const showSubNav = activePage === 'population';
  // 100% so the SubNav fills the floating card's sub-panel instead of
  // overflowing (fixed 200px was being clipped by the frame overflow:hidden,
  // which pushed the count badges within ~3px of the visible right edge).
  const subPanel = showSubNav ? <SubNav collapsed={false} width="100%" /> : null;

  return (
    <>
      <FloatingSidebar
        items={items}
        bottomItems={BOTTOM_ITEMS}
        activeKey={helpOpen ? 'help' : activeKey}
        onNavigate={handleNavigate}
        showSubNav={showSubNav}
        subPanel={subPanel}
      />
      {helpOpen && (
        <HelpPopover
          onClose={() => setHelpOpen(false)}
          onOpenFeedback={openFeedbackPortal}
          onOpenChangelog={() => setWhatsNewOpen(true)}
          changelogUnread={changelogUnread}
        />
      )}
      {whatsNewOpen && <WhatsNewDrawer onClose={() => setWhatsNewOpen(false)} />}
    </>
  );
}

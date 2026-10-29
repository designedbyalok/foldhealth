import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useCan } from '../../lib/useCan';
import { navPermissionKey } from '../../lib/accessControl';
import { FloatingSidebar } from '../FloatingSidebar/FloatingSidebar';
import { SubNav } from '../SubNav/SubNav';
import { setFloatingSubNavSlot } from '../FloatingSidebar/floatingSubNavSlot';
import { HelpPopover } from '../HelpPopover/HelpPopover';
import { WhatsNewDrawer } from '../WhatsNewDrawer/WhatsNewDrawer';
import { FeatureReviewsDrawer } from '../FeatureReviewsDrawer/FeatureReviewsDrawer';
import { useMyPendingReviewCount } from '../FeatureReviewsDrawer/featureReviewHooks';
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
  { key: 'reviews', icon: 'solar:clipboard-check-linear', filledIcon: 'solar:clipboard-check-bold', label: 'Signoff', action: 'reviews' },
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
  // Figma variant 1256:42013. Toggled from ThemePicker, stays null when
  // the comfortable default is active.
  const floatingDensity = useAppStore(s => s.floatingDensity);
  // Lets the Population worklists' SubnavToggle button collapse the floating
  // sub-panel to a 52px rail. Only applied to Population (the pages whose
  // SideNav lives inline instead of the floating slot keep their rail).
  const subnavCollapsed = useAppStore(s => s.subnavCollapsed);
  // Patient profile owns the whole Body card and doesn't share state with
  // the Population worklist list, so the floating sub-panel collapses
  // automatically whenever a patient is open, independent of the user's
  // manual toggle.
  const patientDetailOpen = useAppStore(s => Boolean(s.selectedPatientId));

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
  const reviewsDrawer = useAppStore(s => s.featureReviewsDrawer);
  const openReviews = useAppStore(s => s.openFeatureReviewsDrawer);
  const closeReviews = useAppStore(s => s.closeFeatureReviewsDrawer);
  const reviewsOpen = !!reviewsDrawer;
  const fetchFeatureReviews = useAppStore(s => s.fetchFeatureReviews);
  const myPendingReviews = useMyPendingReviewCount();
  useEffect(() => { fetchFeatureReviews(); }, [fetchFeatureReviews]);
  const bottomItems = BOTTOM_ITEMS.map(item => (
    item.action === 'reviews' ? { ...item, badge: myPendingReviews } : item
  ));
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

  const can = useCan();
  const items = NAV_ITEMS.filter(item => can(navPermissionKey(item.page))).map(item => ({
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
    if (item.action === 'reviews') {
      openReviews();
      return;
    }
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

  // Pages whose SideNav/SubNav belongs INSIDE the floating card. Population
  // owns a dedicated SubNav the layout renders directly; the other feature
  // sections each keep their own `<SideNav>` state in their own layouts
  // (AnalyticsLayout, SettingsLayout, CallsView, MessagesView) and portal
  // their SideNav into the slot div below via `floatingSubNavSlot.js`.
  // Everything else renders a rail-only shell.
  const PORTAL_PAGES = new Set(['analytics', 'settings', 'calls', 'messages']);
  const portalPage = PORTAL_PAGES.has(activePage);
  // Assume a portaled menu is coming so a normal Settings / Analytics page
  // doesn't flash shut. A screen that never portals one (the care-plan
  // template editor, a new care plan, an automation builder) collapses to
  // the rail once we know the slot stayed empty.
  const [portalFilled, setPortalFilled] = useState(true);
  // 100% so the Population SubNav fills the floating card's sub-panel
  // instead of overflowing (fixed 200px was being clipped by the frame
  // overflow:hidden, which pushed count badges within ~3px of the right
  // edge).
  // Keep a stable ref to the slot div so useLayoutEffect fires the registry
  // ONCE after mount, instead of once per render. The inline ref callback
  // was firing with null → div on every re-render, momentarily resetting
  // currentSlot and clearing portaled content.
  const slotRef = useRef(null);
  useLayoutEffect(() => {
    if (!portalPage) {
      setFloatingSubNavSlot(null);
      return undefined;
    }
    const el = slotRef.current;
    setFloatingSubNavSlot(el);
    if (!el) return () => setFloatingSubNavSlot(null);
    // The feature layout portals on the commit after this registration.
    // Don't treat the still-empty slot as "no menu" until that commit has
    // had a chance to land, or every Settings open would collapse and
    // spring back. Once a menu has been seen, removing it collapses immediately.
    let settled = false;
    const sync = () => {
      const filled = el.childElementCount > 0;
      if (filled) {
        settled = true;
        setPortalFilled(true);
      } else if (settled) {
        setPortalFilled(false);
      }
    };
    const obs = new MutationObserver(sync);
    obs.observe(el, { childList: true });
    const frame = requestAnimationFrame(() => {
      settled = true;
      setPortalFilled(el.childElementCount > 0);
    });
    return () => {
      cancelAnimationFrame(frame);
      obs.disconnect();
      setFloatingSubNavSlot(null);
    };
  }, [portalPage, activePage]);

  const showSubNav = (activePage === 'population' && !subnavCollapsed && !patientDetailOpen)
    || (portalPage && portalFilled);

  const subPanel = activePage === 'population'
    ? <SubNav collapsed={false} width="100%" />
    : portalPage
      ? <div ref={slotRef} data-floating-subnav-slot style={{ display: 'flex', flex: '1 1 auto', minWidth: 0, minHeight: 0 }} />
      : null;

  return (
    <>
      <FloatingSidebar
        items={items}
        bottomItems={bottomItems}
        activeKey={reviewsOpen ? 'reviews' : helpOpen ? 'help' : activeKey}
        onNavigate={handleNavigate}
        showSubNav={showSubNav}
        subPanel={subPanel}
        density={floatingDensity}
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
      {reviewsDrawer && <FeatureReviewsDrawer key={reviewsDrawer.focusId || 'all'} focusId={reviewsDrawer.focusId} onClose={closeReviews} />}
    </>
  );
}

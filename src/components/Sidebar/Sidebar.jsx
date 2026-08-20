import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '../Icon/Icon';
import { HelpPopover } from '../HelpPopover/HelpPopover';
import { WhatsNewDrawer } from '../WhatsNewDrawer/WhatsNewDrawer';
import { useAppStore } from '../../store/useAppStore';
import { formatBadgeCount } from '../../lib/formatBadgeCount';
import styles from './Sidebar.module.css';

const NAV_ITEMS = [
  { icon: 'solar:home-2-linear', filledIcon: 'solar:home-2-bold', label: 'Home', page: 'home' },
  { icon: 'solar:users-group-rounded-linear', filledIcon: 'solar:users-group-rounded-bold', label: 'Population', page: 'population' },
  { icon: 'solar:calendar-linear', filledIcon: 'solar:calendar-bold', label: 'Calendar', page: 'calendar' },
  { icon: 'solar:checklist-minimalistic-linear', filledIcon: 'solar:checklist-minimalistic-bold', label: 'Tasks', page: 'tasks' },
  // No hardcoded `badge` here any more — Messages and Tasks both read live
  // counts (see navBadges below). The old `badge: 8` was already unreachable
  // once Messages switched to the store count, and read as a real number.
  { icon: 'solar:chat-round-dots-linear', filledIcon: 'solar:chat-round-dots-bold', label: 'Messages', page: 'messages' },
  { icon: 'solar:phone-linear', filledIcon: 'solar:phone-bold', label: 'Calls', page: 'calls' },
  { icon: 'solar:user-speak-linear', filledIcon: 'solar:user-speak-bold', label: 'Leads', page: 'leads' },
  { icon: 'custom:campaign', filledIcon: 'custom:campaign-bold', label: 'Campaign', page: 'campaign' },
  { icon: 'solar:chart-linear', filledIcon: 'solar:chart-bold', label: 'Analytics', page: 'analytics' },
  { icon: 'solar:settings-linear', filledIcon: 'solar:settings-bold', label: 'Settings', page: 'settings' },
];

const BOTTOM_ITEMS = [
  { icon: 'solar:question-circle-linear', filledIcon: 'solar:question-circle-bold', label: 'Help', action: 'help' },
];

function openFeedbackPortal() {
  const portal = 'https://foldhealth.featurebase.app/';
  const jwt = useAppStore.getState().featurebaseJwt;
  const url = jwt
    ? `https://foldhealth.featurebase.app/api/v1/auth/access/jwt?jwt=${encodeURIComponent(jwt)}&return_to=${encodeURIComponent(portal)}`
    : portal;
  window.open(url, '_blank', 'noopener');
}

export function Sidebar() {
  const activePage = useAppStore(s => s.activePage);
  const theme = useAppStore(s => s.theme);
  const navStyle = useAppStore(s => s.navStyle);
  const requestNavigate = useAppStore(s => s.requestNavigate);
  const setCurrentPage = useAppStore(s => s.setCurrentPage);
  const setSettingsNavItem = useAppStore(s => s.setSettingsNavItem);
  const setMemberLeadsTab = useAppStore(s => s.setMemberLeadsTab);
  const [helpOpen, setHelpOpen] = useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);

  // In-house changelog (Supabase-backed) — prefetch so the Help popover's
  // unread badge is accurate before the drawer is ever opened.
  const fetchChangelog = useAppStore(s => s.fetchChangelog);
  useEffect(() => { fetchChangelog(); }, [fetchChangelog]);
  const changelogEntries = useAppStore(s => s.changelogEntries);
  const changelogSeenAt = useAppStore(s => s.changelogSeenAt);
  const changelogUnread = changelogEntries.filter(
    e => new Date(e.created_at) > new Date(changelogSeenAt || 0),
  ).length;

  const showToast = useAppStore(s => s.showToast);
  const messagesUnreadCount = useAppStore(s => s.messagesUnreadCount);
  // Unread task notifications (assignment + @mention), so the Tasks tab
  // carries the same signal as the bell without opening it. Selecting the
  // `.length` rather than the filtered array keeps this a primitive, so
  // Zustand's Object.is check doesn't re-render on every store write.
  const taskNotificationsUnread = useAppStore(
    s => (s.notifications || []).filter(n => !n.read && (n.type || '').startsWith('task.')).length,
  );
  const navBadges = { tasks: taskNotificationsUnread, messages: messagesUnreadCount };
  const implementedPages = ['home', 'population', 'settings', 'analytics', 'calendar', 'messages', 'calls', 'tasks', 'campaign'];

  // ── Sliding-pill motion for tab switching ──
  // One absolutely-positioned pill lives inside .navItems and reads its
  // rect from the active <a>'s ref on every change. CSS transitions
  // `top` / `height` so the purple background glides between items
  // instead of snapping. We measure with useLayoutEffect (pre-paint) so
  // the very first render already positions the pill correctly — no
  // flash from origin.
  const navItemsRef = useRef(null);
  // Ref map keyed by nav-item label. Points at the inner .itemInner card
  // (not the outer <a> tile) so the pill exactly overlays the 60×60 card
  // — 1:1 aspect — instead of the 64×64 tile which includes 2px padding.
  const innerRefs = useRef({});
  const [pill, setPill] = useState(null); // { top, left, width, height } | null
  const [pillReady, setPillReady] = useState(false); // gate first-paint transition

  const measurePill = () => {
    const activeItem = NAV_ITEMS.find(
      it => activePage === it.page || (it.page === 'settings' && activePage === 'builder'),
    );
    const inner = activeItem ? innerRefs.current[activeItem.label] : null;
    const container = navItemsRef.current;
    if (!inner || !container) { setPill(null); return; }
    // .itemInner sits inside an .item that has position:relative — its
    // offsetParent is that anchor, so total top = anchor.offsetTop +
    // inner.offsetTop (the 2px padding). Width/height come straight
    // from the inner card so the pill is always a perfect square.
    const anchor = inner.offsetParent; // the .item <a>
    setPill({
      top: (anchor?.offsetTop ?? 0) + inner.offsetTop,
      left: (anchor?.offsetLeft ?? 0) + inner.offsetLeft,
      width: inner.offsetWidth,
      height: inner.offsetHeight,
    });
  };

  useLayoutEffect(() => {
    measurePill();
    // Skip the CSS transition on first paint so the pill lands at rest,
    // not glides in from the top.
    const raf = requestAnimationFrame(() => setPillReady(true));
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePage]);

  // Re-measure on resize (font swap can change tile height, scrollbar
  // appearing can shift layout) so the pill never desyncs.
  useEffect(() => {
    if (!navItemsRef.current) return;
    const ro = new ResizeObserver(measurePill);
    ro.observe(navItemsRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navigateBackToWorklist = useAppStore(s => s.navigateBackToWorklist);
  const handleClick = (e, page) => {
    e.preventDefault();
    if (!page) return;
    if (implementedPages.includes(page)) {
      // Settings: force-land on Member/Leads → Care Team every time the
      // sidebar entry is clicked, regardless of where the user was last.
      if (page === 'settings') {
        setSettingsNavItem('member/leads');
        setMemberLeadsTab('care-team');
      }
      // Population: if the user is inside a patient profile, close it so the
      // sidebar always returns to the worklist view (activePage alone is
      // already 'population' when a profile is open, so requestNavigate is a
      // no-op without this).
      if (page === 'population') navigateBackToWorklist();
      // requestNavigate handles the open-builder dialog flow for us. For pages
      // that go through cleanly, it routes to setActivePage internally.
      requestNavigate(page);
      setCurrentPage(1);
    } else {
      showToast(`${page.charAt(0).toUpperCase() + page.slice(1)} – coming soon`);
    }
  };

  return (
    <nav className={styles.sidebar}>
      <div className={styles.logo}>
        {theme === 'plum' ? (
          <svg width="28" height="28" viewBox="0 0 35 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" clipRule="evenodd" d="M14.355 0L0 36H5.28C7.56 29.674 11.82 26.64 17.2 26.59C23.08 26.59 27.19 29.62 29.42 36H35L20.29 0H14.355ZM17.25 22.22C14.2 22.22 11.67 23.3 9.54 24.58L17.2 4.27L25.06 24.58C23.08 23.3 20.29 22.22 17.25 22.22Z" fill={navStyle === 'light' ? '#6C0C46' : '#FFFFFF'}/>
          </svg>
        ) : (
          <svg width="28" height="28" viewBox="0 0 290 290" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M290 145C290 159.088 284.404 172.599 274.442 182.561C264.48 192.522 250.969 198.119 236.881 198.119H145C137.334 198.119 129.839 200.392 123.465 204.651C117.09 208.911 112.122 214.965 109.188 222.047C106.254 229.13 105.487 236.924 106.982 244.443C108.478 251.962 112.17 258.869 117.591 264.29C123.012 269.711 129.919 273.403 137.438 274.899C144.957 276.394 152.751 275.627 159.834 272.693C166.917 269.759 172.97 264.791 177.23 258.416C181.489 252.042 183.762 244.548 183.762 236.881V212.475C183.762 210.571 184.519 208.746 185.865 207.399C187.211 206.053 189.037 205.297 190.941 205.297C192.844 205.297 194.67 206.053 196.016 207.399C197.363 208.746 198.119 210.571 198.119 212.475V236.881C198.119 247.387 195.003 257.657 189.167 266.392C183.33 275.128 175.034 281.936 165.328 285.957C155.622 289.977 144.941 291.029 134.637 288.979C124.333 286.93 114.868 281.871 107.439 274.442C100.011 267.013 94.95 257.548 92.9 247.244C90.85 236.94 91.9 226.26 95.92 216.553C99.95 206.847 106.753 198.551 115.489 192.714C124.224 186.878 134.494 183.762 145 183.762H236.881C247.162 183.762 257.021 179.678 264.29 172.409C271.56 165.14 275.644 155.28 275.644 145C275.644 134.72 271.56 124.86 264.29 117.591C257.021 110.321 247.162 106.238 236.881 106.238H212.475C210.571 106.238 208.746 105.481 207.4 104.135C206.053 102.789 205.297 100.963 205.297 99.06C205.297 97.16 206.053 95.33 207.4 93.98C208.746 92.64 210.571 91.88 212.475 91.88H236.881C250.969 91.88 264.48 97.48 274.442 107.439C284.404 117.401 290 130.912 290 145ZM106.238 120.594C106.238 118.69 105.481 116.864 104.135 115.518C102.789 114.172 100.963 113.416 99.06 113.416C97.16 113.416 95.33 114.172 93.98 115.518C92.64 116.864 91.88 118.69 91.88 120.594V145C91.88 152.666 89.61 160.161 85.35 166.535C81.09 172.91 75.04 177.878 67.95 180.812C60.87 183.746 53.08 184.513 45.56 183.018C38.04 181.522 31.13 177.83 25.71 172.409C20.29 166.988 16.6 160.081 15.1 152.562C13.61 145.043 14.37 137.249 17.31 130.166C20.24 123.083 25.21 117.03 31.58 112.77C37.96 108.511 45.45 106.238 53.12 106.238H169.406C171.298 106.201 173.103 105.433 174.441 104.094C175.779 102.756 176.547 100.952 176.584 99.06C176.584 97.16 175.828 95.33 174.482 93.98C173.136 92.64 171.31 91.88 169.406 91.88H53.12C42.61 91.88 32.343 95 23.61 100.833C14.87 106.67 8.06 114.966 4.04 124.672C0.02 134.378-1.03 145.059 1.02 155.363C3.07 165.667 8.13 175.132 15.56 182.561C22.987 189.989 32.45 195.049 42.76 197.098C53.06 199.148 63.74 198.096 73.45 194.075C83.15 190.055 91.45 183.247 97.29 174.511C103.122 165.776 106.238 155.506 106.238 145V120.594ZM99.06 84.703C100.952 84.67 102.756 83.9 104.095 82.56C105.433 81.22 106.201 79.417 106.238 77.52V53.12C106.238 42.84 110.322 32.979 117.591 25.71C124.86 18.44 134.72 14.36 145 14.36C155.28 14.36 165.14 18.44 172.409 25.71C179.679 32.979 183.762 42.84 183.762 53.12V169.406C183.762 171.31 184.519 173.136 185.865 174.482C187.211 175.828 189.037 176.584 190.941 176.584C192.833 176.547 194.637 175.779 195.976 174.441C197.314 173.103 198.082 171.298 198.119 169.406V53.12C198.119 46.14 196.745 39.24 194.075 32.79C191.406 26.35 187.493 20.49 182.561 15.56C177.628 10.63 171.772 6.71 165.328 4.04C158.883 1.37 151.976 0 145 0C138.024 0 131.117 1.37 124.672 4.04C118.228 6.71 112.372 10.63 107.439 15.56C102.507 20.49 98.59 26.35 95.92 32.79C93.26 39.24 91.88 46.14 91.88 53.12V77.52C91.88 79.43 92.64 81.25 93.98 82.6C95.33 83.95 97.16 84.703 99.06 84.703Z" fill="currentColor"/>
          </svg>
        )}
      </div>
      <div ref={navItemsRef} className={styles.navItems}>
        {pill && (
          <span
            className={[styles.activePill, pillReady ? styles.activePillAnimated : ''].filter(Boolean).join(' ')}
            style={{ top: pill.top, left: pill.left, width: pill.width, height: pill.height }}
            aria-hidden="true"
          />
        )}
        {NAV_ITEMS.map((item) => {
          const isActive = activePage === item.page || (item.page === 'settings' && activePage === 'builder');
          return (
            <button
              type="button"
              key={item.label}
              className={[styles.item, isActive ? styles.active : ''].filter(Boolean).join(' ')}
              title={item.label}
              onClick={e => handleClick(e, item.page)}
            >
              {navBadges[item.page] > 0 && (
                <span
                  className={styles.badge}
                  aria-label={`${navBadges[item.page]} unread`}
                >
                  {formatBadgeCount(navBadges[item.page])}
                </span>
              )}
              <div
                ref={(el) => { innerRefs.current[item.label] = el; }}
                className={styles.itemInner}
              >
                {/* Crossfade linear ↔ bold. Wrap each Icon in a positioned
                    span so the layer classes attach to a stable element —
                    the Icon component intercepts some solar:* names and
                    renders a custom SVG that ignores className, which would
                    leave the linear icon visible behind the bold. */}
                <span className={styles.iconStack}>
                  <span className={`${styles.iconLayer} ${isActive ? styles.iconLayerHidden : ''}`}>
                    <Icon name={item.icon} size={22} />
                  </span>
                  <span className={`${styles.iconLayer} ${isActive ? '' : styles.iconLayerHidden}`}>
                    <Icon name={item.filledIcon} size={22} />
                  </span>
                </span>
                <span>{item.label}</span>
              </div>
            </button>
          );
        })}
      </div>
      <div className={styles.bottomSection}>
        {BOTTOM_ITEMS.map((item) => {
          const isHelp = item.action === 'help';
          const isActive = isHelp && helpOpen;
          return (
            <button
              type="button"
              key={item.label}
              className={[styles.item, isActive ? styles.active : ''].filter(Boolean).join(' ')}
              title={item.label}
              onClick={() => {
                if (isHelp) setHelpOpen(v => !v);
              }}
            >
              <div className={styles.itemInner}>
                {/* Same crossfade pattern as the primary nav so Help
                    picks up the filled variant when its popover is open. */}
                <span className={styles.iconStack}>
                  <span className={`${styles.iconLayer} ${isActive ? styles.iconLayerHidden : ''}`}>
                    <Icon name={item.icon} size={22} />
                  </span>
                  {item.filledIcon && (
                    <span className={`${styles.iconLayer} ${isActive ? '' : styles.iconLayerHidden}`}>
                      <Icon name={item.filledIcon} size={22} />
                    </span>
                  )}
                </span>
                <span>{item.label}</span>
              </div>
            </button>
          );
        })}
      </div>
      {helpOpen && (
        <HelpPopover
          onClose={() => setHelpOpen(false)}
          onOpenFeedback={openFeedbackPortal}
          onOpenChangelog={() => setWhatsNewOpen(true)}
          changelogUnread={changelogUnread}
        />
      )}
      {whatsNewOpen && <WhatsNewDrawer onClose={() => setWhatsNewOpen(false)} />}
    </nav>
  );
}

import { useRef, useState, useEffect, useCallback, useId, useMemo } from 'react';
import { Icon } from '../Icon/Icon';
import { ActionButton } from '../ActionButton/ActionButton';
import { Avatar } from '../Avatar/Avatar';
import { Input } from '../Input/Input';
import { Button } from '../Button/Button';
import { CreateNewPopover } from '../CreateNewPopover/CreateNewPopover';
import { PreferencesDrawer } from '../PreferencesDrawer/PreferencesDrawer';
import { ScheduleDrawer } from '../ScheduleDrawer/ScheduleDrawer';
import { ThemePicker } from '../ThemePicker/ThemePicker';
import { NotificationsPopover } from '../NotificationsPopover/NotificationsPopover';
import { useAppStore } from '../../store/useAppStore';
import { formatFoldId, matchesFoldId } from '../../lib/foldId';
import { formatBadgeCount } from '../../lib/formatBadgeCount';
import { supabase } from '../../lib/supabase';
import styles from './TopBar.module.css';

/* ── Get user initials from Supabase user_metadata ── */
function getUserInitials(user) {
  if (!user) return 'U';
  const meta = user.user_metadata || {};
  const first = meta.first_name || '';
  const last = meta.last_name || '';
  if (first && last) return (first[0] + last[0]).toUpperCase();
  if (meta.full_name) return meta.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const local = (user.email || '').split('@')[0] || '';
  return local.slice(0, 2).toUpperCase();
}

function getUserDisplayName(user) {
  if (!user) return 'User';
  const meta = user.user_metadata || {};
  if (meta.first_name && meta.last_name) return `${meta.first_name} ${meta.last_name}`;
  if (meta.full_name) return meta.full_name;
  return user.email?.split('@')[0] || 'User';
}

/* ── Profile Popover (Figma node 1904:6423) ── */
// The full HCC role vocabulary — filtered per-user against the roles their
// profile actually carries in profiles.clinical_roles.
const ALL_HCC_ROLES = ['Support', 'Coder', 'QA', 'Compliance'];

function ProfilePopover({ user, onClose, onPreferences, anchorRef }) {
  const uid = useId();
  const popoverRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(user?.user_metadata?.first_name || '');
  const [lastName, setLastName] = useState(user?.user_metadata?.last_name || '');
  const [saving, setSaving] = useState(false);
  // (from my branch — superseded by foldhealth/main's hccUserRole; kept
  // commented per merge-resolution instruction rather than deleted)
  // const account = useAppStore(s => s.hccRole);
  // const setAccount = useAppStore(s => s.setHccRole);
  // HCC role — the store owns it so the worklist + DiagPanel can react.
  const account = useAppStore(s => s.hccUserRole);
  const setAccount = useAppStore(s => s.setHccUserRole);
  const [showRoles, setShowRoles] = useState(false);
  // Roles this user actually has — fetched from profiles.clinical_roles.
  // The role switcher only lists HCC roles that overlap this set, so a
  // user without any HCC role assigned can't accidentally act as one.
  const [assignedRoles, setAssignedRoles] = useState(null);
  useEffect(() => {
    if (!user?.id) { setAssignedRoles([]); return; }
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('clinical_roles')
        .eq('id', user.id)
        .maybeSingle();
      if (alive) setAssignedRoles(data?.clinical_roles || []);
    })();
    return () => { alive = false; };
  }, [user?.id]);
  const assignedHccRoles = (assignedRoles || []).filter(r => ALL_HCC_ROLES.includes(r));
  // In dev we always let the switcher offer every HCC role — it lets us
  // exercise every workflow without touching profiles.clinical_roles in the
  // DB. In prod we keep the gate: users see only the roles they actually
  // have assigned.
  const hccRolesForUser = import.meta.env.DEV ? ALL_HCC_ROLES : assignedHccRoles;
  // Snap hccUserRole to a role the user actually has; if they don't have
  // the currently-selected one, fall through to their first assigned HCC
  // role. Runs when the profile fetch resolves.
  useEffect(() => {
    if (!hccRolesForUser.length) return;
    if (!hccRolesForUser.includes(account)) setAccount(hccRolesForUser[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignedRoles]);

  useEffect(() => {
    const close = (e) => {
      if (popoverRef.current?.contains(e.target)) return;
      // Ignore mousedown on the avatar trigger — it fires before the button's
      // click toggle and would close-then-reopen the popover.
      if (anchorRef?.current?.contains(e.target)) return;
      onClose();
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [onClose, anchorRef]);

  const initials = getUserInitials(user);
  const displayName = getUserDisplayName(user);
  const email = user?.email || '';

  const handleLogout = async () => {
    await supabase.auth.signOut();
    sessionStorage.removeItem('__auth_bypass');
    window.location.hash = '#/login';
    onClose();
  };

  const handleSaveName = async () => {
    if (!firstName.trim() || !lastName.trim()) return;
    setSaving(true);
    try {
      await supabase.auth.updateUser({
        data: { first_name: firstName.trim(), last_name: lastName.trim(), full_name: `${firstName.trim()} ${lastName.trim()}` },
      });
    } finally {
      setSaving(false);
    }
    setEditing(false);
  };

  return (
    <div ref={popoverRef} style={{
      position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 9999,
      background: 'var(--neutral-0)', border: '0.5px solid var(--neutral-150)',
      borderRadius: 12, padding: 12, width: 300,
      boxShadow: 'var(--shadow-popover)',
      fontFamily: "'Inter', sans-serif",
    }}>
      <>
      {/* User info */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
          <Avatar variant="staff" size="XL" initials={initials} />
          {/* Online-status dot — sits on the avatar's top-right corner. */}
          <span style={{
            position: 'absolute', top: -1, right: -3, width: 10, height: 10,
            borderRadius: '50%', background: 'var(--status-success-bright)',
            border: '2px solid var(--neutral-0)',
          }} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--font-lg)', fontWeight: 500, color: 'var(--neutral-500)', lineHeight: 1.2 }}>{displayName}</div>
          <div style={{ fontSize: 'var(--font-md)', color: 'var(--neutral-300)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>
        </div>
      </div>

      {/* Editable name section */}
      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12, padding: '8px 0', borderTop: '0.5px solid var(--neutral-100)', borderBottom: '0.5px solid var(--neutral-100)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label htmlFor={`${uid}-first-name`} style={{ fontSize: 'var(--font-xs)', fontWeight: 500, color: 'var(--neutral-300)', marginBottom: 2, display: 'block' }}>First Name</label>
              <Input id={`${uid}-first-name`} value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First" autoFocus />
            </div>
            <div>
              <label htmlFor={`${uid}-last-name`} style={{ fontSize: 'var(--font-xs)', fontWeight: 500, color: 'var(--neutral-300)', marginBottom: 2, display: 'block' }}>Last Name</label>
              <Input id={`${uid}-last-name`} value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <Button variant="ghost" size="S" onClick={() => setEditing(false)}>Cancel</Button>
            <Button variant="primary" size="S" disabled={saving || !firstName.trim() || !lastName.trim()} onClick={handleSaveName}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      ) : null}

      {/* Menu items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <button onClick={() => { onClose(); onPreferences?.(); }} style={menuItemStyle} onMouseOver={e => e.currentTarget.style.background = 'var(--neutral-50)'} onMouseOut={e => e.currentTarget.style.background = ''}>
          <Icon name="solar:settings-linear" size={20} color="var(--neutral-400)" />
          <span>Preferences</span>
        </button>
        {hccRolesForUser.length > 0 && (
          <div style={{ ...menuItemStyle, cursor: 'default' }}>
            <Icon name="solar:users-group-rounded-linear" size={20} color="var(--neutral-400)" />
            <span style={{ flex: 1 }}>Logged in as: {account}</span>
            {hccRolesForUser.length > 1 && (
              <button
                type="button"
                onClick={() => setShowRoles(v => !v)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 2, padding: 0,
                  border: 'none', background: 'none', cursor: 'pointer',
                  fontFamily: "'Inter', sans-serif", fontSize: 'var(--font-base)', fontWeight: 500,
                  color: 'var(--primary-300)',
                }}
              >
                Switch
                <Icon name="solar:alt-arrow-right-linear" size={12} color="var(--primary-300)" />
              </button>
            )}
          </div>
        )}

        {/* Theme picker — separated by thin divider above and below */}
        <div style={{ marginTop: 4, paddingTop: 8, borderTop: '0.5px solid var(--neutral-100)' }}>
          <ThemePicker />
        </div>

        <div style={{ marginTop: 4, paddingTop: 4, borderTop: '0.5px solid var(--neutral-100)' }}>
          <button onClick={handleLogout} style={{ ...menuItemStyle, color: 'var(--status-error)' }} onMouseOver={e => e.currentTarget.style.background = 'var(--status-error-light)'} onMouseOut={e => e.currentTarget.style.background = ''}>
            <Icon name="solar:logout-2-linear" size={20} color="var(--status-error)" />
            <span>Log Out</span>
          </button>
        </div>
      </div>
      </>

      {showRoles && (
        <div style={{
          position: 'absolute', top: 0, right: 'calc(100% + 8px)', width: 280,
          background: 'var(--neutral-0)', border: '0.5px solid var(--neutral-150)',
          borderRadius: 12, padding: 12, boxShadow: 'var(--shadow-popover)',
          fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <span style={{ fontSize: 'var(--font-sm)', fontWeight: 500, color: 'var(--neutral-300)', padding: '0 4px' }}>Choose Role</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {hccRolesForUser.map(a => {
              const sel = account === a;
              return (
                <button
                  key={a}
                  onClick={() => { setAccount(a); setShowRoles(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: 8,
                    borderRadius: 8, border: 'none', cursor: 'pointer', width: '100%',
                    textAlign: 'left', fontFamily: "'Inter', sans-serif", fontSize: 'var(--font-base)', fontWeight: 500,
                    background: sel ? 'var(--primary-50)' : 'none',
                    color: sel ? 'var(--primary-300)' : 'var(--neutral-400)',
                    transition: 'background .1s',
                  }}
                  onMouseOver={e => { if (!sel) e.currentTarget.style.background = 'var(--neutral-50)'; }}
                  onMouseOut={e => { if (!sel) e.currentTarget.style.background = ''; }}
                >
                  <span style={{
                    width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: sel ? 'var(--primary-300)' : 'var(--neutral-0)',
                    border: sel ? '1px solid var(--primary-300)' : '1px solid var(--neutral-200)',
                  }}>
                    {sel && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--neutral-0)' }} />}
                  </span>
                  <span style={{ flex: 1 }}>{a}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const menuItemStyle = {
  display: 'flex', alignItems: 'center', gap: 8, padding: 8,
  borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer',
  width: '100%', textAlign: 'left', fontFamily: "'Inter', sans-serif",
  fontSize: 'var(--font-base)', fontWeight: 500, color: 'var(--neutral-400)', transition: 'background .1s',
};

// Map settingsNavItem → breadcrumb label so the URL/section state drives what
// the user sees ("Settings / <thing>"). Keys mirror SettingsSubNav.
const SETTINGS_BREADCRUMB = {
  agents: 'Automation',
  messages: 'Messages',
  'embedded-components': 'Embed',
  content: 'Content',
  account: 'Account',
  billing: 'Billing',
};

export function TopBar() {
  const activePage = useAppStore(s => s.activePage);
  const showCreateNew = useAppStore(s => s.showCreateNew);
  const setShowCreateNew = useAppStore(s => s.setShowCreateNew);
  const btnRef = useRef(null);
  const profileBtnRef = useRef(null);
  const searchRef = useRef(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  // A `profile.name_incomplete` notification click sets this in the store;
  // consume it once and open Preferences, where the name fields live.
  const pendingOpenPreferences = useAppStore(s => s.pendingOpenPreferences);
  const clearPendingOpenPreferences = useAppStore(s => s.clearPendingOpenPreferences);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const bellRef = useRef(null);
  const notifications = useAppStore(s => s.notifications) || [];
  const unreadCount = notifications.filter(n => !n.read).length;
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect --
   * One-shot external signal from the store: the notification click sets it,
   * we consume it and clear it. Matches the rule's own "subscribe to external
   * state, setState in the callback that reacts" carve-out, and the same
   * pattern useTasksView uses for pendingAddTask / pendingOpenTaskId. */
  useEffect(() => {
    if (!pendingOpenPreferences) return;
    setShowPreferences(true);
    clearPendingOpenPreferences();
  }, [pendingOpenPreferences, clearPendingOpenPreferences]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    // getSession() rather than getUser(): this `user` only feeds the avatar
    // initials and the assigned-roles lookup, and getSession() reads the
    // persisted session locally instead of spending a round trip re-validating
    // the token against the auth server. AppLayout made the same swap.
    supabase.auth.getSession().then(({ data }) => setUser(data?.session?.user || null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const initials = getUserInitials(user);
  const isSettings = activePage === 'settings';
  const isAnalytics = activePage === 'analytics';
  const isCalendar = activePage === 'calendar';
  const isHome = activePage === 'home';
  const isMessages = activePage === 'messages';
  const isCalls = activePage === 'calls';
  const isTasks = activePage === 'tasks';
  const isCampaign = activePage === 'campaign';
  const settingsNavItem = useAppStore(s => s.settingsNavItem);
  const selectedPatientId = useAppStore(s => s.selectedPatientId);
  const pgRuleBuilder = useAppStore(s => s.pgRuleBuilder);
  const navigateBackToWorklist = useAppStore(s => s.navigateBackToWorklist);
  const navigateToPatient = useAppStore(s => s.navigateToPatient);
  const patients = useAppStore(s => s.patients);
  const hccMembers = useAppStore(s => s.hccMembers);
  const awvMembers = useAppStore(s => s.awvMembers) || [];
  const ccmWorklistMembers = useAppStore(s => s.ccmWorklistMembers) || [];
  const snpWorklistMembers = useAppStore(s => s.snpWorklistMembers) || [];
  const allPatients = useAppStore(s => s.allPatients) || [];
  const fetchPatients = useAppStore(s => s.fetchPatients);
  const fetchAllPatients = useAppStore(s => s.fetchAllPatients);
  const openQuickView = useAppStore(s => s.openQuickView);
  const activeSubnavList = useAppStore(s => s.activeSubnavList);

  // Search must cover every patient the app knows about, not just the TOC
  // slice — the worklist slices are prefetched by SubNav on Population, but
  // the TopBar also renders on pages without a SubNav, so it owns the two
  // fetches its index depends on.
  //
  // These are deliberately NOT kicked at mount, and not on a timer either.
  // `patients` (51 KB) and `all_patients` (100 KB) are the two heaviest
  // queries in the app, and firing them during first paint put them in
  // contention with whatever the current page was loading: on
  // Settings → Users the page's own `profiles` query measured ~300 ms alone
  // and ~3.2 s behind these two.
  //
  // requestIdleCallback was tried and does NOT solve this — idle arrives
  // while the route's lazy chunk is still downloading, so the prefetch fired
  // at ~1.0 s and the page's own query at ~1.3 s, i.e. still ahead of it.
  // Any delay long enough to clear an arbitrary page's fetches would be a
  // guess.
  //
  // So: warm on intent instead. Pointer-enter on the search box starts the
  // fetch while the user is still moving toward it, and focus covers keyboard
  // users. A page load where nobody searches costs nothing. Both fetches are
  // store-guarded single-fire, so calling this repeatedly is free.
  const warmSearchIndex = useCallback(() => {
    fetchPatients();
    fetchAllPatients();
  }, [fetchPatients, fetchAllPatients]);

  // Unified search index. Priority order matters twice over: profile-backed
  // slices come first so their rows win the dedupe (their ids resolve in
  // PatientDetailView), and all_patients fills in everyone else (its rows
  // have no profile view yet, so selecting one opens the QuickView drawer).
  // Dedupe key: normalized memberId — the one identity field every slice
  // shares. Same-name patients with different member ids are DIFFERENT
  // people and must all appear.
  const searchIndex = useMemo(() => {
    const norm = (v) => String(v || '').replace(/^#/, '').trim().toLowerCase();
    const seen = new Set();
    const index = [];
    const add = (rows, navigable) => {
      for (const m of rows || []) {
        const key = norm(m.memberId) || `id:${m.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        index.push({
          id: m.id,
          name: m.name,
          initials: m.initials || m.in || '',
          memberId: m.memberId,
          gender: m.gender || m.g || '',
          age: m.age || '',
          language: m.language,
          navigable,
        });
      }
    };
    add(patients, true);
    add(hccMembers, true);
    add(awvMembers, true);
    add(ccmWorklistMembers, true);
    add(snpWorklistMembers, true);
    add(allPatients, false);
    return index;
  }, [patients, hccMembers, awvMembers, ccmWorklistMembers, snpWorklistMembers, allPatients]);

  const searchResults = searchQuery.trim().length >= 2
    ? searchIndex.filter(p => {
        const q = searchQuery.toLowerCase().trim();
        return p.name?.toLowerCase().includes(q) ||
          String(p.memberId || '').toLowerCase().includes(q) ||
          p.initials?.toLowerCase().includes(q) ||
          matchesFoldId(p.memberId, q);
      }).slice(0, 10)
    : [];
  const showResults = searchFocused && searchResults.length > 0;

  useEffect(() => {
    if (!searchFocused) return;
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchFocused(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [searchFocused]);

  const handleSelectPatient = (result) => {
    if (result.navigable) {
      navigateToPatient(result.id);
    } else {
      // all_patients-only rows have no profile view yet — QuickView shows
      // their basics instead of navigating into a profile that would bounce.
      openQuickView({
        id: result.id,
        name: result.name,
        initials: result.initials,
        gender: result.gender,
        age: result.age,
        memberId: result.memberId,
        language: result.language,
      });
    }
    setSearchQuery('');
    setSearchFocused(false);
  };
  const isPatientView = activePage === 'population' && !!selectedPatientId;
  const patientName = isPatientView ? (patients.find(p => p.id === selectedPatientId)?.name || 'Patient') : '';

  return (
    <>
    <header className={styles.topbar}>
      <div className={styles.left}>
        <nav className={styles.breadcrumb}>
          {isPatientView ? (
            <>
              <button type="button" className={styles.breadcrumbLink} onClick={() => navigateBackToWorklist()}>Population</button>
              {activeSubnavList && !activeSubnavList.startsWith('pg:') && (
                <>
                  <span className={styles.sep}>/</span>
                  <button type="button" className={styles.breadcrumbLink} onClick={() => navigateBackToWorklist()}>{activeSubnavList}</button>
                </>
              )}
              <span className={styles.sep}>/</span>
              <span className={styles.breadcrumbCurrent}>{patientName}</span>
            </>
          ) : isHome ? (
            <span className={styles.breadcrumbCurrent}>Home</span>
          ) : isMessages ? (
            <span className={styles.breadcrumbCurrent}>Messages</span>
          ) : isCalls ? (
            <span className={styles.breadcrumbCurrent}>Calls</span>
          ) : isTasks ? (
            <span className={styles.breadcrumbCurrent}>Tasks</span>
          ) : isCalendar ? (
            <span className={styles.breadcrumbCurrent}>Calendar</span>
          ) : isAnalytics ? (
            <>
              <span className={styles.breadcrumbLink}>Analytics</span>
              <span className={styles.sep}>/</span>
              <span className={styles.breadcrumbCurrent}>Fold Insights</span>
            </>
          ) : isCampaign ? (
            <span className={styles.breadcrumbCurrent}>Campaign</span>
          ) : isSettings ? (
            <>
              <span className={styles.breadcrumbLink}>Settings</span>
              <span className={styles.sep}>/</span>
              <span className={styles.breadcrumbCurrent}>{SETTINGS_BREADCRUMB[settingsNavItem] || 'Automation'}</span>
            </>
          ) : activeSubnavList?.startsWith('pg:') ? (
            <>
              <span className={styles.breadcrumbLink}>Population</span>
              <span className={styles.sep}>/</span>
              {pgRuleBuilder ? (
                <>
                  <button type="button" className={styles.breadcrumbLink} onClick={() => useAppStore.getState().closePgRuleBuilder()}>Pop groups</button>
                  <span className={styles.sep}>/</span>
                  <span className={styles.breadcrumbCurrent}>{pgRuleBuilder.name}</span>
                </>
              ) : (
                <span className={styles.breadcrumbCurrent}>Pop groups</span>
              )}
            </>
          ) : (
            <>
              <span className={styles.breadcrumbLink}>Population</span>
              <span className={styles.sep}>/</span>
              <span className={styles.breadcrumbCurrent}>{activeSubnavList || 'TCM'}</span>
            </>
          )}
        </nav>
      </div>

      <div className={styles.center}>
        <div className={styles.searchWrap} ref={searchRef} onPointerEnter={warmSearchIndex}>
          <div className={styles.searchBox}>
            <Icon name="solar:magnifer-linear" size={18} color="var(--neutral-200)" />
            <input aria-label="Search members"
              type="text"
              placeholder="Search Members"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => { setSearchFocused(true); warmSearchIndex(); }}
            />
            {searchQuery && (
              <button className={styles.searchClear} onClick={() => setSearchQuery('')} aria-label="Clear search">
                <Icon name="solar:close-circle-linear" size={16} color="var(--neutral-200)" />
              </button>
            )}
          </div>
          {showResults && (
            <div className={styles.searchResults}>
              {searchResults.map(p => (
                <button
                  key={p.id}
                  className={styles.searchResultItem}
                  onClick={() => handleSelectPatient(p)}
                >
                  <Avatar variant="patient" initials={p.initials || '??'} />
                  <div className={styles.searchResultInfo}>
                    <div className={styles.searchResultName}>{p.name}</div>
                    <div className={styles.searchResultMeta}>
                      {p.gender === 'M' ? 'Male' : p.gender === 'F' ? 'Female' : p.gender} • {formatFoldId(p.memberId)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <Button variant="alt" size="L" leadingIcon="solar:bolt-bold">
          Ask Unity
        </Button>
      </div>

      <div className={styles.right}>
        <div ref={bellRef} className={styles.bellWrap}>
          <ActionButton
            icon="solar:bell-linear"
            size="L"
            tooltip="Notifications"
            onClick={() => setShowNotifications(v => !v)}
          />
          {unreadCount > 0 && (
            <span className={styles.bellBadge} aria-label={`${unreadCount} unread`}>
              {formatBadgeCount(unreadCount)}
            </span>
          )}
          {showNotifications && (
            <NotificationsPopover
              anchorRef={bellRef}
              onClose={() => setShowNotifications(false)}
            />
          )}
        </div>
        <div className={styles.createNewWrap}>
          <Button
            ref={btnRef}
            variant="primary"
            size="L"
            leadingIcon="solar:add-circle-bold"
            onClick={() => setShowCreateNew(!showCreateNew)}
          >
            Create New
          </Button>
          {showCreateNew && (
            <CreateNewPopover onClose={() => setShowCreateNew(false)} anchorRef={btnRef} />
          )}
        </div>
        <Button variant="tertiary" size="L" onClick={() => setShowSchedule(true)}>Schedule</Button>
        <div style={{ position: 'relative' }}>
          <button
            ref={profileBtnRef}
            onClick={() => setShowProfile(v => !v)}
            title="Profile"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <Avatar variant="staff" initials={initials} />
          </button>
          {showProfile && (
            <ProfilePopover
              user={user}
              anchorRef={profileBtnRef}
              onClose={() => setShowProfile(false)}
              onPreferences={() => setShowPreferences(true)}
            />
          )}
        </div>
      </div>
    </header>

    {showPreferences && <PreferencesDrawer onClose={() => setShowPreferences(false)} />}
    {showSchedule && <ScheduleDrawer onClose={() => setShowSchedule(false)} />}
  </>
  );
}

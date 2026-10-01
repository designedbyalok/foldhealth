import { useEffect, useMemo, useRef, useState } from 'react';
import { SectionTitleBar } from '../../../components/SectionTitleBar/SectionTitleBar';
import { Avatar } from '../../../components/Avatar/Avatar';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { MenuPopover } from '../../../components/MenuPopover/MenuPopover';
import { Pagination } from '../../../components/Pagination/Pagination';
import { RingEmptyState } from '../../../components/RingEmptyState/RingEmptyState';
import { TableSkeleton } from '../../../components/TableSkeleton/TableSkeleton';
import { Icon } from '../../../components/Icon/Icon';
import { useAppStore } from '../../../store/useAppStore';
import { OooUserRecordsDrawer } from '../../ooo/OooRecordsDrawers';
import { OOO_ICON } from '../../ooo/oooUtils';
import { HolidaysTab } from './HolidaysTab';
import { OooRecordsTab } from './OooRecordsTab';
import styles from './CalendarSettings.module.css';

const TABS = [
  { key: 'practice', label: 'Practice availability' },
  { key: 'users', label: 'User availability' },
  { key: 'ooo', label: 'OOO Records' },
  { key: 'types', label: 'Appointment types' },
  { key: 'suggestions', label: 'Suggestions' },
  { key: 'manage', label: 'Manage calendar' },
  { key: 'holidays', label: 'Holiday configuration' },
];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ROW_MENU = [
  { key: 'edit', icon: 'solar:pen-linear', label: 'Edit' },
  { key: 'ooo', icon: OOO_ICON, label: 'View OOO Records' },
];

function RowMenu({ onSelect }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  return (
    <span ref={ref} className={styles.menuAnchor}>
      <ActionButton icon="solar:menu-dots-linear" size="L" tooltip="More Options" tooltipLeft onClick={() => setOpen(v => !v)} />
      {open && (
        <MenuPopover
          anchorRef={ref}
          ariaLabel="User availability actions"
          items={ROW_MENU}
          width={200}
          onSelect={(key) => { setOpen(false); onSelect(key); }}
          onClose={() => setOpen(false)}
        />
      )}
    </span>
  );
}

/**
 * Settings → Calendar → User availability (Figma Eventus 17367:124389):
 * each user's weekly schedule, with View OOO Records in the row menu. Only
 * this tab is built so far; weekly hours aren't stored yet, so every day
 * reads "No Schedule".
 */
function UserAvailability({ query }) {
  const platformUsers = useAppStore(s => s.platformUsers);
  const taskProfiles = useAppStore(s => s.taskProfiles);
  const didFetch = useAppStore(s => s.platformUsersDidFetch);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  const showToast = useAppStore(s => s.showToast);
  useEffect(() => { fetchPlatformUsers?.(); }, [fetchPlatformUsers]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [oooUser, setOooUser] = useState(null);

  const users = useMemo(() => {
    const emails = Object.fromEntries((taskProfiles || []).map(p => [p.name, p.email]));
    const q = query.trim().toLowerCase();
    return (platformUsers || [])
      .map(u => ({ ...u, email: emails[u.name], role: u.clinicalRoles?.[0] || 'Staff' }))
      .filter(u => !q || u.name.toLowerCase().includes(q) || String(u.email || '').toLowerCase().includes(q));
  }, [platformUsers, taskProfiles, query]);
  // A new search starts from page 1.
  const [lastQuery, setLastQuery] = useState(query);
  if (lastQuery !== query) { setLastQuery(query); setPage(1); }
  const rows = users.slice((page - 1) * perPage, page * perPage);

  if (!didFetch) return <TableSkeleton rows={6} />;
  if (!users.length) {
    return <div className={styles.empty}><RingEmptyState icon="solar:users-group-rounded-linear" label={query ? 'No users match this search' : 'No users yet'} /></div>;
  }

  return (
    <>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.userCol}>Users</th>
              {DAYS.map(d => <th key={d}>{d.toUpperCase()}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(u => (
              <tr key={u.id || u.name}>
                <td className={styles.userCol}>
                  <span className={styles.userCell}>
                    <Avatar variant="staff" size="M" initials={u.initials} userName={u.name} />
                    <span className={styles.userText}>
                      <span className={styles.userName}>{u.name}</span>
                      <span className={styles.userSub}>{u.role}</span>
                    </span>
                    <RowMenu
                      onSelect={(key) => (key === 'ooo'
                        ? setOooUser(u)
                        : showToast('Editing user availability is coming soon'))}
                    />
                  </span>
                </td>
                {DAYS.map(d => (
                  <td key={d}>
                    <span className={styles.noSchedule}>
                      <Icon name="solar:clock-circle-linear" size={16} color="var(--neutral-200)" />
                      No Schedule
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {users.length > perPage && (
        <div className={styles.pager}>
          <Pagination totalItems={users.length} currentPage={page} perPage={perPage} onPageChange={setPage} onPerPageChange={(n) => { setPerPage(n); setPage(1); }} />
        </div>
      )}
      {oooUser && (
        <OooUserRecordsDrawer
          user={{ id: oooUser.id, name: oooUser.name, email: oooUser.email, role: oooUser.role }}
          onClose={() => setOooUser(null)}
        />
      )}
    </>
  );
}

export function CalendarSettings() {
  const [tab, setTab] = useState('users');
  const [query, setQuery] = useState('');
  // OOO Records owns its tab row's tools (search, filters, New OOO Record).
  if (tab === 'ooo') return <OooRecordsTab tabs={TABS} activeTab={tab} onTabChange={setTab} />;
  if (tab === 'holidays') return <HolidaysTab tabs={TABS} activeTab={tab} onTabChange={setTab} />;
  return (
    <div className={styles.wrapper}>
      <SectionTitleBar
        tabs={TABS}
        activeTab={tab}
        onTabChange={setTab}
        actions={tab === 'users' ? ['search'] : []}
        searchPlaceholder="Search users"
        searchValue={query}
        onSearchChange={setQuery}
      />
      <div className={styles.content}>
        {tab === 'users' ? (
          <UserAvailability query={query} />
        ) : (
          <div className={styles.empty}>
            <RingEmptyState icon="solar:calendar-linear" label={`${TABS.find(t => t.key === tab)?.label} is coming soon`} />
          </div>
        )}
      </div>
    </div>
  );
}

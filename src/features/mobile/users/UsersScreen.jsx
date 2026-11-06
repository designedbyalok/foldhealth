import { useMemo } from 'react';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Avatar } from '../../../components/Avatar/Avatar';
import { Badge } from '../../../components/Badge/Badge';
import { FilterChip } from '../../../components/FilterChip/FilterChip';
import { Input } from '../../../components/Input/Input';
import { ROLE_COLORS } from '../../settings/account/AccountPanel.constants';
import { USERS_FILTER_DEFS, statusBadge } from '../../settings/account/users/UsersTab.utils';
import { useUsersTab } from '../../settings/account/users/useUsersTab';
import { accountStatus } from '../../settings/account/users/accountLock';
import { MobileSubHeader } from '../MobileHeader';
import { MobileEmpty, MobileListSkeleton } from '../MobileParts';
import { useMobileNav } from '../MobileNavContext';
import { GroupedSection } from '../more/GroupedList';
import { NoAccountAccess } from './accountAccess';
import { useAccountAccess } from './useAccountAccess';
import common from '../mobile.module.css';
import more from '../more/more.module.css';
import styles from './users.module.css';

const EMPTY = { status: [], roles: [], location: [] };

/**
 * Settings > Account > Users on the phone: the desktop list's search, its
 * Status / Roles / Practice Location filters and the same status rules
 * (useUsersTab). `status` opens it filtered, e.g. ['Pending'] from a
 * sign-up alert or ['Locked'] from a lockout alert.
 */
export function UsersScreen({ status }) {
  const allowed = useAccountAccess();
  if (!allowed) return <NoAccountAccess title="Users" />;
  return <UsersList status={status} />;
}

function UsersList({ status }) {
  const { push } = useMobileNav();
  const tab = useUsersTab({ initialStatus: status });
  const rows = useMemo(() => [...tab.filteredUsers].sort((a, b) => a.name.localeCompare(b.name)), [tab.filteredUsers]);
  // Per-status counts, under the unfiltered list.
  const counts = useMemo(() => {
    const out = {};
    for (const u of tab.filteredUsers) {
      const s = accountStatus(u);
      out[s] = (out[s] || 0) + 1;
    }
    return out;
  }, [tab.filteredUsers]);
  const filtered = tab.userFiltersActive > 0 || tab.searchVal.trim();
  const setFilter = (key, vals) => tab.setUserFilters(f => ({ ...f, [key]: vals }));

  return (
    <div className={common.screen}>
      <MobileSubHeader
        title="Users"
        actions={<ActionButton icon="solar:user-plus-linear" size="lg" aria-label="Invite user" onClick={() => push('settingsInviteUser')} />}
      />
      <div className={more.toolbar}>
        <Input
          leadingIcon="solar:magnifer-linear"
          size="lg"
          type="search"
          placeholder="Search users"
          enterKeyHint="search"
          aria-label="Search users"
          value={tab.searchVal}
          onValueChange={tab.setSearchVal}
        />
        <div className={more.chips}>
          {USERS_FILTER_DEFS.map(def => (
            <FilterChip
              key={def.key}
              label={def.label}
              options={tab.filterOptions[def.key] || []}
              selected={tab.userFilters[def.key]}
              onChange={(vals) => setFilter(def.key, vals)}
              searchable={def.key !== 'status'}
            />
          ))}
        </div>
      </div>
      <div className={common.body}>
        {tab.loading && tab.users.length === 0 ? <MobileListSkeleton height={88} /> : rows.length === 0 ? (
          <MobileEmpty
            icon="solar:magnifer-linear"
            title="No users found"
            description={filtered ? 'Try a different search or clear the filters.' : undefined}
            action={tab.userFiltersActive > 0 ? (
              <button type="button" className={styles.linkBtn} onClick={() => tab.setUserFilters(EMPTY)}>Clear filters</button>
            ) : undefined}
          />
        ) : (
          <div className={more.stack}>
            <GroupedSection label={filtered ? `${rows.length} of ${tab.users.length} users` : `${rows.length} users`}>
              {rows.map(u => <UserRow key={u.id} user={u} onOpen={() => push('settingsUser', { userId: u.id, user: u })} />)}
            </GroupedSection>
            {!filtered && Object.keys(counts).length > 1 && (
              <p className={styles.counts}>
                {Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)).map(([s, n]) => `${n} ${s}`).join(' · ')}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function UserRow({ user, onOpen }) {
  const status = accountStatus(user);
  const sb = statusBadge(status);
  return (
    <button type="button" className={styles.userRow} onClick={onOpen} aria-label={`${user.name}, ${status}`}>
      <Avatar variant="staff" size="L" initials={user.initials} userName={user.name} userId={user.id} locked={status === 'Locked'} />
      <span className={styles.userText}>
        <span className={styles.userHead}>
          <span className={styles.userName}>{user.name}</span>
          <Badge tone={sb.variant} icon={sb.icon} size="sm" label={status} />
        </span>
        {user.email && <span className={styles.userEmail}>{user.email}</span>}
        <span className={styles.userRoles}>
          <Badge tone={ROLE_COLORS[user.role] || 'neutral'} size="sm" label={user.role} />
          {user.extraRoles > 0 && <span className={styles.more}>+{user.extraRoles}</span>}
        </span>
      </span>
    </button>
  );
}

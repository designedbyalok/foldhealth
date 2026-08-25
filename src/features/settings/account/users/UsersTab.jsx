import { useState, useEffect, useMemo, useCallback } from 'react';
import { Icon } from '../../../../components/Icon/Icon';
import { SectionTitleBar } from '../../../../components/SectionTitleBar/SectionTitleBar';
import { FilterBar } from '../../../../components/FilterBar/FilterBar';
import { WorklistShell } from '../../../../components/WorklistShell/WorklistShell';
import { useTableSort } from '../../../../components/HeaderCell/useTableSort';
import { ViewUserDrawer, EditUserDrawer } from '../AccountPanel';
import { InviteUserDrawer } from '../InviteUserDrawer';
import { USERS_FILTER_DEFS, USERS_COLUMNS } from './UsersTab.utils';
import { useUsersTab } from './useUsersTab';
import { UsersTabRow } from './UsersTabRow';
import panelStyles from '../AccountPanel.module.css';

export function UsersTab({ tabsForBar, activeTab, setActiveTab }) {
  const tab = useUsersTab();
  const { sorted: sortedUsers, sortKey, sortDir, requestSort } = useTableSort(tab.filteredUsers, 'name');
  const [userPage, setUserPage] = useState(1);
  const [userPerPage, setUserPerPage] = useState(10);

  useEffect(() => { setUserPage(1); }, [tab.searchVal, tab.userFilters, sortKey, sortDir]);

  const paginatedUsers = useMemo(
    () => sortedUsers.slice((userPage - 1) * userPerPage, userPage * userPerPage),
    [sortedUsers, userPage, userPerPage],
  );

  const renderRow = useCallback((user, _i, ctx) => (
    <UsersTabRow
      key={user.id}
      user={user}
      isCurrentUserAdmin={tab.isCurrentUserAdmin}
      onView={tab.setViewingUser}
      onEdit={tab.setEditingUser}
      onResetPassword={tab.resetPassword}
      onToggleStatus={tab.toggleUserStatus}
      onDelete={tab.deleteUser}
      bulkMode={ctx.bulk?.active}
      selected={ctx.bulk?.isSelected(user.id)}
      onToggleSelect={ctx.bulk?.toggle}
    />
  ), [tab]);

  // Render-prop header: the shell owns bulk state and hands us a ready toggle.
  const header = (bulk) => (
    <SectionTitleBar
      tabs={tabsForBar}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      actions={['search', 'filter']}
      searchPlaceholder="Search users…"
      searchValue={tab.searchVal}
      onSearchChange={tab.setSearchVal}
      filterActive={tab.filterOpen}
      filterBadgeCount={tab.userFiltersActive}
      onFilter={() => tab.setFilterOpen(v => !v)}
      primaryActionLabel="Invite User"
      onPrimaryAction={() => tab.setShowInvite(true)}
      rightExtras={bulk.bulkToggle}
    />
  );

  const filterNode = (
    <FilterBar
      multiSelect
      leading={null}
      filterDefs={USERS_FILTER_DEFS}
      filters={tab.userFilters}
      onFilterChange={(k, vals) => tab.setUserFilters(f => ({ ...f, [k]: vals }))}
      onClearAll={() => tab.setUserFilters({ status: [], roles: [], location: [] })}
      getOptions={(def) => tab.filterOptions[def.key] || []}
      showMoreFilters={false}
      showSaveFilter={false}
    />
  );

  return (
    <>
      <WorklistShell
        header={header}
        showFilters={tab.filterOpen}
        filters={filterNode}
        columns={USERS_COLUMNS}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={requestSort}
        rows={paginatedUsers}
        renderRow={renderRow}
        bulkSelect={{
          resetKey: activeTab,
          entityLabel: 'user',
          entityLabelPlural: 'users',
          onDelete: tab.deleteUsersBulk,
          confirmDescription: 'Are you sure you want to delete the selected users? This permanently removes them from the platform and cannot be undone.',
        }}
        loading={tab.loading && paginatedUsers.length === 0}
        emptyState={
          <div className={panelStyles.emptyState}>
            <Icon name="solar:magnifer-linear" size={40} color="var(--neutral-150)" />
            <p className={panelStyles.emptyTitle}>No users found</p>
          </div>
        }
        page={userPage}
        perPage={userPerPage}
        totalItems={tab.filteredUsers.length}
        onPageChange={setUserPage}
        onPageSizeChange={(pp) => { setUserPerPage(pp); setUserPage(1); }}
        minTableWidth={1400}
      />

      {tab.viewingUser && (
        <ViewUserDrawer
          user={tab.viewingUser}
          onClose={() => tab.setViewingUser(null)}
          onEdit={() => { tab.setEditingUser(tab.viewingUser); tab.setViewingUser(null); }}
        />
      )}
      {tab.editingUser && (
        <EditUserDrawer
          user={tab.editingUser}
          onClose={() => tab.setEditingUser(null)}
          onSave={(updates) => tab.saveUserProfile(tab.editingUser.id, updates)}
        />
      )}
      {tab.showInvite && (
        <InviteUserDrawer
          onClose={() => tab.setShowInvite(false)}
          onInvited={() => { tab.setShowInvite(false); tab.fetchUsers(); }}
        />
      )}
    </>
  );
}

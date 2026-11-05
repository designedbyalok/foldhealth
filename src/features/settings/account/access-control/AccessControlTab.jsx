import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../../../store/useAppStore';
import { CardSkeleton } from '../../../../components/CardSkeleton/CardSkeleton';
import { ConfirmDialog } from '../../../../components/ConfirmDialog/ConfirmDialog';
import { RolesList } from './RolesList';
import { RolePermissionsPanel } from './RolePermissionsPanel';
import { CopyPermissionsDialog } from './CopyPermissionsDialog';
import { RoleUsersDialog } from './RoleUsersDialog';
import { roleMenuItems, usersWithRole, usersWithOnlyRole } from './accessControlUtils';
import { PLATFORM_PERMISSIONS, SETTINGS_PERMISSIONS } from '../../../../lib/accessControl';
import styles from './AccessControl.module.css';

/**
 * Settings > Account > Access Control (Figma Simplifying Implementation
 * 55:42414). Roles on the left; the selected role's Platform and Settings
 * permissions on the right. Switches save as they change. What a role can't
 * see is hidden from its users in the app (src/lib/accessControl.js).
 */
export function AccessControlTab() {
  const accessRoles = useAppStore(s => s.accessRoles);
  const loading = useAppStore(s => s.accessRolesLoading);
  const didFetch = useAppStore(s => s.accessRolesDidFetch);
  const fetchAccessRoles = useAppStore(s => s.fetchAccessRoles);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  const people = useAppStore(s => s.platformPeople);
  const isAdmin = useAppStore(s => s.currentUserIsAdmin);
  const setRolePermissions = useAppStore(s => s.setRolePermissions);
  const createAccessRole = useAppStore(s => s.createAccessRole);
  const duplicateAccessRole = useAppStore(s => s.duplicateAccessRole);
  const renameAccessRole = useAppStore(s => s.renameAccessRole);
  const deleteAccessRole = useAppStore(s => s.deleteAccessRole);
  const copyRolePermissions = useAppStore(s => s.copyRolePermissions);

  useEffect(() => { fetchAccessRoles(); fetchPlatformUsers(); }, [fetchAccessRoles, fetchPlatformUsers]);

  // Only admins change access. The dev sign-in bypass isn't a real user, so
  // it can still try the screen locally (the database refuses its writes).
  const canEdit = isAdmin || (import.meta.env.DEV && sessionStorage.getItem('__auth_bypass') === 'true');

  const [selectedId, setSelectedId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [copyFromId, setCopyFromId] = useState(null);
  const [usersRoleId, setUsersRoleId] = useState(null);
  const [deleteState, setDeleteState] = useState(null); // { role, blocked, holders }

  const roles = useMemo(() => accessRoles || [], [accessRoles]);
  // While a new role is being named, the panel previews it: "Untitled", all off.
  const selected = creating ? null : (roles.find(r => r.id === selectedId) || roles[0] || null);
  const userCounts = useMemo(
    () => Object.fromEntries(roles.map(r => [r.id, usersWithRole(people, r.name).length])),
    [roles, people],
  );

  const handleMenu = async (key, role) => {
    if (key === 'duplicate') {
      const id = await duplicateAccessRole(role.id);
      if (id) setSelectedId(id);
    } else if (key === 'rename') {
      setRenamingId(role.id);
    } else if (key === 'copy') {
      setCopyFromId(role.id);
    } else if (key === 'delete') {
      const onlyRole = usersWithOnlyRole(people, role.name).length;
      setDeleteState({ role, blocked: onlyRole, holders: usersWithRole(people, role.name).length });
    }
  };

  // A new role starts with nothing switched on (Figma "Untitled"); the admin
  // turns on what it needs.
  const handleCreate = async (name) => {
    const id = await createAccessRole(name, Object.fromEntries([...PLATFORM_PERMISSIONS, ...SETTINGS_PERMISSIONS].map(p => [p.key, false])));
    if (id) { setCreating(false); setSelectedId(id); }
  };

  const handleRename = async (role, name) => {
    if (await renameAccessRole(role.id, name)) setRenamingId(null);
  };

  if (!didFetch || (loading && roles.length === 0)) {
    return <div className={styles.loading}><CardSkeleton count={4} /></div>;
  }

  const deleteRole = deleteState?.role;
  return (
    <div className={styles.layout}>
      <RolesList
        roles={roles}
        selectedId={selected?.id}
        userCounts={userCounts}
        canEdit={canEdit}
        creating={creating}
        renamingId={renamingId}
        onSelect={(id) => { setSelectedId(id); setCreating(false); }}
        onStartCreate={() => { setCreating(true); setRenamingId(null); }}
        onCancelCreate={() => setCreating(false)}
        onCreate={handleCreate}
        onCancelRename={() => setRenamingId(null)}
        onRename={handleRename}
        onMenu={handleMenu}
      />

      <RolePermissionsPanel
        role={selected}
        userCount={selected ? userCounts[selected.id] || 0 : 0}
        canEdit={canEdit && !!selected}
        menuItems={selected ? roleMenuItems(selected, canEdit) : []}
        onMenu={(key) => selected && handleMenu(key, selected)}
        onOpenUsers={() => selected && setUsersRoleId(selected.id)}
        onChange={(patch) => selected && setRolePermissions(selected.id, patch)}
      />

      {copyFromId && (
        <CopyPermissionsDialog
          from={roles.find(r => r.id === copyFromId)}
          roles={roles.filter(r => r.id !== copyFromId)}
          onCancel={() => setCopyFromId(null)}
          onConfirm={async (ids) => { await copyRolePermissions(copyFromId, ids); setCopyFromId(null); }}
        />
      )}

      {usersRoleId && (
        <RoleUsersDialog
          role={roles.find(r => r.id === usersRoleId)}
          users={usersWithRole(people, roles.find(r => r.id === usersRoleId)?.name)}
          onClose={() => setUsersRoleId(null)}
        />
      )}

      {deleteRole && deleteState.blocked > 0 && (
        <ConfirmDialog
          variant="primary"
          icon="solar:shield-warning-linear"
          title={`${deleteRole.name} can't be deleted yet`}
          description={`${deleteState.blocked} ${deleteState.blocked === 1 ? 'user has' : 'users have'} only this role. Give ${deleteState.blocked === 1 ? 'them' : 'each of them'} another role in Users, then delete it.`}
          confirmLabel="Okay, understood"
          cancelLabel={null}
          onConfirm={() => setDeleteState(null)}
          onCancel={() => setDeleteState(null)}
        />
      )}

      {deleteRole && deleteState.blocked === 0 && (
        <ConfirmDialog
          variant="destructive"
          icon="solar:trash-bin-2-linear"
          title={`Delete ${deleteRole.name}?`}
          description={deleteState.holders > 0
            ? `It comes off the ${deleteState.holders} ${deleteState.holders === 1 ? 'user' : 'users'} who have it. They keep their other roles.`
            : 'Nobody has this role. This can\'t be undone.'}
          confirmLabel="Delete Role"
          onCancel={() => setDeleteState(null)}
          onConfirm={async () => {
            const ok = await deleteAccessRole(deleteRole.id);
            setDeleteState(null);
            if (ok && selected?.id === deleteRole.id) setSelectedId(null);
          }}
        />
      )}
    </div>
  );
}

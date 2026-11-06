import { useState } from 'react';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { Avatar } from '../../../components/Avatar/Avatar';
import { BottomSheet, BottomSheetItem } from '../../../components/BottomSheet/BottomSheet';
import { Button } from '../../../components/Button/Button';
import { DesktopOnlyNote } from '../../../components/DesktopOnlyNote/DesktopOnlyNote';
import { Switch } from '../../../components/Switch/Switch';
import { useAppStore } from '../../../store/useAppStore';
import {
  PLATFORM_NAV_PERMISSIONS, PLATFORM_OTHER_PERMISSIONS, SETTINGS_PERMISSIONS, isAllowedFor,
} from '../../../lib/accessControl';
import { roleMenuItems, usersWithOnlyRole, usersWithRole } from '../../settings/account/access-control/accessControlUtils';
import { ConfirmSheet } from '../care/CarePlanSheets';
import { MobileSubHeader } from '../MobileHeader';
import { MobileEmpty, MobileListSkeleton } from '../MobileParts';
import { useMobileNav } from '../MobileNavContext';
import { GroupedRow, GroupedSection } from '../more/GroupedList';
import { NoAccountAccess } from './accountAccess';
import { useAccessData, useAccountAccess, useCanEditAccess } from './useAccountAccess';
import { RoleNameSheet } from './RolesScreen';
import common from '../mobile.module.css';
import more from '../more/more.module.css';
import styles from './users.module.css';

const GROUPS = [
  { label: 'Nav bar accesses', items: PLATFORM_NAV_PERMISSIONS },
  { label: 'Other accesses', items: PLATFORM_OTHER_PERMISSIONS },
  { label: 'Settings access', items: SETTINGS_PERMISSIONS },
];
const allTo = (list, on) => Object.fromEntries(list.map(p => [p.key, on]));

/**
 * One role (desktop RolePermissionsPanel + RoleUsersDialog): who has it and
 * its Platform and Settings switches, saved as they change
 * (setRolePermissions). Duplicate, rename and delete go through the same
 * store actions; Copy Permissions stays on a computer.
 */
export function RoleScreen(props) {
  const allowed = useAccountAccess();
  if (!allowed) return <NoAccountAccess title="Role" />;
  return <Role {...props} />;
}

function Role({ roleId }) {
  useAccessData();
  const { pop, replace } = useMobileNav();
  const roles = useAppStore(s => s.accessRoles) || [];
  const didFetch = useAppStore(s => s.accessRolesDidFetch);
  const people = useAppStore(s => s.platformPeople);
  const setRolePermissions = useAppStore(s => s.setRolePermissions);
  const duplicateAccessRole = useAppStore(s => s.duplicateAccessRole);
  const renameAccessRole = useAppStore(s => s.renameAccessRole);
  const deleteAccessRole = useAppStore(s => s.deleteAccessRole);
  const canEdit = useCanEditAccess();
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(null); // { blocked, holders }
  const [showUsers, setShowUsers] = useState(false);
  const role = roles.find(r => r.id === roleId);

  if (!role) {
    return (
      <div className={common.screen}>
        <MobileSubHeader title="Role" />
        <div className={common.body}>
          {!didFetch ? <MobileListSkeleton count={4} height={56} /> : <MobileEmpty icon="solar:shield-cross-linear" title="Role not found" />}
        </div>
      </div>
    );
  }

  const members = usersWithRole(people, role.name).sort((a, b) => a.name.localeCompare(b.name));
  const items = roleMenuItems(role, canEdit).filter(i => i.key !== 'copy');
  const onMenu = async (key) => {
    setMenu(false);
    if (key === 'duplicate') {
      const id = await duplicateAccessRole(role.id);
      if (id) replace('settingsRole', { roleId: id });
    } else if (key === 'rename') {
      setRenaming(true);
    } else if (key === 'delete') {
      setDeleting({ blocked: usersWithOnlyRole(people, role.name).length, holders: members.length });
    }
  };

  return (
    <div className={common.screen}>
      <MobileSubHeader
        title={role.name}
        actions={items.length ? <ActionButton icon="solar:menu-dots-linear" size="lg" aria-label="Role actions" onClick={() => setMenu(true)} /> : null}
      />
      <div className={common.body}>
        <div className={more.stack}>
          <GroupedSection label="Users">
            <GroupedRow
              icon="solar:users-group-rounded-linear"
              label={`${members.length} ${members.length === 1 ? 'user' : 'users'}`}
              detail={members.length ? (showUsers ? 'Hide' : 'Show') : undefined}
              chevron={false}
              onClick={members.length ? () => setShowUsers(v => !v) : undefined}
            />
            {showUsers && members.map(u => (
              <div key={u.id} className={styles.memberRow}>
                <Avatar variant="staff" size="M" initials={u.initials} userName={u.name} userId={u.id} />
                <span className={styles.userText}>
                  <span className={styles.userName}>{u.name}</span>
                  {u.email && <span className={styles.userEmail}>{u.email}</span>}
                </span>
              </div>
            ))}
          </GroupedSection>

          {GROUPS.map(g => {
            const allOn = g.items.every(p => isAllowedFor(role, p.key));
            return (
              <GroupedSection key={g.label} label={g.label}>
                {canEdit && (
                  <GroupedRow
                    label={allOn ? 'Turn all off' : 'Turn all on'}
                    tone="muted"
                    chevron={false}
                    onClick={() => setRolePermissions(role.id, allTo(g.items, !allOn))}
                  />
                )}
                {g.items.map(p => (
                  <GroupedRow
                    key={p.key}
                    label={p.label}
                    trailing={(
                      <span className={styles.switchWrap}>
                        <Switch
                          checked={isAllowedFor(role, p.key)}
                          disabled={!canEdit}
                          ariaLabel={p.label}
                          onChange={(on) => setRolePermissions(role.id, { [p.key]: on })}
                        />
                      </span>
                    )}
                  />
                ))}
              </GroupedSection>
            );
          })}
          {!canEdit && <p className={styles.counts}>Only practice admins can change access.</p>}
          {canEdit && <DesktopOnlyNote description="Copy one role's permissions onto other roles from Settings > Account > Access Control on a computer." />}
        </div>
      </div>

      {menu && (
        <BottomSheet title={role.name} onClose={() => setMenu(false)}>
          {items.map(i => (
            <BottomSheetItem
              key={i.key}
              icon={i.icon}
              label={i.label}
              detail={i.hint}
              tone={i.danger ? 'danger' : 'neutral'}
              disabled={i.disabled}
              onClick={() => onMenu(i.key)}
            />
          ))}
        </BottomSheet>
      )}
      {renaming && (
        <RoleNameSheet
          title="Rename role"
          initial={role.name}
          confirmLabel="Save"
          onSave={async (name) => { if (await renameAccessRole(role.id, name)) setRenaming(false); }}
          onClose={() => setRenaming(false)}
        />
      )}
      {deleting && deleting.blocked > 0 && (
        <BottomSheet title={`${role.name} can't be deleted yet`} onClose={() => setDeleting(null)}>
          <p className={styles.sheetText}>
            {deleting.blocked} {deleting.blocked === 1 ? 'user has' : 'users have'} only this role. Give {deleting.blocked === 1 ? 'them' : 'each of them'} another role in Users, then delete it.
          </p>
          <Button size="lg" onClick={() => setDeleting(null)}>Okay, understood</Button>
        </BottomSheet>
      )}
      {deleting && deleting.blocked === 0 && (
        <ConfirmSheet
          title={`Delete ${role.name}?`}
          text={deleting.holders > 0
            ? `It comes off the ${deleting.holders} ${deleting.holders === 1 ? 'user' : 'users'} who have it. They keep their other roles.`
            : 'Nobody has this role. This can\'t be undone.'}
          confirmLabel="Delete role"
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            const ok = await deleteAccessRole(role.id);
            setDeleting(null);
            if (ok) pop();
          }}
        />
      )}
    </div>
  );
}

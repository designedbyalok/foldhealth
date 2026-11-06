import { useMemo, useState } from 'react';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { BottomSheet } from '../../../components/BottomSheet/BottomSheet';
import { Button } from '../../../components/Button/Button';
import { Input } from '../../../components/Input/Input';
import { useAppStore } from '../../../store/useAppStore';
import { PLATFORM_PERMISSIONS, SETTINGS_PERMISSIONS, countAllowed } from '../../../lib/accessControl';
import { usersWithRole } from '../../settings/account/access-control/accessControlUtils';
import { MobileSubHeader } from '../MobileHeader';
import { MobileListSkeleton } from '../MobileParts';
import { useMobileNav } from '../MobileNavContext';
import { GroupedRow, GroupedSection } from '../more/GroupedList';
import { NoAccountAccess } from './accountAccess';
import { useAccessData, useAccountAccess, useCanEditAccess } from './useAccountAccess';
import common from '../mobile.module.css';
import more from '../more/more.module.css';
import styles from './users.module.css';

/**
 * Settings > Account > Access Control: every role with how many people have
 * it and how many permissions are on. Admins add a role here (all off,
 * like desktop's "Untitled").
 */
export function RolesScreen() {
  const allowed = useAccountAccess();
  if (!allowed) return <NoAccountAccess title="Access control" />;
  return <Roles />;
}

function Roles() {
  useAccessData();
  const { push } = useMobileNav();
  const accessRoles = useAppStore(s => s.accessRoles);
  const roles = useMemo(() => accessRoles || [], [accessRoles]);
  const loading = useAppStore(s => s.accessRolesLoading);
  const didFetch = useAppStore(s => s.accessRolesDidFetch);
  const people = useAppStore(s => s.platformPeople);
  const createAccessRole = useAppStore(s => s.createAccessRole);
  const canEdit = useCanEditAccess();
  const [creating, setCreating] = useState(false);
  const counts = useMemo(() => Object.fromEntries(roles.map(r => [r.id, usersWithRole(people, r.name).length])), [roles, people]);
  const total = PLATFORM_PERMISSIONS.length + SETTINGS_PERMISSIONS.length;

  const create = async (name) => {
    const id = await createAccessRole(name, Object.fromEntries([...PLATFORM_PERMISSIONS, ...SETTINGS_PERMISSIONS].map(p => [p.key, false])));
    if (id) { setCreating(false); push('settingsRole', { roleId: id }); }
  };

  return (
    <div className={common.screen}>
      <MobileSubHeader
        title="Access control"
        actions={canEdit ? <ActionButton icon="solar:add-circle-linear" size="lg" aria-label="New role" onClick={() => setCreating(true)} /> : null}
      />
      <div className={common.body}>
        {!didFetch || (loading && roles.length === 0) ? <MobileListSkeleton count={5} height={56} /> : (
          <div className={more.stack}>
            <GroupedSection label={`${roles.length} roles`} footer="What a role can't see is hidden from its users in the app.">
              {roles.map(r => (
                <GroupedRow
                  key={r.id}
                  icon="solar:shield-user-linear"
                  label={r.name}
                  sub={`${counts[r.id] || 0} ${counts[r.id] === 1 ? 'user' : 'users'}`}
                  detail={`${countAllowed(r, [...PLATFORM_PERMISSIONS, ...SETTINGS_PERMISSIONS])}/${total} on`}
                  onClick={() => push('settingsRole', { roleId: r.id })}
                />
              ))}
            </GroupedSection>
          </div>
        )}
      </div>
      {creating && <RoleNameSheet title="New role" confirmLabel="Create role" onSave={create} onClose={() => setCreating(false)} />}
    </div>
  );
}

/** Name a new role or rename one (desktop RoleNameField). */
export function RoleNameSheet({ title, initial = '', confirmLabel, onSave, onClose }) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!value.trim()) return;
    setBusy(true);
    try { await onSave(value.trim()); } finally { setBusy(false); }
  };
  return (
    <BottomSheet title={title} onClose={onClose}>
      <Input
        size="lg"
        label="Role name"
        placeholder="Enter the Role Name"
        enterKeyHint="done"
        value={value}
        onValueChange={setValue}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
      />
      <div className={styles.sheetActions}>
        <Button size="lg" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button size="lg" onClick={save} disabled={!value.trim() || value.trim() === initial} loading={busy}>{confirmLabel}</Button>
      </div>
    </BottomSheet>
  );
}

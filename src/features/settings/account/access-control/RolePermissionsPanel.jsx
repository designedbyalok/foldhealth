import { useState } from 'react';
import { Icon } from '../../../../components/Icon/Icon';
import { ActionButton } from '../../../../components/ActionButton/ActionButton';
import { MenuPopover } from '../../../../components/MenuPopover/MenuPopover';
import { Tooltip } from '../../../../components/Tooltip/Tooltip';
import { Link } from '../../../../components/Link/Link';
import { PermissionCard } from '../../../../components/PermissionCard/PermissionCard';
import {
  PLATFORM_NAV_PERMISSIONS, PLATFORM_OTHER_PERMISSIONS, PLATFORM_PERMISSIONS, SETTINGS_PERMISSIONS,
  isAllowedFor, countAllowed,
} from '../../../../lib/accessControl';
import styles from './AccessControl.module.css';

const PLATFORM_GROUPS = [
  { label: 'Nav Bar Accesses', items: PLATFORM_NAV_PERMISSIONS },
  { label: 'Other Accesses', items: PLATFORM_OTHER_PERMISSIONS },
];
const SETTINGS_GROUPS = [{ items: SETTINGS_PERMISSIONS }];

const allTo = (list, on) => Object.fromEntries(list.map(p => [p.key, on]));

/**
 * The selected role's header (name, users, how many permissions are on) and
 * its Platform and Settings Access cards. With no role selected (a new one
 * being named) it shows "Untitled" with everything off.
 */
export function RolePermissionsPanel({ role, userCount, canEdit, menuItems, onMenu, onOpenUsers, onChange }) {
  const [menuRect, setMenuRect] = useState(null);
  const isOn = key => (role ? isAllowedFor(role, key) : false);

  return (
    <div className={styles.permissionsPane}>
      <div className={styles.permHead}>
        <div className={styles.permTitle}>
          <span className={role ? styles.roleTitle : styles.roleTitleEmpty}>{role ? role.name : 'Untitled'}</span>
          {role && userCount > 0 ? (
            <Link variant="secondary" onClick={onOpenUsers} className={styles.usersLink}>
              ({userCount} {userCount === 1 ? 'User' : 'Users'})
            </Link>
          ) : (
            <span className={styles.usersCount}>(0 Users)</span>
          )}
        </div>
        <div className={styles.permHeadRight}>
          <Tooltip label="Platform permissions on">
            <span className={styles.counter}>
              <Icon name="solar:buildings-2-linear" size={14} color="var(--neutral-300)" />
              {role ? countAllowed(role, PLATFORM_PERMISSIONS) : '-'}/{PLATFORM_PERMISSIONS.length}
            </span>
          </Tooltip>
          <Tooltip label="Settings permissions on">
            <span className={styles.counter}>
              <Icon name="solar:settings-linear" size={14} color="var(--neutral-300)" />
              {role ? countAllowed(role, SETTINGS_PERMISSIONS) : '-'}/{SETTINGS_PERMISSIONS.length}
            </span>
          </Tooltip>
          {menuItems.length > 0 && (
            <ActionButton
              icon="solar:menu-dots-linear"
              size="sm"
              tooltip="More actions"
              tooltipLeft
              onClick={e => setMenuRect(e.currentTarget.getBoundingClientRect())}
            />
          )}
        </div>
      </div>

      <div className={styles.cards}>
        <PermissionCard
          icon="solar:buildings-2-linear"
          title="Platform Access"
          groups={PLATFORM_GROUPS}
          isOn={isOn}
          disabled={!canEdit}
          onToggle={(key, on) => onChange({ [key]: on })}
          onToggleAll={on => onChange(allTo(PLATFORM_PERMISSIONS, on))}
        />
        <PermissionCard
          icon="solar:settings-linear"
          title="Settings Access"
          groups={SETTINGS_GROUPS}
          isOn={isOn}
          disabled={!canEdit}
          onToggle={(key, on) => onChange({ [key]: on })}
          onToggleAll={on => onChange(allTo(SETTINGS_PERMISSIONS, on))}
        />
      </div>

      {menuRect && (
        <MenuPopover
          anchorRect={menuRect}
          items={menuItems}
          onSelect={(key) => { setMenuRect(null); onMenu(key); }}
          onClose={() => setMenuRect(null)}
          ariaLabel="Role actions"
        />
      )}
    </div>
  );
}

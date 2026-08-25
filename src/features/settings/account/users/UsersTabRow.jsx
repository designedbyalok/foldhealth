import { Badge } from '../../../../components/Badge/Badge';
import { Avatar } from '../../../../components/Avatar/Avatar';
import { Checkbox } from '../../../../components/ShadcnCheckbox/ShadcnCheckbox';
import { ROLE_COLORS } from '../AccountPanel.constants';
import { statusBadge, formatDate, formatRelative } from './UsersTab.utils';
import { UserActions } from './UserActions';
import { OverflowBadge } from './OverflowBadge';
import styles from './UserRow.module.css';

export function UsersTabRow({
  user,
  isCurrentUserAdmin,
  onView,
  onEdit,
  onResetPassword,
  onToggleStatus,
  onDelete,
  bulkMode = false,
  selected = false,
  onToggleSelect,
}) {
  const sb = statusBadge(user.status);
  const rel = formatRelative(user.lastActiveAt);

  return (
    <tr
      key={user.id}
      className={`${styles.row} ${bulkMode && selected ? styles.rowSelected : ''}`}
    >
      {bulkMode && (
        <td className={`${styles.checkTd} ${styles.stickyLeft}`} style={{ left: 0 }}>
          <Checkbox checked={selected} onCheckedChange={() => onToggleSelect?.(user.id)} aria-label={`Select ${user.name}`} />
        </td>
      )}
      <td className={`${styles.membersTd} ${styles.stickyLeft}`} style={{ left: bulkMode ? 36 : 0 }}>
        <button
          type="button"
          className={styles.userCell}
          onClick={() => (bulkMode ? onToggleSelect?.(user.id) : onView(user))}
        >
          <Avatar variant="staff" size="M" initials={user.initials} />
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user.name}</span>
            <span className={styles.userEmail}>{user.email}</span>
          </div>
        </button>
      </td>
      <td className={styles.td}>
        <Badge variant={sb.variant} icon={sb.icon} label={user.status} />
      </td>
      <td className={styles.td}>
        <div className={styles.rolesCell}>
          <Badge variant={ROLE_COLORS[user.role] || 'ai-neutral'} label={user.role} />
          {user.extraRoles > 0 && (
            <OverflowBadge count={user.extraRoles} items={user.clinicalRoles?.slice(1) || []} />
          )}
        </div>
      </td>
      <td className={styles.td}>
        {user.location ? (
          <div className={styles.locationCell}>
            <span>{user.location}</span>
            {user.extraLocations > 0 && (
              <OverflowBadge count={user.extraLocations} items={user.locations?.slice(1) || []} />
            )}
          </div>
        ) : (
          <span className={styles.emptyDash}>—</span>
        )}
      </td>
      <td className={styles.td}>{formatDate(user.createdAt)}</td>
      <td className={styles.td}>
        <div className={styles.dateStack}>
          <span>{formatDate(user.lastActiveAt)}</span>
          {rel && (
            <span className={`${styles.dateRelative} ${rel.tone === 'fresh' ? styles.dateRelativeFresh : styles.dateRelativeStale}`}>
              {rel.label}
            </span>
          )}
        </div>
      </td>
      <td className={`${styles.td} ${styles.stickyRight}`}>
        <UserActions
          user={user}
          isAdmin={isCurrentUserAdmin}
          onResetPassword={() => onResetPassword(user)}
          onToggleStatus={() => onToggleStatus(user)}
          onEdit={() => onEdit(user)}
          onDelete={() => onDelete(user)}
        />
      </td>
    </tr>
  );
}

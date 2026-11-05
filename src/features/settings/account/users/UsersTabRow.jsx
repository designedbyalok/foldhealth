import { Badge } from '../../../../components/Badge/Badge';
import { Avatar } from '../../../../components/Avatar/Avatar';
import { BulkCheckboxCell } from '../../../../components/BulkSelect/BulkCheckboxCell';
import { ROLE_COLORS } from '../AccountPanel.constants';
import { statusBadge, formatDate, formatRelative } from './UsersTab.utils';
import { UserActions } from './UserActions';
import { OverflowBadge } from './OverflowBadge';
import { accountStatus, isLocked, formatLockTime } from './accountLock';
import styles from './UserRow.module.css';

export function UsersTabRow({
  user,
  isCurrentUserAdmin,
  onView,
  onEdit,
  onViewOoo,
  onResetPassword,
  onUnlock,
  onToggleStatus,
  onReviewSignup,
  onDelete,
  bulkMode = false,
  selected = false,
  onToggleSelect,
}) {
  const status = accountStatus(user);
  const sb = statusBadge(status);
  const rel = formatRelative(user.lastActiveAt);

  return (
    <tr
      key={user.id}
      className={`${styles.row} ${bulkMode && selected ? styles.rowSelected : ''}`}
    >
      {bulkMode && (
        <BulkCheckboxCell selected={selected} onToggle={() => onToggleSelect?.(user.id)} label={`Select ${user.name}`} />
      )}
      <td className={`${styles.membersTd} ${styles.stickyLeft} ${bulkMode ? '' : styles.membersTdInset}`} style={{ left: bulkMode ? 36 : 0 }}>
        <button
          type="button"
          className={styles.userCell}
          onClick={() => (bulkMode ? onToggleSelect?.(user.id) : onView(user))}
        >
          <Avatar variant="staff" size="M" initials={user.initials} userName={user.name} locked={status === 'Locked'} />
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user.name}</span>
            <span className={styles.userEmail}>{user.email}</span>
          </div>
        </button>
      </td>
      <td className={styles.td}>
        <div className={styles.statusStack}>
          <Badge tone={sb.variant} icon={sb.icon} label={status} />
          {isLocked(user.lock) && (
            <span className={styles.lockSince}>Since {formatLockTime(user.lock.locked_at)}</span>
          )}
        </div>
      </td>
      <td className={styles.td}>
        <div className={styles.rolesCell}>
          <Badge tone={ROLE_COLORS[user.role] || 'neutral'} label={user.role} />
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
          <span className={styles.emptyDash}>-</span>
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
          locked={status === 'Locked'}
          onResetPassword={() => onResetPassword(user)}
          onUnlock={() => onUnlock(user)}
          onToggleStatus={() => onToggleStatus(user)}
          onApprove={() => onReviewSignup(user, true)}
          onReject={() => onReviewSignup(user, false)}
          onEdit={() => onEdit(user)}
          onViewOoo={onViewOoo ? () => onViewOoo(user) : undefined}
          onDelete={() => onDelete(user)}
        />
      </td>
    </tr>
  );
}

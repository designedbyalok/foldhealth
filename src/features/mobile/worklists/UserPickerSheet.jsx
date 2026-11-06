import { useMemo, useState } from 'react';
import { Avatar } from '../../../components/Avatar/Avatar';
import { BottomSheet } from '../../../components/BottomSheet/BottomSheet';
import { Icon } from '../../../components/Icon/Icon';
import { Input } from '../../../components/Input/Input';
import styles from './UserPickerSheet.module.css';

const norm = (v) => String(v || '').trim().toLowerCase();

/**
 * Pick a user for an assignee or care team role (Figma "Assign to Others",
 * 1043:48114): search, then one row per user with their role. The current
 * owner is ticked. `onUnassign` adds an Unassign row when someone is set.
 */
export function UserPickerSheet({ title = 'Change Assignee', users, current, onPick, onUnassign, onClose }) {
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = norm(query);
    return q ? users.filter(u => norm(u.name).includes(q) || norm(u.role).includes(q)) : users;
  }, [users, query]);
  const isCurrent = (u) => !!current && norm(u.name) === norm(current);

  return (
    <BottomSheet title={title} onClose={onClose}>
      <Input
        leadingIcon="solar:magnifer-linear"
        size="lg"
        type="search"
        placeholder="Search User"
        enterKeyHint="search"
        aria-label="Search users"
        value={query}
        onValueChange={setQuery}
      />
      <div className={styles.list} role="radiogroup" aria-label={title}>
        {onUnassign && current && !query && (
          <button type="button" role="radio" aria-checked={false} className={styles.row} onClick={onUnassign}>
            <span className={styles.unassignIcon}><Icon name="solar:user-cross-linear" size={24} color="currentColor" /></span>
            <span className={styles.text}><span className={styles.name}>Unassign</span></span>
          </button>
        )}
        {shown.map(u => (
          <button
            key={u.id || u.name}
            type="button"
            role="radio"
            aria-checked={isCurrent(u)}
            className={styles.row}
            onClick={() => onPick(u)}
          >
            <Avatar variant="staff" size="L" initials={u.initials} userName={u.name} userId={u.id} />
            <span className={styles.text}>
              <span className={styles.name}>{u.name}</span>
              {u.role && <span className={styles.role}>{u.role}</span>}
            </span>
            {isCurrent(u) && <Icon name="solar:check-circle-linear" size={24} color="var(--primary-300)" />}
          </button>
        ))}
        {shown.length === 0 && <p className={styles.empty}>No users match.</p>}
      </div>
    </BottomSheet>
  );
}

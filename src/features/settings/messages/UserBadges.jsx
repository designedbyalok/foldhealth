import { Badge } from '../../../components/Badge/Badge';
import { OooMark } from '../../../components/Avatar/Avatar';
import { useAppStore } from '../../../store/useAppStore';
import { activeOooFor } from '../../ooo/oooUtils';
import styles from './UserBadges.module.css';

/**
 * Users as grey name badges (an inbox's collaborators, an eFax number's
 * linked users). Someone out of office now carries the Out of Office mark
 * at the end of their badge, with their dates on hover.
 *
 * @param {object} props
 * @param {Array<{ id?: string, name: string }>} props.users
 */
export function UserBadges({ users }) {
  const records = useAppStore(s => s.oooRecords);
  return (
    <span className={styles.badges}>
      {users.map(u => {
        const record = activeOooFor(records, { id: u.id || null, name: u.name });
        return (
          <Badge
            key={u.id || u.name}
            tone="neutral"
            size="sm"
            label={u.name}
            trailingIconElement={record ? <OooMark record={record} size={12} /> : undefined}
          />
        );
      })}
    </span>
  );
}

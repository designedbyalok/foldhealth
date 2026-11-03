import { ActionButton } from '../../../../../../components/ActionButton/ActionButton';
import { Badge } from '../../../../../../components/Badge/Badge';
import { profileRowClass, profileCellClass } from '../../../../../../components/ProfileTable/profileTableClasses';
import styles from './CareGapItem.module.css';

/** One care gap as a ProfileTable row: Title, Status, actions. */
export function CareGapItem({ item, selected, onSelect, onOpen }) {
  return (
    <tr
      className={`${profileRowClass} ${styles.row} ${selected ? styles.rowSelected : ''}`}
      onClick={() => onSelect?.(item.id)}
    >
      <td className={profileCellClass}>
        <div className={styles.content}>
          {onOpen ? (
            <button
              type="button"
              className={styles.titleButton}
              onClick={(e) => { e.stopPropagation(); onOpen(item); }}
              aria-label={`Open ${item.title}`}
            >
              {item.title}
            </button>
          ) : (
            <span className={styles.title}>{item.title}</span>
          )}
          {item.diagnosis && <span className={styles.meta}>{item.diagnosis}</span>}
        </div>
      </td>
      <td className={profileCellClass}>
        <span className={styles.status}>
          {item.statusVariant ? <Badge tone={item.statusVariant} label={item.status} /> : item.status}
        </span>
      </td>
      <td className={profileCellClass} onClick={e => e.stopPropagation()}>
        <div className={styles.moreBtn}>
          <ActionButton icon="solar:menu-dots-linear" size="sm" tooltip="More" />
        </div>
      </td>
    </tr>
  );
}

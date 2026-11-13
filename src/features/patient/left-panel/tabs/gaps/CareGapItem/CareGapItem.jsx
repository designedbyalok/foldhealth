import { ActionButton } from '../../../../../../components/ActionButton/ActionButton';
import { Badge } from '../../../../../../components/Badge/Badge';
import { Icon } from '../../../../../../components/Icon/Icon';
import { profileRowClass, profileCellClass } from '../../../../../../components/ProfileTable/profileTableClasses';
import styles from './CareGapItem.module.css';

/**
 * One care gap as a ProfileTable row: Title, Status, actions. An open gap with
 * other instances (`item.previous`) gets a View Other Instances toggle;
 * `nested` renders one of those earlier instances, muted and indented, below it.
 */
export function CareGapItem({ item, selected, onSelect, onOpen, nested = false, previousOpen = false, onTogglePrevious }) {
  const previousCount = item.previous?.length || 0;
  return (
    <tr
      className={[profileRowClass, styles.row, selected ? styles.rowSelected : '', nested ? styles.rowNested : ''].filter(Boolean).join(' ')}
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
          {(item.diagnosis || previousCount > 0) && (
            <span className={styles.metaRow}>
              {item.diagnosis && <span className={styles.meta}>{item.diagnosis}</span>}
              {previousCount > 0 && (
                <>
                  {item.diagnosis && <span className={styles.meta} aria-hidden="true">•</span>}
                  <button
                    type="button"
                    className={styles.previousToggle}
                    aria-expanded={previousOpen}
                    onClick={(e) => { e.stopPropagation(); onTogglePrevious?.(); }}
                  >
                    {previousOpen ? 'Hide Other Instances' : `View Other Instances (${previousCount})`}
                    <Icon name={previousOpen ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'} size={12} color="currentColor" />
                  </button>
                </>
              )}
            </span>
          )}
        </div>
      </td>
      <td className={profileCellClass}>
        <span className={styles.status}>
          {item.statusVariant ? <Badge tone={item.statusVariant} label={item.status} /> : item.status}
        </span>
      </td>
      <td className={profileCellClass} onClick={e => e.stopPropagation()}>
        {!nested && (
          <div className={styles.moreBtn}>
            <ActionButton icon="solar:menu-dots-linear" size="sm" tooltip="More" />
          </div>
        )}
      </td>
    </tr>
  );
}

import { Icon } from '../Icon/Icon';
import styles from './NavRail.module.css';

/**
 * Light vertical navigation rail: icon over label, one active tile, optional
 * count badge. Store-free, so the patient app can use it (the staff app's
 * Sidebar reads the staff store). Same 72px width and 60px tiles as Sidebar.
 *
 *   items        [{ id, label, icon, count }] for the top group
 *   footerItems  same shape, pinned to the bottom (Help, Logout)
 *   activeId     id of the current item
 *   onSelect     (id) => void
 */
export function NavRail({ items = [], footerItems = [], activeId, onSelect, label = 'Main' }) {
  const renderItem = (item) => {
    const active = item.id === activeId;
    return (
      <li key={item.id}>
        <button
          type="button"
          className={`${styles.item} ${active ? styles.active : ''}`}
          aria-current={active ? 'page' : undefined}
          onClick={() => onSelect?.(item.id)}
        >
          <span className={styles.iconWrap}>
            <Icon name={item.icon} size={24} color="currentColor" />
            {item.count > 0 && (
              <span className={styles.badge} aria-label={`${item.count} unread`}>
                {item.count > 99 ? '99+' : item.count}
              </span>
            )}
          </span>
          <span className={styles.label}>{item.label}</span>
        </button>
      </li>
    );
  };

  return (
    <nav className={styles.rail} aria-label={label}>
      <ul className={styles.group}>{items.map(renderItem)}</ul>
      {footerItems.length > 0 && <ul className={styles.group}>{footerItems.map(renderItem)}</ul>}
    </nav>
  );
}

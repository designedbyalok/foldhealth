import { ActionButton } from '../../../../../components/ActionButton/ActionButton';
import { Badge } from '../../../../../components/Badge/Badge';
import { Icon } from '../../../../../components/Icon/Icon';
import styles from './DocumentsTab.module.css';

/** The Categories rail: one row per folder with its document count. */
export function DocumentCategoryRail({ categories, active, counts, onSelect, onAddCategory }) {
  return (
    <nav className={styles.rail} aria-label="Document categories">
      <div className={styles.railHeader}>
        <span className={styles.title}>Categories</span>
        <ActionButton icon="solar:add-folder-linear" tooltip="Add Category" tooltipLeft aria-label="Add category" onClick={onAddCategory} />
      </div>
      <ul className={styles.categoryList}>
        {categories.map(c => {
          const selected = c.key === active;
          return (
            <li key={c.key} className={`${styles.category} ${selected ? styles.categoryActive : ''}`}>
              <button type="button" className={styles.categoryButton} aria-current={selected ? 'true' : undefined} onClick={() => onSelect(c.key)}>
                <Icon name={c.icon} size={16} color={selected ? 'var(--primary-300)' : 'var(--neutral-300)'} />
                <span className={styles.categoryLabel}>{c.label}</span>
                <Badge size="xs" label={String(counts[c.key] || 0)} />
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

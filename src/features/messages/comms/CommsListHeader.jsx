import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { BulkSelectToggle } from '../../../components/BulkSelect/BulkSelectToggle';
import styles from './CommsListHeader.module.css';

/**
 * The header of a Comms list column (Figma Communications 40:225565):
 * collapse the Comms nav, the list's title with its count beneath, then
 * search, bulk select and filter. Omit a handler to leave its button out.
 */
export function CommsListHeader({
  title,
  sub,
  navCollapsed = false,
  onToggleNav,
  searchActive = false,
  onSearch,
  bulkActive = false,
  onBulk,
  filterActive = false,
  onFilter,
}) {
  const right = [
    onSearch && (
      <ActionButton key="search" icon="solar:magnifer-linear" size="sm" tooltip="Search" active={searchActive} onClick={onSearch} />
    ),
    onBulk && <BulkSelectToggle key="bulk" size="sm" active={bulkActive} onToggle={onBulk} />,
    onFilter && (
      <ActionButton key="filter" icon="custom:filter" size="sm" tooltip="Filter" active={filterActive} onClick={onFilter} />
    ),
  ].filter(Boolean);

  return (
    <div className={styles.header}>
      {onToggleNav && (
        <>
          <ActionButton
            icon="custom:collapse-sidebar"
            size="sm"
            tooltip={navCollapsed ? 'Expand menu' : 'Collapse menu'}
            onClick={onToggleNav}
          />
          <span className={styles.divider} />
        </>
      )}
      <div className={styles.titleBlock}>
        <span className={styles.title}>{title}</span>
        {sub && <span className={styles.sub}>{sub}</span>}
      </div>
      <div className={styles.actions}>
        {right.map((btn, i) => (
          <span key={btn.key} className={styles.actionSlot}>
            {i > 0 && <span className={styles.divider} />}
            {btn}
          </span>
        ))}
      </div>
    </div>
  );
}

import { useRef, useState } from 'react';
import { DownChevronIcon } from '../Icon/DownChevronIcon';
import { Icon } from '../Icon/Icon';
import { MenuPopover } from '../MenuPopover/MenuPopover';
import styles from './FilterBar.module.css';

export function FilterBarTail({
  tailRef,
  moreBtnRef,
  actions = [],
  moreRect,
  onOpenMore,
  onCloseMore,
  hasActive,
  onClearAll,
  onSaveFilter,
  onOpenSaveDialog,
  clearAllLabel = 'Clear All',
  clearAllIcon = false,
  saveLabel = 'Save Filter',
  saveMenuItems,
  onSaveMenuSelect,
}) {
  const hasAction = (key) => actions.includes(key);
  const saveRef = useRef(null);
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const saveNew = () => {
    if (hasAction('saveFilterDialog')) onOpenSaveDialog();
    else onSaveFilter();
  };

  return (
    <div className={styles.tail} ref={tailRef}>
      {hasAction('moreFilters') && (
        <button
          ref={moreBtnRef}
          type="button"
          className={[styles.moreBtn, moreRect ? styles.moreBtnActive : ''].join(' ')}
          onClick={moreRect ? onCloseMore : onOpenMore}
        >
          More Filters
          <DownChevronIcon color={moreRect ? 'var(--primary-300)' : 'var(--neutral-300)'} />
        </button>
      )}

      {/* More Filters | Clear All | Save Filter. */}
      {hasActive && (
        <>
          {hasAction('moreFilters') && <span className={styles.vDivider} />}
          <button className={styles.clearAll} onClick={onClearAll}>
            {clearAllIcon && <Icon name="solar:close-circle-linear" size={16} color="currentColor" />}
            {clearAllLabel}
          </button>
          {(hasAction('saveFilter') || hasAction('saveFilterDialog')) && (
            <>
              <span className={styles.vDivider} />
              {saveMenuItems?.length ? (
                <>
                  <button
                    ref={saveRef}
                    type="button"
                    className={styles.saveFilter}
                    aria-haspopup="menu"
                    aria-expanded={saveMenuOpen}
                    onClick={() => setSaveMenuOpen(o => !o)}
                  >
                    Save Filter
                    <DownChevronIcon color="var(--primary-300)" />
                  </button>
                  {saveMenuOpen && (
                    <MenuPopover
                      anchorRef={saveRef}
                      align="right"
                      width="auto"
                      ariaLabel="Save filter"
                      items={saveMenuItems}
                      onSelect={(key) => { setSaveMenuOpen(false); onSaveMenuSelect?.(key); }}
                      onClose={() => setSaveMenuOpen(false)}
                    />
                  )}
                </>
              ) : (
                <button className={styles.saveFilter} onClick={saveNew}>
                  {saveLabel}
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

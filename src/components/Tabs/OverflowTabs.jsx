import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icon/Icon';
import { Tabs } from './Tabs';
import tabStripStyles from './Tabs.module.css';
import styles from './OverflowTabs.module.css';

const MORE_RESERVE_PX = 72;

/**
 * Underline Tabs with responsive overflow: tabs that don't fit collapse into a
 * "More ▾" dropdown. Active tab is always kept visible by swapping it into
 * the last visible slot when needed. Same behavior as SectionTitleBar tabs.
 *
 * `itemAction` (optional) adds a trailing icon button to dropdown rows:
 * `{ icon, label: (tab) => string, onSelect: (key) => void, appliesTo?: (key) => boolean }`.
 * It sits beside the row's own button (never nested in it) so both stay
 * keyboard reachable.
 *
 * `moreActions` (optional) adds commands under the overflow tabs, after a
 * divider: `[{ key, label, icon, onSelect }]` (e.g. "Customize"). With
 * actions, More always shows, even when every tab fits.
 */
export function OverflowTabs({ items, value: activeKey, onValueChange: onChange, itemAction, moreActions }) {
  const alwaysMore = !!moreActions?.length;
  const rowRef = useRef(null);
  const measurerRef = useRef(null);
  const moreBtnRef = useRef(null);
  const menuRef = useRef(null);
  const [visibleCount, setVisibleCount] = useState(items.length);
  const [moreOpen, setMoreOpen] = useState(false);
  // Clamped fixed-position for the overflow dropdown, computed after it mounts
  // so it never runs off the right/bottom edge of the viewport.
  const [menuPos, setMenuPos] = useState(null);

  const measure = useCallback(() => {
    const measurer = measurerRef.current;
    const row = rowRef.current;
    if (!measurer || !row) return;

    const available = row.offsetWidth;
    let total = 0;
    const widths = [];
    for (const child of measurer.querySelectorAll('[data-tab-item]')) {
      const w = child.offsetWidth + 12;
      widths.push(w);
      total += w;
    }

    if (total <= available - (alwaysMore ? MORE_RESERVE_PX : 0)) {
      setVisibleCount(items.length);
      return;
    }

    let running = 0;
    let count = 0;
    for (const w of widths) {
      if (running + w > available - MORE_RESERVE_PX) break;
      running += w;
      count += 1;
    }
    setVisibleCount(Math.max(1, count));
  }, [items.length, alwaysMore]);

  useEffect(() => {
    measure();
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(measure)
      : null;
    if (observer && rowRef.current) observer.observe(rowRef.current);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure, items]);

  useEffect(() => {
    if (!moreOpen) return;
    const close = (e) => {
      if (!moreBtnRef.current?.contains(e.target)) setMoreOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [moreOpen]);

  // Position the dropdown once it's in the DOM: align it under the trigger,
  // but pull it left when a right-edge trigger would push the menu off-screen,
  // and flip it above when it would run past the bottom. Runs before paint so
  // there's no visible jump.
  useLayoutEffect(() => {
    if (!moreOpen) { setMenuPos(null); return; }
    const btn = moreBtnRef.current?.getBoundingClientRect();
    const menu = menuRef.current?.getBoundingClientRect();
    if (!btn || !menu) return;
    const margin = 8;
    let left = btn.left;
    if (left + menu.width > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - menu.width - margin);
    }
    let top = btn.bottom + 4;
    if (top + menu.height > window.innerHeight - margin) {
      top = Math.max(margin, btn.top - menu.height - 4);
    }
    setMenuPos({ top, left });
  }, [moreOpen, visibleCount, items.length]);

  const activeIdx = items.findIndex(t => t.key === activeKey);
  let displayTabs = items;
  if (activeIdx >= visibleCount) {
    displayTabs = [...items];
    const swapIdx = visibleCount - 1;
    [displayTabs[swapIdx], displayTabs[activeIdx]] = [displayTabs[activeIdx], displayTabs[swapIdx]];
  }

  const visible = displayTabs.slice(0, visibleCount);
  const overflow = displayTabs.slice(visibleCount);
  const overflowHasActive = overflow.some(t => t.key === activeKey);

  return (
    <div className={styles.row} ref={rowRef}>
      <div aria-hidden className={styles.measureClip}>
        <div ref={measurerRef} className={styles.measurer}>
          {items.map(tab => (
            <div key={tab.key} data-tab-item className={tabStripStyles.tabItem}>{tab.label}</div>
          ))}
        </div>
      </div>

      <Tabs
        items={visible}
        value={activeKey}
        onValueChange={onChange}
        embedded
        fullWidth={false}
        className={styles.strip}
      />

      {(overflow.length > 0 || alwaysMore) && (
        <div className={styles.moreWrap} ref={moreBtnRef}>
          <button
            type="button"
            className={[tabStripStyles.tabItem, styles.tabMore, overflowHasActive ? tabStripStyles.active : ''].filter(Boolean).join(' ')}
            onClick={() => setMoreOpen(v => !v)}
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            aria-label={overflow.length ? `Show ${overflow.length} more tab${overflow.length === 1 ? '' : 's'}` : 'More options'}
          >
            More
            <Icon name="solar:alt-arrow-down-linear" size={12} color="currentColor" />
          </button>
          {moreOpen && moreBtnRef.current && createPortal(
            <div
              ref={menuRef}
              className={styles.moreDropdown}
              role="menu"
              style={{
                position: 'fixed',
                top: menuPos ? menuPos.top : moreBtnRef.current.getBoundingClientRect().bottom + 4,
                left: menuPos ? menuPos.left : moreBtnRef.current.getBoundingClientRect().left,
                // Hidden for the one frame between mount and measurement so the
                // menu never flashes at an off-screen position.
                visibility: menuPos ? 'visible' : 'hidden',
              }}
            >
              {overflow.map(tab => {
                const item = (
                  <button
                    key={tab.key}
                    type="button"
                    role="menuitem"
                    className={[styles.moreItem, activeKey === tab.key ? styles.moreItemActive : ''].filter(Boolean).join(' ')}
                    onClick={() => { onChange?.(tab.key); setMoreOpen(false); }}
                  >
                    {tab.label}
                  </button>
                );
                if (!itemAction || (itemAction.appliesTo && !itemAction.appliesTo(tab.key))) return item;
                return (
                  <div key={tab.key} role="none" className={styles.moreRow}>
                    {item}
                    <button
                      type="button"
                      role="menuitem"
                      className={styles.moreItemAction}
                      aria-label={itemAction.label(tab)}
                      title={itemAction.label(tab)}
                      onClick={() => { itemAction.onSelect(tab.key); setMoreOpen(false); }}
                    >
                      <Icon name={itemAction.icon} size={16} color="currentColor" />
                    </button>
                  </div>
                );
              })}
              {alwaysMore && overflow.length > 0 && <hr className={styles.moreDivider} />}
              {moreActions?.map(action => (
                <button
                  key={action.key}
                  type="button"
                  role="menuitem"
                  className={styles.moreItem}
                  onClick={() => { action.onSelect(); setMoreOpen(false); }}
                >
                  {action.icon && <Icon name={action.icon} size={16} color="var(--neutral-300)" />}
                  {action.label}
                </button>
              ))}
            </div>,
            document.body,
          )}
        </div>
      )}
    </div>
  );
}

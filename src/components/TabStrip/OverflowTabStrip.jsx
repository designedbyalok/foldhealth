import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icon/Icon';
import { TabStrip } from './TabStrip';
import tabStripStyles from './TabStrip.module.css';
import styles from './OverflowTabStrip.module.css';

const MORE_RESERVE_PX = 72;

/**
 * TabStrip with responsive overflow — tabs that don't fit collapse into a
 * "More ▾" dropdown. Active tab is always kept visible by swapping it into
 * the last visible slot when needed. Same behavior as SectionTitleBar tabs.
 */
export function OverflowTabStrip({ items, activeKey, onChange }) {
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

    if (total <= available) {
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
  }, [items.length]);

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

      <TabStrip
        items={visible}
        activeKey={activeKey}
        onChange={onChange}
        embedded
        fullWidth={false}
      />

      {overflow.length > 0 && (
        <div className={styles.moreWrap} ref={moreBtnRef}>
          <div
            className={[tabStripStyles.tabItem, styles.tabMore, overflowHasActive ? tabStripStyles.active : ''].filter(Boolean).join(' ')}
            onClick={() => setMoreOpen(v => !v)}
            role="button"
            tabIndex={0}
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            aria-label={`Show ${overflow.length} more tab${overflow.length === 1 ? '' : 's'}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setMoreOpen(v => !v);
              }
            }}
          >
            More
            <Icon name="solar:alt-arrow-down-linear" size={12} color="currentColor" />
          </div>
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
              {overflow.map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  role="menuitem"
                  className={[styles.moreItem, activeKey === tab.key ? styles.moreItemActive : ''].filter(Boolean).join(' ')}
                  onClick={() => { onChange?.(tab.key); setMoreOpen(false); }}
                >
                  {tab.label}
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

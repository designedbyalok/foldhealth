import { useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '../Icon/Icon';
import styles from './TabStrip.module.css';

/**
 * TabStrip — the visual tab row used by the app's top-level TabBar and by
 * drawers that need the same tab pattern (Activity / Documents in the HCC
 * Activity History drawer, etc.). Just the pattern — no store wiring.
 *
 * The active state renders via a single sliding underline (measured against
 * the active tab's offset + width) so switching tabs reads as one line
 * moving between them, matching SectionTitleBar's motion.
 *
 * Props:
 *  - items       {key, label, icon?}[]  — tab definitions.
 *  - activeKey   string                 — currently-selected key.
 *  - onChange    (key) => void          — called when a tab is clicked.
 *  - fullWidth   boolean (default true) — bleed to the drawer/container edges.
 */
export function TabStrip({ items, activeKey, onChange, fullWidth = true }) {
  const rowRef = useRef(null);
  const tabRefs = useRef(new Map());
  const [indicator, setIndicator] = useState({ x: 0, w: 0, ready: false });

  useLayoutEffect(() => {
    const row = rowRef.current;
    const el = tabRefs.current.get(activeKey);
    if (!row || !el) return;
    const rowRect = row.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    setIndicator({ x: elRect.left - rowRect.left, w: elRect.width, ready: true });
  }, [activeKey, items]);

  return (
    <div
      ref={rowRef}
      className={[styles.tabBar, fullWidth ? styles.fullWidth : ''].filter(Boolean).join(' ')}
    >
      {items.map((it) => {
        const active = it.key === activeKey;
        return (
          <button
            key={it.key}
            type="button"
            ref={(el) => {
              if (el) tabRefs.current.set(it.key, el);
              else tabRefs.current.delete(it.key);
            }}
            className={[styles.tabItem, active ? styles.active : ''].filter(Boolean).join(' ')}
            onClick={() => onChange?.(it.key)}
          >
            {it.icon && (
              <Icon
                name={it.icon}
                size={14}
                color={active ? 'var(--primary-300)' : 'var(--neutral-300)'}
              />
            )}
            {it.label}
          </button>
        );
      })}
      <span
        className={styles.tabUnderline}
        aria-hidden
        style={{
          transform: `translateX(${indicator.x}px)`,
          width: indicator.w,
          opacity: indicator.ready ? 1 : 0,
        }}
      />
    </div>
  );
}

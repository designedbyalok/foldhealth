import { useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '../Icon/Icon';
import { Badge } from '../Badge/Badge';
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
 *  - items       {key, label, icon?, notif?, count?}[]  — tab definitions.
 *                  `notif` renders a pulsing dot; `count` renders a Badge.
 *  - activeKey   string                 — currently-selected key.
 *  - onChange    (key) => void          — called when a tab is clicked.
 *  - fullWidth   boolean (default true) — bleed to the drawer/container edges.
 *  - embedded    boolean (default false) — skip the outer bar chrome
 *                  (background, border-bottom, padding, fullWidth bleed) so
 *                  the row can drop inside another header (SectionTitleBar).
 *  - trailing    ReactNode              — optional content pinned to the far
 *                                          right (edit button, action group).
 *                                          Sits on the same row as the tabs
 *                                          past a flex spacer.
 */
export function TabStrip({ items, activeKey, onChange, fullWidth = true, embedded = false, trailing }) {
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

  const classes = [
    styles.tabBar,
    embedded ? styles.embedded : '',
    !embedded && fullWidth ? styles.fullWidth : '',
  ].filter(Boolean).join(' ');

  return (
    <div ref={rowRef} className={classes}>
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
            {typeof it.count === 'number' && (
              <Badge variant="overflow" label={String(it.count)} />
            )}
            {it.notif && <span className={styles.notifDot} title="New activity" />}
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
      {trailing && (
        <>
          <span className={styles.trailingSpacer} aria-hidden />
          <div className={styles.trailing}>{trailing}</div>
        </>
      )}
    </div>
  );
}

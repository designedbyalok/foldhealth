import { useRef, useState, useCallback, useLayoutEffect } from 'react';
import { Icon } from '../Icon/Icon';
import styles from './Toggle.module.css';

/**
 * Fold Health Toggle — animated segmented control with a sliding pill indicator.
 *
 * Uses `data-active` + JS offset tracking to animate the pill. A ResizeObserver
 * keeps the slider in sync when buttons change size (async icon loads, font
 * swap, container width changes, etc.) — without it the slider would be stuck
 * at the first-measured size and visibly fall behind its button.
 *
 * Props:
 *  - items      (string[] | {key, label, icon?}[])
 *  - active     (string)     Currently selected key
 *  - onChange   (function)   Called with the key of the clicked segment
 *  - className  (string)     Extra class on the outer container
 *  - size       ('S'|'M')    S=28px height/13px font, M=32px height/14px font
 *  - fullWidth  (boolean)    Stretch to parent and let buttons flex equally
 */
export function Toggle({ items = [], active, onChange, className, size = 'M', fullWidth = false }) {
  const containerRef = useRef(null);
  const [sliderStyle, setSliderStyle] = useState({ left: 0, width: 0, opacity: 0 });

  // Normalize items to { key, label } shape
  const normalized = items.map(item =>
    typeof item === 'string' ? { key: item, label: item } : item,
  );
  // Icon-only mode (no text labels on any item) → tighter padding so 4+ items
  // fit in narrow property-panel columns without clipping.
  const iconOnly = normalized.every(i => i.icon && !i.label);

  const updateSlider = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const activeBtn = container.querySelector('[data-active="true"]');
    if (activeBtn) {
      setSliderStyle({ left: activeBtn.offsetLeft, width: activeBtn.offsetWidth, opacity: 1 });
    }
  }, []);

  // Use layout effect so the slider is positioned before paint — avoids the
  // visible "snap" from 0,0 to its actual spot on first render.
  useLayoutEffect(() => { updateSlider(); }, [active, updateSlider, items.length]);

  // Re-measure when the container or any button resizes. Catches:
  //  - Icon SVGs hydrating after mount (Iconify lazy-loads SVGs)
  //  - Parent column resize (right-panel drag handle, window resize)
  //  - Web-font swap from fallback → Inter
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => updateSlider());
    ro.observe(container);
    container.querySelectorAll('button').forEach(b => ro.observe(b));
    return () => ro.disconnect();
  }, [items.length, updateSlider]);

  const sizeClass = size === 'S' ? styles.sizeS : styles.sizeM;

  return (
    <div
      ref={containerRef}
      className={[
        styles.toggle,
        sizeClass,
        fullWidth ? styles.fullWidth : '',
        iconOnly ? styles.iconOnly : '',
        className || '',
      ].filter(Boolean).join(' ')}
      role="radiogroup"
    >
      <div className={styles.slider} style={sliderStyle} />
      {normalized.map(({ key, label, icon }) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={active === key}
          data-active={active === key}
          className={`${styles.btn} ${active === key ? styles.btnActive : ''}`}
          onClick={() => onChange(key)}
        >
          {icon ? (typeof icon === 'string' ? <Icon name={icon} size={size === 'S' ? 14 : 16} /> : icon) : label}
        </button>
      ))}
    </div>
  );
}

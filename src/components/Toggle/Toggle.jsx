import { useRef, useState, useCallback, useLayoutEffect } from 'react';
import { Icon } from '../Icon/Icon';
import { resolveSize, warnDeprecated } from '../../lib/legacyProps';
import styles from './Toggle.module.css';

/**
 * Fold Health Toggle: animated segmented control with a sliding pill indicator.
 *
 * Uses `data-active` + JS offset tracking to animate the pill. A ResizeObserver
 * keeps the slider in sync when buttons change size (async icon loads, font
 * swap, container width changes, etc.), without it the slider would be stuck
 * at the first-measured size and visibly fall behind its button.
 *
 * Props:
 *  - items         (string[] | {key, label, icon?, ariaLabel?}[])  ariaLabel names an icon-only segment
 *  - value         (string)     Selected key (controlled)
 *  - defaultValue  (string)     Initially selected key (uncontrolled)
 *  - onValueChange (function)   Called with the key of the clicked segment
 *                               (`active` / `onChange` are the old names)
 *  - className     (string)     Extra class on the outer container
 *  - size          ('sm'|'md')  sm=28px height/13px font, md=32px height/14px font
 *  - fullWidth     (boolean)    Stretch to parent and let buttons flex equally
 *  - ...rest       Spread on the radiogroup (e.g. `aria-label`)
 */
export function Toggle({
  items = [], value, defaultValue, onValueChange, active, onChange,
  className, size = 'md', fullWidth = false, ...rest
}) {
  if (active !== undefined) warnDeprecated('Toggle', 'active', true, 'value');
  if (onChange && !onValueChange) warnDeprecated('Toggle', 'onChange', true, 'onValueChange');
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const controlledValue = value !== undefined ? value : active;
  const current = controlledValue !== undefined ? controlledValue : uncontrolled;
  const select = (key) => {
    if (controlledValue === undefined) setUncontrolled(key);
    (onValueChange ?? onChange)?.(key);
  };

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

  // Use layout effect so the slider is positioned before paint, avoids the
  // visible "snap" from 0,0 to its actual spot on first render.
  useLayoutEffect(() => { updateSlider(); }, [current, updateSlider, items.length]);

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

  const sizeClass = resolveSize('Toggle', size) === 'sm' ? styles.sizeS : styles.sizeM;

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
      {...rest}
    >
      <div className={styles.slider} style={sliderStyle} />
      {normalized.map(({ key, label, icon, ariaLabel }) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={current === key}
          aria-label={ariaLabel}
          data-active={current === key}
          className={`${styles.btn} ${current === key ? styles.btnActive : ''}`}
          onClick={() => select(key)}
        >
          {icon ? (typeof icon === 'string' ? <Icon name={icon} size={16} /> : icon) : label}
        </button>
      ))}
    </div>
  );
}

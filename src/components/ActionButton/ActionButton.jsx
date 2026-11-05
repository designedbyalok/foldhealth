import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icon/Icon';
import { DownChevronIcon } from '../Icon/DownChevronIcon';
import { Spinner } from '../Spinner/Spinner';
import { usePendingClick } from '../Button/usePendingClick';
import styles from './ActionButton.module.css';

const SIZE_CLASS = { sm: 'sizeS', md: 'sizeL', lg: 'sizeXL' };
const ICON_SIZE = { sm: 16, md: 20, lg: 32 };
const LEGACY_SIZE = { S: 'sm', M: 'md', L: 'md', XL: 'lg' };

const warned = new Set();
function warnLegacy(size, state) {
  if (!import.meta.env?.DEV) return;
  const notes = [
    LEGACY_SIZE[size] && `size="${size}" → size="${LEGACY_SIZE[size]}"`,
    state === 'disabled' && 'state="disabled" → disabled',
    state === 'error' && 'state="error" → tone="danger"',
    state === 'active' && 'state="active" → (remove it)',
  ].filter(note => note && !warned.has(note));
  notes.forEach(note => warned.add(note));
  if (notes.length) console.warn(`ActionButton: deprecated props; ${notes.join(', ')}. See docs/components/library-contract.mdx.`);
}

/**
 * Fold Health ActionButton: square icon-only toolbar/action button.
 *
 * Matches Figma Fold-Pixel-1.0 node 25:25238 exactly.
 *
 * Used for toolbar icons (search, filter, history, export), table row actions,
 * and any place a compact icon-only button is needed with optional badges.
 *
 * @param {object}   props
 * @param {string}   [props.icon]                      – Solar icon name (e.g. "custom:filter")
 * @param {React.ReactNode} [props.children]            – Custom icon element (used instead of icon prop)
 * @param {'sm'|'md'|'lg'} [props.size='md']          – sm=16px icon, md=20px icon, lg=32px icon
 * @param {'neutral'|'danger'} [props.tone='neutral']  – danger paints the icon red (destructive actions)
 * @param {boolean}  [props.disabled=false]
 * @param {boolean}  [props.loading=false]          – Busy: a spinner replaces the icon and clicks are
 *                                                    ignored. Set automatically while a promise returned
 *                                                    from `onClick` is pending.
 * @param {string}   [props.tooltip]                    – Tooltip text (styled bubble on hover or keyboard
 *   focus). It renders on the page, not inside the button, so no scrolling or clipped container
 *   cuts it off; it flips below when there's no room above and stays inside the window.
 * @param {boolean}  [props.tooltipBelow=false]         – Open the tooltip below the button
 * @param {boolean}  [props.tooltipLeft=false]          – Line the tooltip up with the button's right edge
 *   (it grows leftward), for buttons at a container's right edge
 * @param {boolean}  [props.notification=false]          – Show orange notification badge
 * @param {string}   [props.count]                      – Badge count text (shows grey count badge)
 * @param {'new'}    [props.countTone]                  – 'new' fills the count badge in the primary
 *                                                        colour, for something the user hasn't seen yet
 * @param {boolean}  [props.dot=false]                  – Show red status dot
 * @param {boolean}  [props.dotPulse=false]             – Make the red dot blink (pulsing ring)
 * @param {boolean}  [props.chevron=false]              – Show dropdown chevron
 * @param {boolean}  [props.chevronOpen=false]          – Rotate chevron when open
 * @param {boolean}  [props.active=false]               – Toggle state (exposed as aria-pressed)
 * @param {string}   [props.className]                  – Extra class
 * @param {string}   [props.iconColor]                  – Override icon color
 */
export const ActionButton = forwardRef(function ActionButton({
  icon,
  children,
  size: sizeProp = 'md',
  tone: toneProp = 'neutral',
  // Deprecated: 'disabled' → `disabled`, 'error' → tone="danger".
  state,
  disabled: disabledProp = false,
  loading = false,
  tooltip,
  notification = false,
  count,
  countTone,
  dot = false,
  dotPulse = false,
  chevron = false,
  chevronOpen = false,
  // Destructured so a boolean `active` from callers never reaches the DOM
  // via {...rest} (React warns on non-boolean attributes).
  active = false,
  tooltipBelow = false,
  tooltipLeft = false,
  className,
  iconColor,
  onPointerEnter,
  onPointerLeave,
  onFocus,
  onBlur,
  onClick,
  ...rest
}, ref) {
  const btnRef = useRef(null);
  const setRefs = useCallback((node) => {
    btnRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  }, [ref]);
  const [anchor, setAnchor] = useState(null); // the button's box while the tooltip shows
  const show = () => { if (tooltip && btnRef.current) setAnchor(btnRef.current.getBoundingClientRect()); };
  const hide = () => setAnchor(null);
  // A scroll moves the button out from under a fixed tooltip, so it closes.
  useEffect(() => {
    if (!anchor) return undefined;
    window.addEventListener('scroll', hide, true);
    return () => window.removeEventListener('scroll', hide, true);
  }, [anchor]);

  const size = LEGACY_SIZE[sizeProp] ?? (ICON_SIZE[sizeProp] ? sizeProp : 'md');
  const [pending, handleClick] = usePendingClick(onClick, loading);
  const busy = loading || pending;
  // Busy wins over disabled: callers often disable while saving, and the
  // spinner should still show that the click is being worked on.
  const disabled = (disabledProp || state === 'disabled') && !busy;
  const tone = state === 'error' ? 'danger' : toneProp;
  warnLegacy(sizeProp, state);
  const iconSize = ICON_SIZE[size];
  const sizeClass = styles[SIZE_CLASS[size]];
  const stateClass = disabled ? styles.disabled : tone === 'danger' ? styles.error : styles.active;

  const resolvedColor = iconColor || (
    disabled ? 'var(--neutral-150)'
    : tone === 'danger' ? 'var(--status-error)'
    : 'var(--neutral-300)'
  );

  const cls = [
    styles.root,
    sizeClass,
    stateClass,
    busy ? styles.loading : '',
    className || '',
  ].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      ref={setRefs}
      className={cls}
      disabled={disabled}
      aria-label={tooltip}
      aria-pressed={active || undefined}
      aria-busy={busy || undefined}
      aria-disabled={busy || undefined}
      data-tone={tone}
      onClick={handleClick}
      onPointerEnter={(e) => { show(); onPointerEnter?.(e); }}
      onPointerLeave={(e) => { hide(); onPointerLeave?.(e); }}
      onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) show(); onFocus?.(e); }}
      onBlur={(e) => { hide(); onBlur?.(e); }}
      {...rest}
    >
      {busy && <span className={styles.spinnerSlot}><Spinner size={Math.round(iconSize * 0.8)} /></span>}
      {children || <Icon name={icon} size={iconSize} color={resolvedColor} />}

      {tooltip && anchor && <ActionTooltip text={tooltip} anchor={anchor} below={tooltipBelow} alignRight={tooltipLeft} />}

      {/* Notification badge (orange with count) */}
      {notification && (
        <span className={`${styles.badge} ${styles.badgeNotification}`}>
          {count || ''}
        </span>
      )}

      {/* Count badge (grey with number) */}
      {!notification && count && (
        <span className={`${styles.badge} ${countTone === 'new' ? styles.badgeCountNew : styles.badgeCount}`}>
          {count}
        </span>
      )}

      {/* Status dot */}
      {dot && !notification && !count && (
        <span className={`${styles.dot} ${dotPulse ? styles.dotPulse : ''}`} />
      )}

      {/* Dropdown chevron */}
      {chevron && (
        <DownChevronIcon
          size={10}
          color={resolvedColor}
          className={`${styles.chevron} ${chevronOpen ? styles.chevronOpen : ''}`}
        />
      )}
    </button>
  );
});

const GAP = 6;     // between the button and the bubble
const EDGE = 8;    // the bubble stays this far inside the window
const ARROW = 5;   // half the arrow's width

/**
 * The tooltip bubble, fixed on the page next to `anchor`: above it unless
 * `below` (or there's no room above), centred on it or lined up with its
 * right edge, nudged inside the window, with its arrow on the button's centre.
 */
function ActionTooltip({ text, anchor, below, alignRight }) {
  const tipRef = useRef(null);
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    const el = tipRef.current;
    if (!el) return;
    const { width: w, height: h } = el.getBoundingClientRect();
    const under = below ? anchor.bottom + GAP + h <= window.innerHeight - EDGE || anchor.top - GAP - h < EDGE
      : anchor.top - GAP - h < EDGE;
    const centre = anchor.left + anchor.width / 2;
    const want = alignRight ? anchor.right - w : centre - w / 2;
    const left = Math.min(Math.max(EDGE, want), window.innerWidth - w - EDGE);
    const arrow = Math.min(Math.max(ARROW + 4, centre - left), w - ARROW - 4);
    setPos({ top: under ? anchor.bottom + GAP : anchor.top - GAP - h, left, arrow, under });
  }, [anchor, below, alignRight, text]);
  return createPortal(
    <span
      ref={tipRef}
      role="tooltip"
      className={`${styles.tooltip} ${pos?.under ? styles.tooltipBelow : ''}`}
      style={pos ? { top: pos.top, left: pos.left, '--arrow-x': `${pos.arrow}px` } : { top: 0, left: 0, visibility: 'hidden' }}
    >
      {text}
    </span>,
    document.body,
  );
}

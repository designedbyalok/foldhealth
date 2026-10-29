import { forwardRef, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { autoUpdate, flip, offset as offsetMw, shift, size, useFloating } from '@floating-ui/react-dom';
import styles from './Popover.module.css';

/**
 * Popover: the one floating surface every anchored overlay in the library is
 * built on. It owns positioning, dismissal, focus and stacking so the
 * components on top of it only render their content.
 *
 * - Positions against `anchor` with Floating UI: flips to the side with room,
 *   shifts to stay 8px inside the viewport, caps its height to the space
 *   available, and follows the anchor on scroll and resize when the anchor
 *   is an element (a DOMRect is a fixed snapshot).
 * - Closes on Escape or a click outside. Popovers stack: Escape closes only
 *   the top one, and a click outside a child closes the child, not its parent.
 * - Moves focus inside on open (unless something inside already took it via
 *   autoFocus) and returns it to where it was on close.
 * - Clicks, mouse-downs and pointer-downs inside never bubble out, so a row
 *   or a parent popover underneath doesn't react to them.
 *
 * @param {DOMRect|{top,bottom,left,right}|Element|{current: Element}} props.anchor
 *   What to position against: the trigger's rect, the trigger element, or a ref to it.
 * @param {boolean}  [props.open=true]      Render it. Defaults to true so a parent can
 *                                          mount it conditionally.
 * @param {function} props.onOpenChange     (open: boolean) => void. Called with false on
 *                                          Escape or an outside click.
 * @param {string}   [props.placement='bottom-start'] Any Floating UI placement.
 * @param {number}   [props.offset=4]       Gap to the anchor, in px.
 * @param {number|'anchor'} [props.width]   Fixed width, or 'anchor' for at least the anchor's width.
 * @param {number}   [props.maxHeight]      Upper bound; the space available always caps it too.
 * @param {boolean}  [props.overlay=true]   Invisible layer that catches the outside click so it
 *                                          doesn't also land on the page underneath. With
 *                                          false, an outside press still closes it and also
 *                                          reaches what was pressed (right for form pickers).
 * @param {boolean}  [props.backdrop=false] Dim the page behind it (implies overlay).
 * @param {boolean}  [props.centered=false] Center it in the viewport instead; `anchor` is ignored.
 * @param {boolean}  [props.initialFocus=true] Move focus into the panel on open.
 * @param {boolean}  [props.unstyled=false] Drop the surface chrome (background, border,
 *                                          radius, shadow) when the content draws its own.
 * @param {boolean}  [props.listNavigation=false] Arrow Up/Down move focus between the
 *                                          panel's controls (wrapping), Home/End jump to the
 *                                          ends. For menus and pick lists, not for content
 *                                          that uses arrows itself (sliders, calendars).
 * @param {string}   [props.role='dialog']  'dialog', 'menu', 'listbox' or 'group'.
 */
export const Popover = forwardRef(function Popover({
  anchor,
  open = true,
  onOpenChange,
  placement = 'bottom-start',
  offset = 4,
  width,
  maxHeight,
  overlay = true,
  backdrop = false,
  centered = false,
  initialFocus = true,
  unstyled = false,
  listNavigation = false,
  role = 'dialog',
  className,
  style,
  children,
  onClick,
  onMouseDown,
  onPointerDown,
  onKeyDown,
  ...rest
}, forwardedRef) {
  const reference = useAnchorReference(anchor);
  const { refs, floatingStyles, placement: side, isPositioned } = useFloating({
    open,
    strategy: 'fixed',
    placement,
    // top/left rather than transform, so the entrance animation can use transform.
    transform: false,
    elements: { reference: centered ? null : reference },
    whileElementsMounted: autoUpdate,
    middleware: [
      offsetMw(offset),
      flip({ padding: 8, fallbackStrategy: 'bestFit' }),
      shift({ padding: 8 }),
      size({
        padding: 8,
        apply({ availableHeight, rects, elements }) {
          elements.floating.style.maxHeight = `${Math.max(0, Math.min(maxHeight ?? Infinity, availableHeight))}px`;
          if (width === 'anchor') elements.floating.style.minWidth = `${rects.reference.width}px`;
        },
      }),
    ],
  });

  const panelRef = useRef(null);
  const { setFloating } = refs;
  const setPanel = useCallback((el) => {
    panelRef.current = el;
    setFloating(el);
    if (typeof forwardedRef === 'function') forwardedRef(el);
    else if (forwardedRef) forwardedRef.current = el;
  }, [setFloating, forwardedRef]);

  const close = () => onOpenChange?.(false);
  const hasOverlay = overlay || backdrop;
  useLayer(open, close, panelRef, reference instanceof Element ? reference : null, !hasOverlay && !centered);
  useFocusOnOpen(open, open && (centered || isPositioned), panelRef, initialFocus);

  if (!open || (!reference && !centered)) return null;

  const positionStyle = centered
    ? { maxHeight: Math.min(maxHeight ?? Infinity, window.innerHeight - 64) }
    // Transparent, not hidden, while it's measured: a hidden element can't
    // take focus, and content inside may autoFocus on mount.
    : { ...floatingStyles, ...(isPositioned ? null : { opacity: 0, pointerEvents: 'none' }) };

  const stop = (handler) => (e) => { handler?.(e); e.stopPropagation(); };

  return createPortal(
    <>
      {hasOverlay && (
        <div
          data-popover-overlay=""
          className={`${styles.overlay} ${backdrop ? styles.backdrop : ''}`}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); close(); }}
          aria-hidden="true"
        />
      )}
      <div
        ref={setPanel}
        role={role}
        tabIndex={-1}
        data-state="open"
        data-positioned={centered || isPositioned ? '' : undefined}
        data-side={side.split('-')[0]}
        className={[styles.panel, unstyled ? '' : styles.surface, centered ? styles.centered : '', className].filter(Boolean).join(' ')}
        style={{
          ...positionStyle,
          width: typeof width === 'number' ? (centered ? Math.min(width, window.innerWidth - 32) : width) : undefined,
          ...style,
        }}
        onClick={stop(onClick)}
        onMouseDown={stop(onMouseDown)}
        onPointerDown={stop(onPointerDown)}
        onKeyDown={(e) => { onKeyDown?.(e); if (listNavigation && !e.defaultPrevented) moveFocus(e); }}
        {...rest}
      >
        {children}
      </div>
    </>,
    document.body,
  );
});

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function moveFocus(e) {
  const steps = { ArrowDown: 1, ArrowUp: -1, Home: 'first', End: 'last' };
  const step = steps[e.key];
  if (step === undefined || e.altKey || e.ctrlKey || e.metaKey) return;
  // A text field keeps Home/End for its caret; a multi-line one keeps every arrow.
  if (e.target.tagName === 'TEXTAREA' || (e.target.tagName === 'INPUT' && typeof step === 'string')) return;
  const items = [...e.currentTarget.querySelectorAll(FOCUSABLE)].filter(el => el.getClientRects().length);
  if (!items.length) return;
  e.preventDefault();
  const at = items.indexOf(document.activeElement);
  const next = step === 'first' ? 0
    : step === 'last' ? items.length - 1
    : at === -1 ? (step > 0 ? 0 : items.length - 1)
    : (at + step + items.length) % items.length;
  items[next].focus();
}

// A DOMRect is a snapshot, so wrap it as a Floating UI virtual element and
// keep its identity stable while the numbers don't change.
function useAnchorReference(anchor) {
  const el = anchor && ('current' in anchor ? anchor.current : anchor);
  const isElement = typeof Element !== 'undefined' && el instanceof Element;
  // A partial rect ({ left, bottom } is common) fills the missing edges in.
  const top = el?.top ?? el?.bottom, bottom = el?.bottom ?? el?.top;
  const left = el?.left ?? el?.right, right = el?.right ?? el?.left;
  const virtual = useMemo(() => {
    if (isElement || top == null || left == null) return null;
    const rect = { x: left, y: top, top, left, bottom, right, width: right - left, height: bottom - top };
    return { getBoundingClientRect: () => rect };
  }, [isElement, top, left, bottom, right]);
  return isElement ? el : virtual;
}

// Open popovers in mount order. Only the top one answers Escape, and it stops
// the key there so a drawer or dialog underneath stays open.
const layers = [];

// Without an overlay, a press outside the panel closes it and still lands on
// whatever was pressed. Presses inside a popover opened on top of this one,
// or on the anchor element (its trigger toggles it), don't count as outside.
function useLayer(open, close, panelRef, anchorEl, outsidePress) {
  const closeRef = useRef(close);
  useLayoutEffect(() => { closeRef.current = close; });
  const id = useId();
  useEffect(() => {
    if (!open) return undefined;
    const layer = { id, panelRef };
    layers.push(layer);
    const onKey = (e) => {
      if (e.key !== 'Escape' || layers[layers.length - 1] !== layer) return;
      e.stopPropagation();
      closeRef.current();
    };
    const onPress = (e) => {
      const above = layers.slice(layers.indexOf(layer));
      if (above.some(l => l.panelRef.current?.contains(e.target))) return;
      // A child popover's overlay: that press closes the child only.
      if (e.target.closest?.('[data-popover-overlay]')) return;
      if (anchorEl?.contains(e.target)) return;
      closeRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    if (outsidePress) document.addEventListener('pointerdown', onPress, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onPress, true);
      layers.splice(layers.indexOf(layer), 1);
    };
  }, [open, id, panelRef, anchorEl, outsidePress]);
}

// `ready` waits for the first position, so the panel is where it will stay
// before focus lands in it.
function useFocusOnOpen(open, ready, panelRef, initialFocus) {
  useEffect(() => {
    if (!ready) return;
    const panel = panelRef.current;
    if (initialFocus && panel && !panel.contains(document.activeElement)) {
      panel.focus({ preventScroll: true });
    }
  }, [ready, panelRef, initialFocus]);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const panel = panelRef.current;
    return () => {
      const active = document.activeElement;
      const focusWasInside = !active || active === document.body || panel?.contains(active);
      if (focusWasInside && previous instanceof HTMLElement && previous.isConnected) {
        previous.focus({ preventScroll: true });
      }
    };
  }, [open, panelRef]);
}

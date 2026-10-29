import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icon/Icon';
import { CloseButton } from '../CloseButton/CloseButton';
import styles from './Drawer.module.css';

// Falls back to 250ms when the CSS custom property is unreadable (rare — SSR,
// portal not yet mounted). The CSS custom property `--drawer-duration` on
// `.panel` is the source of truth; do NOT hard-code the timing anywhere else.
const FALLBACK_CLOSE_MS = 250;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

// Tab and Shift+Tab wrap inside the panel, so keyboard focus can't fall
// behind the drawer onto the page it covers.
function trapTab(e) {
  if (e.key !== 'Tab') return;
  const panel = e.currentTarget;
  const items = [...panel.querySelectorAll(FOCUSABLE)].filter(el => el.getClientRects().length);
  if (!items.length) { e.preventDefault(); return; }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (e.shiftKey && (active === first || active === panel)) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
}

// Open drawers in mount order; only the top one answers Escape.
const drawerStack = [];

// Did anything else respond to this Escape? An inline dropdown closing, an
// edit being cancelled or a tooltip hiding all add, remove or toggle
// elements; a handler may also move focus or call preventDefault. Only when
// nothing did does the key fall through to the drawer, so the dozens of
// existing Escape handlers inside drawers keep working without changes.
const ESCAPE_WATCH = { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'aria-expanded', 'hidden', 'open', 'data-state'] };
function escapeWasHandled(event, records, focusBefore) {
  if (event.defaultPrevented || document.activeElement !== focusBefore) return true;
  return records.some(r => (r.type === 'childList'
    ? [...r.addedNodes, ...r.removedNodes].some(n => n.nodeType === Node.ELEMENT_NODE)
    : r.target !== document.body && r.target !== document.documentElement));
}

function readDrawerDurationMs(node) {
  if (!node) return FALLBACK_CLOSE_MS;
  const raw = getComputedStyle(node).getPropertyValue('--drawer-duration').trim();
  if (!raw) return FALLBACK_CLOSE_MS;
  const ms = raw.endsWith('ms') ? parseFloat(raw) : parseFloat(raw) * 1000;
  return Number.isFinite(ms) && ms > 0 ? ms : FALLBACK_CLOSE_MS;
}

/**
 * Shared Drawer shell — the standard floating right-side panel.
 *
 * Rendered via createPortal to document.body so the overlay + panel always
 * sit above any stacking contexts (e.g. sticky table columns with z-index).
 *
 * Props:
 *  - title           (ReactNode)  Header title text / element
 *  - onClose         (function)   Called when the overlay, the close button or Escape closes it
 *  - primaryAction   (ReactNode)  Optional CTA rendered just before the close button
 *                                  (e.g. `<Button variant="primary" size="L">Save</Button>`).
 *                                  The shell paints the vertical divider between the
 *                                  actions and close as a real `<span>` — the close
 *                                  button never carries a `border-left`.
 *  - secondaryAction (ReactNode)  Optional secondary CTA rendered before `primaryAction`
 *                                  (e.g. `<Button variant="secondary" size="L">Discard</Button>`).
 *                                  Only shows when `primaryAction` is also set.
 *  - headerRight     (ReactNode)  Free-form slot for chips / status content that sits
 *                                  before the action buttons. Rendered order in the
 *                                  header: [headerRight] [secondaryAction] [primaryAction]
 *                                  [divider] [close]. Convention: CTA buttons here
 *                                  render at `size="L"`.
 *  - noCloseDivider  (boolean)    Escape hatch — suppress the auto-divider before the
 *                                  close button. Only pass this when your `headerRight`
 *                                  already contains its own divider element (legacy
 *                                  callers). New callers should route buttons through
 *                                  `primaryAction`/`secondaryAction` and let the shell
 *                                  own the divider.
 *  - banner       (ReactNode)  Full-bleed slot rendered between header and body
 *                              (used for PatientBanner / hero rows that should
 *                              hug the drawer edges instead of sitting inside
 *                              the padded body)
 *  - footer       (ReactNode)  Optional sticky footer content
 *  - footerClassName (string)  Extra class on the footer (e.g. an enter animation)
 *  - children     (ReactNode)  Scrollable body content (16px padded)
 *  - width        (number|string) Override the default 700px panel width
 *                              (e.g. 1300 for the HCC Document Review drawer).
 *                              Numbers are treated as px.
 *  - className    (string)     Extra class on the panel root (rare)
 *  - dismissed    (boolean)    Close from outside: plays the close animation,
 *                              then calls onClose (e.g. swapping one drawer
 *                              for another)
 *
 * Design tokens (DO NOT change without design review):
 *  - Width: 700px
 *  - Inset: 8px (top, right, bottom) — gives the floating look
 *  - Border-radius: 16px (all corners)
 *  - Shadow: 0 8px 32px rgba(0,0,0,.12), 0 0 0 1px rgba(0,0,0,.04)
 *  - Header padding: 20px 24px 16px
 *  - Body padding: 0 24px 24px (scrollable)
 *  - Footer padding: 16px 24px (if present)
 *  - Animation: transform 250ms var(--ease-drawer) — driven by
 *    Drawer.module.css @starting-style and [data-closing] transitions.
 */
export function Drawer({
  title,
  onClose,
  headerRight,
  primaryAction,
  secondaryAction,
  banner,
  footer,
  footerClassName,
  children,
  className,
  bodyClassName,
  headerStyle,
  titleStyle,
  width,
  noCloseDivider = false,
  // Optional synchronous guard run when the user requests close (overlay,
  // close button, or Escape). Return `false` to VETO the close — the drawer
  // stays open and no animation runs, so the caller can show its own confirm
  // (e.g. "Discard unsaved changes?") over the still-open drawer.
  beforeClose,
  dismissed = false,
  // False makes a click on the overlay do nothing (close with ✕ or Escape),
  // for drawers holding edits a stray click outside shouldn't threaten.
  closeOnOverlayClick = true,
  // False keeps Escape from closing it (✕ and the overlay still do).
  closeOnEscape = true,
}) {
  // Stacking depth for nested drawers. When a second Drawer mounts on top
  // of an already-open one (e.g. TaskDetailDrawer over CareGapDetailDrawer
  // via the "Preview task" eye), both instances default to z-index 400
  // (overlay) / 401 (panel), so the newer drawer's overlay lands BELOW
  // the older drawer's panel — the older drawer stays visible with no
  // dim behind the new one. Count existing drawer panels at mount and
  // bump this instance's z-index by 10*N so each level layers cleanly.
  const [stackDepth, setStackDepth] = useState(0);
  const [closing, setClosing] = useState(false);
  const panelRef = useRef(null);
  useEffect(() => {
    // useEffect fires after commit, so this instance's own panel is
    // already in the DOM — subtract 1 so a solo drawer stays at the
    // base z-index and only *nested* drawers get bumped.
    const openPanels = document.querySelectorAll(`.${styles.panel}[data-closing="false"]`).length;
    const alreadyOpen = Math.max(0, openPanels - 1);
    if (alreadyOpen > 0) setStackDepth(alreadyOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const zOverlay = 400 + stackDepth * 10;
  const zPanel = zOverlay + 1;
  const overlayStyle = stackDepth > 0 ? { zIndex: zOverlay } : undefined;
  const panelStyle = {
    ...(width !== undefined ? { width: typeof width === 'number' ? `${width}px` : width } : {}),
    ...(stackDepth > 0 ? { zIndex: zPanel } : {}),
  };
  const requestClose = useCallback(() => {
    if (closing) return;
    // Let the caller veto the close (e.g. to show an unsaved-changes confirm
    // while the drawer stays open). Only start the close animation if allowed.
    if (beforeClose && beforeClose() === false) return;
    setClosing(true);
    const ms = readDrawerDurationMs(panelRef.current);
    setTimeout(() => onClose?.(), ms);
  }, [closing, onClose, beforeClose]);

  // Closing from outside skips beforeClose: the caller already decided.
  useEffect(() => {
    if (!dismissed) return undefined;
    const t = setTimeout(() => onClose?.(), readDrawerDurationMs(panelRef.current));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismissed]);
  const shut = closing || dismissed;
  const titleId = useId();

  const requestCloseRef = useRef(requestClose);
  useEffect(() => { requestCloseRef.current = requestClose; });
  useEffect(() => {
    if (!closeOnEscape) return undefined;
    const entry = {};
    drawerStack.push(entry);
    // One observer per drawer, connected only while an Escape is checked.
    // Records arrive in its callback (a microtask, before the timeout), so
    // collect them there; takeRecords() only has what's still queued.
    let records = [];
    const observer = new MutationObserver(list => { records.push(...list); });
    let timer = null;
    const onKey = (e) => {
      if (e.key !== 'Escape' || e.isComposing || drawerStack[drawerStack.length - 1] !== entry) return;
      const panel = panelRef.current;
      const focusBefore = document.activeElement;
      // Focus in something outside the panel (a portaled menu, a dialog on
      // top) belongs to that layer.
      if (focusBefore && focusBefore !== document.body && !panel?.contains(focusBefore)) return;
      clearTimeout(timer);
      records = [];
      observer.observe(document.body, ESCAPE_WATCH);
      timer = setTimeout(() => {
        records.push(...observer.takeRecords());
        observer.disconnect();
        if (!escapeWasHandled(e, records, focusBefore)) requestCloseRef.current();
      }, 0);
    };
    // Capture phase, so the check is set up before any handler can stop the key.
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      clearTimeout(timer);
      observer.disconnect();
      drawerStack.splice(drawerStack.indexOf(entry), 1);
    };
  }, [closeOnEscape]);

  // Focus moves into the drawer when it opens (unless something inside
  // already took it) and goes back to where it was when it closes.
  useEffect(() => {
    const previous = document.activeElement;
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) panel.focus({ preventScroll: true });
    return () => {
      const active = document.activeElement;
      const focusWasInside = !active || active === document.body || panel?.contains(active);
      if (focusWasInside && previous instanceof HTMLElement && previous.isConnected) {
        previous.focus({ preventScroll: true });
      }
    };
  }, []);

  return createPortal(
    <>
      {/* Backdrop is a mouse-only convenience for closing. It is hidden from
          assistive tech on purpose — the header CloseButton is the keyboard and
          screen-reader path, so the backdrop must not appear as a second,
          unlabelled control. */}
      <div className={styles.overlay} data-closing={shut ? 'true' : 'false'} onClick={closeOnOverlayClick ? requestClose : undefined} aria-hidden="true" style={overlayStyle} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        onKeyDown={trapTab}
        data-drawer-panel
        className={`${styles.panel}${className ? ` ${className}` : ''}`}
        data-closing={shut ? 'true' : 'false'}
        style={Object.keys(panelStyle).length ? panelStyle : undefined}
      >
        <div className={styles.header} style={headerStyle}>
          <h2 id={titleId} className={styles.headerTitle} style={titleStyle}>{title}</h2>
          <div className={styles.headerRight}>
            {headerRight}
            {primaryAction && secondaryAction}
            {primaryAction}
            {/* Real hairline element — the CloseButton NEVER paints its own
                divider via border-left. Rendered whenever any content sits
                to the left of the close button so callers don't need to
                opt in with a prop. */}
            {!noCloseDivider && (headerRight || primaryAction || secondaryAction) && (
              <span className={styles.headerDivider} aria-hidden />
            )}
            <CloseButton
              onClick={requestClose}
              size={20}
              label="Close drawer"
            />
          </div>
        </div>
        {banner && <div className={styles.banner}>{banner}</div>}
        <div className={`${styles.body}${bodyClassName ? ` ${bodyClassName}` : ''}`}>
          {children}
        </div>
        {footer && <div className={`${styles.footer}${footerClassName ? ` ${footerClassName}` : ''}`}>{footer}</div>}
      </div>
    </>,
    document.body,
  );
}

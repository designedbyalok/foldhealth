import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icon/Icon';
import { CloseButton } from '../CloseButton/CloseButton';
import styles from './Drawer.module.css';

// Falls back to 250ms when the CSS custom property is unreadable (rare — SSR,
// portal not yet mounted). The CSS custom property `--drawer-duration` on
// `.panel` is the source of truth; do NOT hard-code the timing anywhere else.
const FALLBACK_CLOSE_MS = 250;

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
 *  - onClose         (function)   Called when overlay or close button is clicked
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

  return createPortal(
    <>
      {/* Backdrop is a mouse-only convenience for closing. It is hidden from
          assistive tech on purpose — the header CloseButton is the keyboard and
          screen-reader path, so the backdrop must not appear as a second,
          unlabelled control. */}
      <div className={styles.overlay} data-closing={shut ? 'true' : 'false'} onClick={requestClose} aria-hidden="true" style={overlayStyle} />
      <div ref={panelRef} data-drawer-panel className={`${styles.panel}${className ? ` ${className}` : ''}`} data-closing={shut ? 'true' : 'false'} style={Object.keys(panelStyle).length ? panelStyle : undefined}>
        <div className={styles.header} style={headerStyle}>
          <h2 className={styles.headerTitle} style={titleStyle}>{title}</h2>
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
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </>,
    document.body,
  );
}

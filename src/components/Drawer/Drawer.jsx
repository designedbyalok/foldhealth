import { useCallback, useRef, useState } from 'react';
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
}) {
  const panelStyle = width !== undefined
    ? { width: typeof width === 'number' ? `${width}px` : width }
    : undefined;
  // `closing` flips true when the user requests close; we keep the drawer
  // mounted for --drawer-duration so the transform + opacity transitions
  // play, then call the parent's onClose to actually unmount. Overlay clicks
  // and close-button clicks both go through this same gate.
  const [closing, setClosing] = useState(false);
  const panelRef = useRef(null);
  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    const ms = readDrawerDurationMs(panelRef.current);
    setTimeout(() => onClose?.(), ms);
  }, [closing, onClose]);

  return createPortal(
    <>
      <div className={styles.overlay} data-closing={closing ? 'true' : 'false'} onClick={requestClose} />
      <div ref={panelRef} className={`${styles.panel}${className ? ` ${className}` : ''}`} data-closing={closing ? 'true' : 'false'} style={panelStyle}>
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

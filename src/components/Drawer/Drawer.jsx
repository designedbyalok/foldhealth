import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icon/Icon';
import { CloseIcon } from '../Icon/CloseIcon';
import styles from './Drawer.module.css';

// Matches the slideOut / overlayOut animation duration in Drawer.module.css.
// Keep in sync — bumping one without the other clips or lags the exit.
const CLOSE_ANIM_MS = 250;

/**
 * Shared Drawer shell — the standard floating right-side panel.
 *
 * Rendered via createPortal to document.body so the overlay + panel always
 * sit above any stacking contexts (e.g. sticky table columns with z-index).
 *
 * Props:
 *  - title        (ReactNode)  Header title text / element
 *  - onClose      (function)   Called when overlay or close button is clicked
 *  - headerRight  (ReactNode)  Extra elements rendered to the left of the close button
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
 *  - Animation: slideIn .25s ease (translateX)
 */
export function Drawer({ title, onClose, headerRight, banner, footer, children, className, bodyClassName, headerStyle, titleStyle, noCloseDivider, width }) {
  const panelStyle = width !== undefined
    ? { width: typeof width === 'number' ? `${width}px` : width }
    : undefined;
  // `closing` flips true when the user requests close; we keep the drawer
  // mounted for CLOSE_ANIM_MS so the slideOut + fade-out play, then call
  // the parent's onClose to actually unmount. Overlay clicks and close-
  // button clicks both go through this same gate.
  const [closing, setClosing] = useState(false);
  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => onClose?.(), CLOSE_ANIM_MS);
  }, [closing, onClose]);

  return createPortal(
    <>
      <div className={styles.overlay} data-closing={closing ? 'true' : 'false'} onClick={requestClose} />
      <div className={`${styles.panel}${className ? ` ${className}` : ''}`} data-closing={closing ? 'true' : 'false'} style={panelStyle}>
        <div className={styles.header} style={headerStyle}>
          <h2 className={styles.headerTitle} style={titleStyle}>{title}</h2>
          <div className={styles.headerRight}>
            {headerRight}
            <button
              className={`${styles.closeBtn}${noCloseDivider ? ` ${styles.closeBtnNoDivider}` : ''}`}
              onClick={requestClose}
              aria-label="Close drawer"
            >
              <CloseIcon size={20} />
            </button>
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

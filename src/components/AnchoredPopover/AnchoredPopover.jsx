import { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CloseButton } from '../CloseButton/CloseButton';
import styles from './AnchoredPopover.module.css';

/**
 * A panel of content anchored to a trigger: title, optional description,
 * a close button, and a scrolling body. Portal-rendered so it isn't clipped,
 * opens above the trigger when it sits in the lower half of the screen, and
 * closes on Escape or an outside click. For a list of actions use
 * MenuPopover instead.
 *
 * @param {DOMRect} props.anchorRect   The trigger's getBoundingClientRect().
 * @param {string}  props.title
 * @param {string}  [props.description]
 * @param {number}  [props.width=420]
 * @param {number}  [props.maxHeight=440]
 * @param {'left'|'right'} [props.align='right'] Which trigger edge it lines up with.
 * @param {boolean} [props.centered=false] Open in the middle of the screen
 *   instead of at the trigger (anchorRect isn't needed then).
 * @param {boolean} [props.backdrop=false] Dim and lightly blur the page behind
 *   it, for a popover that asks for decisions rather than a quick glance.
 * @param {function} props.onClose
 */
export function AnchoredPopover({
  anchorRect, title, description, width = 420, maxHeight = 440, align = 'right', centered = false, backdrop = false, onClose, children,
}) {
  const panelRef = useRef(null);

  // Hold the height it opened at: as items inside are resolved the panel
  // doesn't shrink (and, centered, re-center), so whatever moves up into a
  // resolved item's place lands right under the pointer.
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (el) el.style.minHeight = `${el.getBoundingClientRect().height}px`;
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!anchorRect && !centered) return null;
  const style = centered
    ? { width: Math.min(width, window.innerWidth - 32), maxHeight: Math.min(maxHeight, window.innerHeight - 64) }
    : anchoredStyle(anchorRect, width, maxHeight, align);

  return createPortal(
    <>
      <div className={`${styles.overlay} ${backdrop ? styles.backdrop : ''}`} onMouseDown={(e) => { e.stopPropagation(); onClose?.(); }} aria-hidden="true" />
      <div ref={panelRef} role="dialog" aria-label={title} className={`${styles.panel} ${centered ? styles.centered : ''}`} style={style} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.head}>
          <div className={styles.headText}>
            <span className={styles.title}>{title}</span>
            {description && <span className={styles.description}>{description}</span>}
          </div>
          <CloseButton onClick={onClose} label={`Close ${title}`} />
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </>,
    document.body,
  );
}

function anchoredStyle(anchorRect, width, maxHeight, align) {
  const openAbove = (anchorRect.top + anchorRect.bottom) / 2 > window.innerHeight / 2;
  const style = { width, maxHeight: Math.min(maxHeight, (openAbove ? anchorRect.top : window.innerHeight - anchorRect.bottom) - 16) };
  if (openAbove) style.bottom = window.innerHeight - anchorRect.top + 6;
  else style.top = anchorRect.bottom + 6;
  if (align === 'right') style.right = Math.max(8, window.innerWidth - anchorRect.right);
  else style.left = Math.max(8, Math.min(anchorRect.left, window.innerWidth - width - 8));

  return style;
}

import { useNativeDialog } from '../../hooks/useNativeDialog';
import { Icon } from '../Icon/Icon';
import styles from './BottomSheet.module.css';

/**
 * BottomSheet: a sheet that slides up from the bottom of a phone screen
 * (Figma Provider App "Drawer", e.g. 759:21765). Built on a native <dialog>,
 * so focus stays inside, Escape closes it and the page behind is inert.
 * Tapping the dimmed area closes it too.
 *
 * Render it only while open (`{open && <BottomSheet … />}`).
 *
 * @param {object}   props
 * @param {string}   [props.title]   – small caps heading with a close button
 * @param {() => void} props.onClose
 * @param {React.ReactNode} props.children
 * @param {string}   [props.className]
 */
export function BottomSheet({ title, onClose, children, className }) {
  const ref = useNativeDialog();
  return (
    // The dialog itself is the dimmed backdrop area: a tap that lands on it
    // (not on the sheet) closes. Escape arrives as the dialog's cancel event.
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-label={title}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={[styles.sheet, className].filter(Boolean).join(' ')}>
        {title && (
          <div className={styles.head}>
            <h2 className={styles.title}>{title}</h2>
            <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
              <Icon name="solar:close-circle-linear" size={24} />
            </button>
          </div>
        )}
        {children}
      </div>
    </dialog>
  );
}

/**
 * One tappable row in a BottomSheet: icon, label, optional detail on the
 * right (Figma 759:21765 "Re-assign · Dr. JeDee Potter (You)").
 */
export function BottomSheetItem({ icon, label, detail, tone = 'neutral', onClick, disabled }) {
  return (
    <button
      type="button"
      className={[styles.item, tone === 'danger' ? styles.danger : ''].filter(Boolean).join(' ')}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <Icon name={icon} size={24} color="currentColor" />}
      <span className={styles.itemLabel}>{label}</span>
      {detail && <span className={styles.itemDetail}>{detail}</span>}
    </button>
  );
}

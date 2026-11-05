import { Icon } from '../Icon/Icon';
import { CloseIcon } from '../Icon/CloseIcon';
import styles from './SearchBar.module.css';

/**
 * SearchBar: the expanded search input used across the app (worklist tab bar,
 * Care Programs, etc.). A bordered field with a leading magnifier, text input,
 * and a trailing clear/close button. Kept in one place so every "expanded
 * search" reads identically.
 *
 * @param {object}   props
 * @param {string}   props.value
 * @param {function} props.onChange       – input change handler (event)
 * @param {function} [props.onClose]      – if provided, shows the ✕ button
 * @param {string}   [props.placeholder]
 * @param {boolean}  [props.autoFocus=true]
 * @param {boolean}  [props.fullWidth=false] – stretch to fill the container
 * @param {string}   [props.className]
 */
export function SearchBar({
  value,
  onChange,
  onClose,
  placeholder = 'Search…',
  autoFocus = true,
  fullWidth = false,
  className,
}) {
  return (
    <div className={[styles.searchInput, fullWidth ? styles.fullWidth : '', className || ''].filter(Boolean).join(' ')}>
      <Icon name="solar:magnifer-linear" size={15} color="var(--neutral-300)" />
      <input
        autoFocus={autoFocus}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
      />
      {onClose && (
        <button type="button" className={styles.searchClose} onClick={onClose} aria-label="Close search">
          <CloseIcon size={16} color="currentColor" />
        </button>
      )}
    </div>
  );
}

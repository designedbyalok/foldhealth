import { Icon } from '../Icon/Icon';
import styles from './Kbd.module.css';

/**
 * Fold Health Kbd: a keyboard key cap, for shortcut hints ("⌘ + K").
 * Renders a <kbd>, so assistive tech reads it as keyboard input.
 *
 * @param {object} props
 * @param {React.ReactNode} [props.children] – The key's text ("Enter", "K").
 * @param {string} [props.icon] – Solar icon name for a symbol key (⌘, ⇧, arrows).
 * @param {string} [props.className]
 */
export function Kbd({ children, icon, className }) {
  return (
    <kbd className={[styles.kbd, className].filter(Boolean).join(' ')}>
      {icon && <Icon name={icon} size={12} color="currentColor" />}
      {children}
    </kbd>
  );
}

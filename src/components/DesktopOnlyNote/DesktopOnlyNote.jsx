import { Icon } from '../Icon/Icon';
import styles from './DesktopOnlyNote.module.css';

/**
 * DesktopOnlyNote: says a piece of work happens on a computer (a builder,
 * canvas or wizard too big for a phone), so a phone screen can show what it
 * can and point there for the rest.
 *
 * @param {object} props
 * @param {string} [props.title='Open on a computer to edit']
 * @param {React.ReactNode} [props.description] – what is done there
 * @param {string} [props.icon='solar:monitor-linear'] – Solar linear icon
 * @param {'md'|'lg'} [props.size='md'] – lg uses the phone type scale
 * @param {string} [props.className]
 */
export function DesktopOnlyNote({ title = 'Open on a computer to edit', description, icon = 'solar:monitor-linear', size = 'md', className }) {
  return (
    <div className={[styles.note, size === 'lg' ? styles.lg : '', className].filter(Boolean).join(' ')} role="note">
      <span className={styles.icon} aria-hidden="true">
        <Icon name={icon} size={size === 'lg' ? 24 : 20} color="currentColor" />
      </span>
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        {description && <span className={styles.description}>{description}</span>}
      </span>
    </div>
  );
}

import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Avatar } from '../../components/Avatar/Avatar';
import { Icon } from '../../components/Icon/Icon';
import { useAppStore } from '../../store/useAppStore';
import { useMobileNav } from './MobileNavContext';
import { initialsOf } from './mobileFormat';
import styles from './mobile.module.css';

/** A tab's top bar: big title, alerts bell and the provider's avatar (Figma 759:18981). */
export function MobileRootHeader({ title, actions }) {
  const { push } = useMobileNav();
  const me = useAppStore(s => s.currentUserProfile);
  const unread = useAppStore(s => s.notifications.filter(n => !n.read).length);

  return (
    <header className={styles.header}>
      <h1 className={styles.title}>{title}</h1>
      <div className={styles.headerActions}>
        {actions}
        <ActionButton
          icon="solar:bell-linear"
          size="lg"
          notification={unread > 0}
          count={unread > 0 ? (unread > 99 ? '99+' : String(unread)) : undefined}
          aria-label={unread ? `Alerts, ${unread} unread` : 'Alerts'}
          onClick={() => push('alerts')}
        />
        <button type="button" className={styles.avatarBtn} aria-label="My profile" onClick={() => push('profile')}>
          <Avatar variant="staff" size="XL" initials={initialsOf(me?.name)} userName={me?.name} userId={me?.id} />
        </button>
      </div>
    </header>
  );
}

/** A sub-screen's top bar: back arrow, optional title and trailing actions. */
export function MobileSubHeader({ title, actions, children }) {
  const { pop } = useMobileNav();
  return (
    <header className={styles.subHeader}>
      <div className={styles.subHeaderRow}>
        <button type="button" className={styles.iconBtn} aria-label="Back" onClick={pop}>
          <Icon name="solar:arrow-left-linear" size={24} />
        </button>
        <span className={styles.title} />
        {actions}
      </div>
      {title && <h1 className={styles.subTitle}>{title}</h1>}
      {children}
    </header>
  );
}

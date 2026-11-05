import { Avatar } from '../../components/Avatar/Avatar';
import { Badge } from '../../components/Badge/Badge';
import { Icon } from '../../components/Icon/Icon';
import { formatPhone } from '../messages/comms/commsUtils';
import { useMobileNav } from './MobileNavContext';
import { initialsOf } from './mobileFormat';
import styles from './ContactHero.module.css';
import common from './mobile.module.css';

/**
 * Who a screen is about, with quick actions (Figma 759:19891 / 759:19971).
 * `actions` is [{ key, label, icon, onClick, disabled }]. `trailing` sits
 * at the top right, beside the back arrow.
 */
export function ContactHero({ name, pronoun, meta, tags = [], phone, onCallPhone, actions = [], trailing, children }) {
  const { pop } = useMobileNav();
  return (
    <section className={styles.hero}>
      <div className={styles.top}>
        <button type="button" className={common.iconBtn} aria-label="Back" onClick={pop}>
          <Icon name="solar:arrow-left-linear" size={24} />
        </button>
        {trailing}
      </div>
      <div className={styles.identity}>
        <Avatar variant="patient" size="DXL" initials={initialsOf(name)} className={styles.avatar} />
        <div className={styles.names}>
          <div className={styles.nameRow}>
            <h1 className={styles.name}>{name}</h1>
          </div>
          {pronoun && <p className={styles.pronoun}>{pronoun}</p>}
          {meta && <p className={styles.meta}>{meta}</p>}
        </div>
        {tags.length > 0 && (
          <div className={styles.tags}>
            {tags.map(t => <Badge key={t} tone="neutral" variant="soft" size="md" label={t} />)}
          </div>
        )}
      </div>
      {actions.length > 0 && (
        <div className={styles.actions}>
          {actions.map(a => (
            <button key={a.key} type="button" className={styles.tile} onClick={a.onClick} disabled={a.disabled}>
              <Icon name={a.icon} size={24} color="currentColor" />
              {a.label}
            </button>
          ))}
        </div>
      )}
      {phone && (
        <>
          <div className={styles.divider} />
          <button type="button" className={styles.phone} onClick={onCallPhone}>
            <Icon name="solar:phone-linear" size={24} color="currentColor" />
            {formatPhone(phone)}
          </button>
        </>
      )}
      {children}
    </section>
  );
}


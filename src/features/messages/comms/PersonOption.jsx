import { Avatar } from '../../../components/Avatar/Avatar';
import { Badge } from '../../../components/Badge/Badge';
import styles from './PersonOption.module.css';

const initialsOf = (name = '') => name.split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();

/**
 * A person row for pickers (Figma 2910:39991): avatar, name, a meta line
 * (gender • date of birth (age)) and, optionally, a grey tag on the right
 * (e.g. their relation to the patient).
 */
export function PersonOption({ name, initials, meta, tag }) {
  return (
    <span className={styles.row}>
      {/* Same row as User Availability's user pickers: default avatar, name over a grey line. */}
      <Avatar variant="patient" initials={initials || initialsOf(name)} />
      <span className={styles.text}>
        <span className={styles.name}>{name}</span>
        {meta && <span className={styles.meta}>{meta}</span>}
      </span>
      {/* One tag per role ("Care Giver · Decision Maker" is two). */}
      {tag && (
        <span className={styles.tags}>
          {String(tag).split(' · ').map(t => <Badge key={t} size="sm" label={t} />)}
        </span>
      )}
    </span>
  );
}

/**
 * Hover card for a recipient chip (Figma 2906:39324): their role over
 * avatar, name and email.
 */
export function PersonTip({ name, initials, email, tag }) {
  return (
    <span className={styles.tip}>
      {tag && <span className={styles.tipTag}>{String(tag).split(' · ').join(', ')}</span>}
      <span className={styles.tipRow}>
        <Avatar variant="patient" size="S" initials={initials || initialsOf(name)} />
        <span className={styles.tipText}>
          <span className={styles.tipName}>{name}</span>
          {email && <span className={styles.tipEmail}>{email}</span>}
        </span>
      </span>
    </span>
  );
}

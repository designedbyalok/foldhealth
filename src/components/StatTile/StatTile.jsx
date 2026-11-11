import { Icon } from '../Icon/Icon';
import styles from './StatTile.module.css';

const TONES = ['neutral', 'success', 'error', 'warning', 'info'];

/**
 * StatTile: a small summary card: an icon and label, one headline value,
 * and an optional muted caption (e.g. a profile's "Last successful sign-in").
 * Lay several side by side in a grid.
 *
 * @param {string} props.label
 * @param {React.ReactNode} props.value
 * @param {string} [props.caption]
 * @param {string} [props.icon]  Solar icon name.
 * @param {'neutral'|'success'|'error'|'warning'|'info'} [props.tone]  Icon colour.
 * @param {string} [props.className]  Extra class on the tile (e.g. a tinted background).
 */
export function StatTile({ label, value, caption, icon, tone = 'neutral', className }) {
  const t = TONES.includes(tone) ? tone : 'neutral';
  return (
    <div className={[styles.tile, className].filter(Boolean).join(' ')}>
      <div className={styles.head}>
        {icon && (
          <span className={`${styles.icon} ${styles[t]}`}>
            <Icon name={icon} size={14} />
          </span>
        )}
        <span className={styles.label}>{label}</span>
      </div>
      <div className={styles.value}>{value}</div>
      {caption && <div className={styles.caption}>{caption}</div>}
    </div>
  );
}

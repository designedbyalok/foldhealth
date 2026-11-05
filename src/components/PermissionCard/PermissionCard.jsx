import { Icon } from '../Icon/Icon';
import { Switch } from '../Switch/Switch';
import styles from './PermissionCard.module.css';

/**
 * PermissionCard: a titled card of on/off permissions (Figma "Platform
 * Access" / "Settings Access", Simplifying Implementation 55:42415).
 *
 * Header: icon, title and an "Allow All" switch that is on only when every
 * row is on. Then a Permissions / Status column header and the rows,
 * optionally split into groups with a grey group label.
 *
 * @param {object}   props
 * @param {string}   props.icon        – Solar icon name for the title
 * @param {string}   props.title
 * @param {Array}    props.groups      – [{ label?, items: [{ key, label }] }]; a group
 *                                       without a label renders its rows straight in
 * @param {function} props.isOn        – (key) => boolean
 * @param {function} props.onToggle    – (key, on) => void
 * @param {function} props.onToggleAll – (on) => void, for Allow All
 * @param {boolean}  [props.disabled]  – Read-only (switches show but don't change)
 * @param {string}   [props.className]
 */
export function PermissionCard({ icon, title, groups, isOn, onToggle, onToggleAll, disabled = false, className }) {
  const keys = groups.flatMap(g => g.items.map(i => i.key));
  const allOn = keys.length > 0 && keys.every(k => isOn(k));
  return (
    <section className={[styles.card, className || ''].filter(Boolean).join(' ')}>
      <div className={styles.head}>
        <span className={styles.title}>
          <Icon name={icon} size={16} color="var(--neutral-400)" />
          {title}
        </span>
        <span className={styles.allowAll}>
          Allow All
          <Switch checked={allOn} onChange={onToggleAll} disabled={disabled} ariaLabel={`${title}: allow all`} />
        </span>
      </div>
      <div className={styles.body}>
        <div className={styles.cols}><span>Permissions</span><span>Status</span></div>
        {groups.map((group, gi) => (
          <div key={group.label || gi}>
            {group.label && <div className={styles.group}>{group.label}</div>}
            {group.items.map(item => (
              <div key={item.key} className={styles.row}>
                <span className={styles.label}>{item.label}</span>
                <Switch
                  checked={isOn(item.key)}
                  onChange={on => onToggle(item.key, on)}
                  disabled={disabled}
                  ariaLabel={`${title}: ${item.label}`}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

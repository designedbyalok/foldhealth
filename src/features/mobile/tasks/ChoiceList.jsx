import { Icon } from '../../../components/Icon/Icon';
import styles from './ChoiceList.module.css';

/**
 * Bottom-sheet picker rows with a check on the picked one (Figma Drawer
 * 1050:51230, priority drawer 759:21744). Options: { key, label, icon?, detail? }.
 * An array `value` makes it multi-select: each row toggles.
 */
export function ChoiceList({ options, value, onPick, label }) {
  const multi = Array.isArray(value);
  const isOn = (key) => (multi ? value.includes(key) : key === value);
  return (
    <div className={styles.choices} role={multi ? 'group' : 'radiogroup'} aria-label={label}>
      {options.map(o => (
        <button
          key={o.key}
          type="button"
          role={multi ? 'checkbox' : 'radio'}
          aria-checked={isOn(o.key)}
          className={styles.choice}
          onClick={() => onPick(o.key)}
        >
          {o.icon}
          <span className={styles.choiceLabel}>{o.label}</span>
          {o.detail != null && <span className={styles.choiceDetail}>{o.detail}</span>}
          {isOn(o.key) && <Icon name="solar:unread-linear" size={32} color="currentColor" />}
        </button>
      ))}
    </div>
  );
}

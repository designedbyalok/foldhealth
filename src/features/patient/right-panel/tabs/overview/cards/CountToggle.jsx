import { SegmentedControl } from '../../../../../../components/SegmentedControl/SegmentedControl';
import styles from './overviewCards.module.css';

/**
 * The Overview's tab switch: a small Toggle whose segments carry a count
 * chip (Goals 8). `items` are { key, label, count }; count is optional.
 */
export function CountToggle({ items, active, onChange }) {
  return (
    <SegmentedControl
      size="sm"
      items={items.map(({ key, label, count }) => ({
        key,
        label: (
          <span className={styles.toggleLabel}>
            {label}
            {count != null && <span className={styles.toggleCount}>{count}</span>}
          </span>
        ),
      }))}
      value={active}
      onValueChange={onChange}
    />
  );
}

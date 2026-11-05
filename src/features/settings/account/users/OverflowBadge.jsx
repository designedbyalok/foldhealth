import { useState, useRef } from 'react';
import { Badge } from '../../../../components/Badge/Badge';
import styles from '../AccountPanel.module.css';

/**
 * +N chip that reveals a dropdown of the remaining values on hover.
 * Used by the Users table's Roles and Practice Location cells when a user
 * has more than one value in either column.
 */
export function OverflowBadge({ count, items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  return (
    <div
      className={styles.overflowBadgeWrap}
      ref={ref}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <Badge label={`+${count}`} />
      {open && items.length > 0 && (
        <div className={styles.overflowDropdown}>
          {items.map((item, i) => (
            <div key={i} className={styles.overflowItem}>{item}</div>
          ))}
        </div>
      )}
    </div>
  );
}

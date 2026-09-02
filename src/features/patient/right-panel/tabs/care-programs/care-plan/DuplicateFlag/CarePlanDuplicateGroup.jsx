import { useState } from 'react';
import { Icon } from '../../../../../../../components/Icon/Icon';
import { DownChevronIcon } from '../../../../../../../components/Icon/DownChevronIcon';
import { CarePlanDuplicateFlag } from './CarePlanDuplicateFlag';
import styles from './CarePlanDuplicateGroup.module.css';

/**
 * Groups a section's possible-duplicate banners. A single duplicate shows its
 * comparison card directly; several collapse behind one "N possible duplicates"
 * summary (default collapsed) so a heavily-overlapping plan isn't buried under
 * stacked banners.
 */
export function CarePlanDuplicateGroup({ flags, onIgnore, onAcceptExisting, onAcceptNew, onEditExisting }) {
  const [open, setOpen] = useState(false);
  if (!flags.length) return null;

  const card = (flag) => (
    <CarePlanDuplicateFlag
      key={flag.flagId}
      flag={flag}
      onIgnore={() => onIgnore(flag)}
      onAcceptExisting={() => onAcceptExisting(flag)}
      onAcceptNew={() => onAcceptNew(flag)}
      onEditExisting={() => onEditExisting(flag)}
    />
  );

  if (flags.length === 1) return card(flags[0]);

  return (
    <div className={styles.group}>
      <button type="button" className={styles.summary} onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <Icon name="solar:danger-triangle-linear" size={16} color="var(--status-warning)" />
        <span className={styles.summaryText}>{flags.length} possible duplicates</span>
        <DownChevronIcon size={16} color="var(--neutral-300)" className={open ? '' : styles.chevronClosed} />
      </button>
      {open && <div className={styles.list}>{flags.map(card)}</div>}
    </div>
  );
}

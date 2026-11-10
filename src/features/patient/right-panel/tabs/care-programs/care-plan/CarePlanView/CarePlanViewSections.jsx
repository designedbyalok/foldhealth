import { Button } from '@/components/Button/Button';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { AddIconMinimalist } from '@/components/Icon/AddIconMinimalist';
import { DownChevronIcon } from '@/components/Icon/DownChevronIcon';
import styles from './CarePlanView.module.css';

export { GBI_STATUSES } from '../lib/gbiStatus';
export const PRIORITIES = ['high', 'medium', 'low'];
export const PRIORITY_LABELS = ['High', 'Medium', 'Low'];

// `flag` sits right after the title and count (e.g. "2 Off Target").
export function GbiSectionHead({ title, count, open, onToggle, flag, addButton, trailingEnd, rightAccessory }) {
  const hasRight = !!rightAccessory || !!trailingEnd;
  return (
    <div className={`${styles.sectionHead} ${styles.gbiSectionHead}`}>
      <SectionTitle label={title} count={count} open={open} onToggle={onToggle} />
      {flag}
      <span className={styles.sectionActionDivider} aria-hidden="true" />
      {addButton}
      {hasRight ? (
        <div className={styles.gbiSectionHeadEnd}>
          {rightAccessory}
          {trailingEnd}
        </div>
      ) : null}
    </div>
  );
}

export function SectionTitle({ label, count, open, onToggle }) {
  return (
    <button type="button" className={styles.sectionToggle} onClick={onToggle} aria-expanded={open}>
      <DownChevronIcon
        size={16}
        color="var(--neutral-400)"
        className={`${styles.sectionChevron} ${open ? '' : styles.sectionChevronClosed}`}
      />
      <span className={styles.sectionTitle}>{label}</span>
      {count > 0 ? <span className={styles.sectionCount}>{count}</span> : null}
    </button>
  );
}

export function SectionEmptyState({ icon, label, onAdd }) {
  return (
    <div className={styles.sectionEmpty}>
      <EmptyState icon={icon} title={label} iconSize={31} />
      <div className={styles.sectionEmptyActions}>
        <Button
          variant="soft"
          leadingIconElement={<AddIconMinimalist size={16} />}
          onClick={onAdd}
        >
          Add New
        </Button>
      </div>
    </div>
  );
}

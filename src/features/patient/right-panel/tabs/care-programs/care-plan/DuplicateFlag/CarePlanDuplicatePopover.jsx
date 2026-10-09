import { useLayoutEffect, useRef } from 'react';
import { AnchoredPopover } from '../../../../../../../components/AnchoredPopover/AnchoredPopover';
import { Badge } from '../../../../../../../components/Badge/Badge';
import { Button } from '../../../../../../../components/Button/Button';
import { parseLocalDate } from '../../../../../../../lib/localDate';
import styles from './CarePlanDuplicatePopover.module.css';

const NOUN = { goal: 'goal', intervention: 'intervention', barrier: 'barrier' };

function fmtDate(iso) {
  const d = parseLocalDate(iso) || (iso ? new Date(iso) : null);
  if (!d || Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** One copy of the item: which plan it's on, who added it, and Keep. */
function Copy({ tag, tone, where, who, when, onKeep, onEdit, slot }) {
  return (
    <div className={`${styles.copy} ${tone === 'primary' ? styles.copyNew : styles.copyExisting}`}>
      <Badge size="S" tone={tone} label={tag} className={styles.tag} />
      <span className={styles.where}>
        {[where, who, when].filter(Boolean).join(' · ')}
      </span>
      {onEdit && <Button variant="tertiary" size="S" onClick={onEdit}>Edit</Button>}
      <Button variant="secondary" size="S" onClick={onKeep} data-slot={slot}>Keep</Button>
    </div>
  );
}

/**
 * A section's possible duplicates, in a popover off the section's badge.
 * Each one shows the item once, then its two copies (the one already on a
 * plan, and the new one on this plan) with Keep on each, and Keep both.
 * Keeping one removes the other from this plan; nothing on another
 * program's plan is touched.
 */
export function CarePlanDuplicatePopover({ anchorRect, kind, flags, onClose, onIgnore, onAcceptExisting, onAcceptNew, onEditExisting }) {
  const noun = NOUN[kind] || 'item';
  // The duplicate below moves up into a resolved one's place; focus goes to
  // the same button on it, so Keep, Keep, Keep works without moving.
  const listRef = useRef(null);
  const lastAction = useRef(null); // { index, slot }
  const act = (index, slot, fn) => () => { lastAction.current = { index, slot }; fn(); };
  useLayoutEffect(() => {
    const last = lastAction.current;
    if (!last || !listRef.current) return;
    lastAction.current = null;
    const items = listRef.current.children;
    const item = items[Math.min(last.index, items.length - 1)];
    item?.querySelector(`[data-slot="${last.slot}"]`)?.focus();
  }, [flags.length]);
  return (
    <AnchoredPopover
      anchorRect={anchorRect}
      width={560}
      maxHeight={620}
      centered
      backdrop
      title={`${flags.length} possible duplicate ${noun}${flags.length === 1 ? '' : 's'}`}
      description="Each one is on this plan twice, or on another care plan too. Keep one, or keep both."
      onClose={onClose}
    >
      <ul className={styles.list} ref={listRef}>
        {flags.map(({ flagId, newItem, existing, ...flag }, index) => {
          const full = { flagId, newItem, existing, ...flag };
          const existingWhere = existing.sameplan ? 'This plan' : `${existing.programCode || 'Another'} plan`;
          return (
            <li key={flagId} className={styles.item}>
              <div className={styles.itemHead}>
                <span className={styles.itemTitle}>{newItem.title}</span>
                <button type="button" className={styles.keepBoth} data-slot="both" onClick={act(index, 'both', () => onIgnore(full))}>Keep both</button>
              </div>
              <Copy
                tag="Existing"
                tone="grey"
                where={existingWhere}
                who={existing.createdBy}
                when={fmtDate(existing.startDate)}
                slot="existing"
                onKeep={act(index, 'existing', () => onAcceptExisting(full))}
                onEdit={existing.sameplan ? () => onEditExisting(full) : undefined}
              />
              <Copy
                tag="New"
                tone="primary"
                where="This plan"
                who={newItem.createdBy}
                when={fmtDate(newItem.createdAt)}
                slot="new"
                onKeep={act(index, 'new', () => onAcceptNew(full))}
              />
            </li>
          );
        })}
      </ul>
    </AnchoredPopover>
  );
}

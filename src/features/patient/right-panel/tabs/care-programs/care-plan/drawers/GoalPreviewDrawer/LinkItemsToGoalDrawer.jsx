import { useMemo, useState } from 'react';
import { Drawer } from '../../../../../../../../components/Drawer/Drawer';
import { Button } from '../../../../../../../../components/Button/Button';
import { Input } from '../../../../../../../../components/Input/Input';
import { Badge } from '../../../../../../../../components/Badge/Badge';
import { CheckboxTick } from '../../../../../../../../components/CheckboxTick/CheckboxTick';
import { GbiLinkButton } from '../../tables/CarePlanLinkedPreview';
import { PriorityIcon } from '../../../../../../../../components/PriorityIcon/PriorityIcon';
import { Tooltip } from '../../../../../../../../components/Tooltip/Tooltip';
import styles from '../BarrierDetailDrawer/LinkGoalToBarrierDrawer.module.css';

/**
 * LinkItemsToGoalDrawer
 *
 * Multi-select picker that lets a reviewer link one-or-more of the
 * plan's existing interventions (or barriers) onto the current goal.
 * Mirrors LinkGoalToBarrierDrawer visually (700px Drawer, search,
 * Selected group with divider, primary Link button in the header), so
 * every "link existing" surface across the care plan reads the same.
 *
 * `items` is the pre-filtered candidate list: the caller strips out
 * anything already linked to this goal so the picker only offers new
 * connections. Each item is:
 *   { id, title, subtitle?, badge? }
 * `subtitle` renders under the title, `badge` sits right-aligned as a
 * grey Type chip.
 */
export function LinkItemsToGoalDrawer({
  title,
  items,
  searchPlaceholder,
  emptyAllLinkedLabel,
  emptyNoMatchLabel,
  onClose,
  onLink,
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(() => new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i => (i.title || '').toLowerCase().includes(q));
  }, [items, query]);

  const { selectedRows, unselectedRows } = useMemo(() => {
    const sel = [];
    const rest = [];
    for (const i of filtered) {
      if (selected.has(i.id)) sel.push(i); else rest.push(i);
    }
    return { selectedRows: sel, unselectedRows: rest };
  }, [filtered, selected]);

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const canLink = selected.size > 0;
  const handleLink = () => {
    if (!canLink) return;
    onLink?.(Array.from(selected));
    onClose?.();
  };

  return (
    <Drawer
      title={title}
      onClose={onClose}
      width={700}
      noCloseDivider
      headerRight={
        <>
          <Button disabled={!canLink} onClick={handleLink}>
            Link
          </Button>
          <span className={styles.headerDivider} aria-hidden />
        </>
      }
    >
      <div className={styles.body}>
        <div className={styles.searchWrap}>
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={searchPlaceholder || 'Search'}
            leadingIcon="solar:magnifer-linear"
            aria-label={searchPlaceholder || 'Search'}
          />
        </div>

        {filtered.length === 0 ? (
          <div className={styles.empty}>
            {items.length === 0
              ? (emptyAllLinkedLabel || 'Everything on this plan is already linked to this goal.')
              : (emptyNoMatchLabel || 'No results match that search.')}
          </div>
        ) : (
          <>
            {selectedRows.length > 0 && (
              <>
                <div className={styles.groupLabel}>Selected</div>
                <ul className={styles.list}>
                  {selectedRows.map(i => renderRow(i, selected, toggle))}
                </ul>
                {unselectedRows.length > 0 && <div className={styles.groupDivider} aria-hidden />}
              </>
            )}
            {unselectedRows.length > 0 && (
              <ul className={styles.list}>
                {unselectedRows.map(i => renderRow(i, selected, toggle))}
              </ul>
            )}
          </>
        )}
      </div>
    </Drawer>
  );
}

function renderRow(item, selected, toggle) {
  const isChecked = selected.has(item.id);
  // Right rail: same link affordance the plan-level table uses. The
  // ActionButton shows the count as a badge on the icon, hovering pops
  // the shared LinkedItemsPopover card with the goal / intervention /
  // barrier breakdown. When there's nothing linked, fall back to a
  // plain kind chip (`badge`) if the caller supplied one.
  const linkedTotal = (item.linkedPreview?.goals?.length || 0)
    + (item.linkedPreview?.interventions?.length || 0)
    + (item.linkedPreview?.barriers?.length || 0);
  const subtitleNode = item.subtitleNode || (item.subtitle ? <span className={styles.subtitle}>{item.subtitle}</span> : null);
  return (
    <li key={item.id}>
      <button
        type="button"
        role="checkbox"
        aria-checked={isChecked}
        className={styles.row}
        onClick={() => toggle(item.id)}
      >
        <span className={styles.check}>
          <CheckboxTick checked={isChecked} />
        </span>
        <div className={styles.stack}>
          <span className={styles.title}>{item.title}</span>
          {subtitleNode}
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {item.badge && (
            <>
              <Badge size="sm" label={item.badge} />
              {(item.priority || linkedTotal > 0) && (
                <span className={styles.headerDivider} aria-hidden />
              )}
            </>
          )}
          {item.priority && (
            <Tooltip label={`Priority: ${String(item.priority).replace(/^./, c => c.toUpperCase())}`}>
              <span aria-label={`Priority ${item.priority}`} style={{ display: 'inline-flex' }}>
                <PriorityIcon priority={item.priority} size={16} />
              </span>
            </Tooltip>
          )}
          {linkedTotal > 0 && <GbiLinkButton data={item.linkedPreview} />}
        </span>
      </button>
    </li>
  );
}

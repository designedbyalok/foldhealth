import { useMemo, useState } from 'react';
import { Drawer } from '../../../../../../../../components/Drawer/Drawer';
import { Button } from '../../../../../../../../components/Button/Button';
import { Input } from '../../../../../../../../components/Input/Input';
import { Badge } from '../../../../../../../../components/Badge/Badge';
import { CheckboxTick } from '../../../../../../../../components/CheckboxTick/CheckboxTick';
import { formatGoalTarget, formatGoalDuration } from '../../../../../../../settings/care-plan-library/lib';
import styles from './LinkGoalToBarrierDrawer.module.css';

/**
 * LinkGoalToBarrierDrawer — multi-select goal picker for wiring a
 * barrier onto one-or-more goals in the current plan version.
 *
 * Rows show:
 *   • Checkbox — toggles selection.
 *   • Goal title, subtitle (measure + duration), and Template chip
 *     when the goal was cloned from a plan-template.
 *   • Right-aligned Type badge (Vitals / Exercise / Diet / Labs /
 *     Assessment / Others).
 *
 * Header carries a primary "Link" button that stays disabled until at
 * least one goal is selected. On Link the caller receives the full set
 * of chosen goal ids and clones the barrier onto each.
 */
export function LinkGoalToBarrierDrawer({ goals, onClose, onLink }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(() => new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return goals;
    return goals.filter(g => (g.title || '').toLowerCase().includes(q));
  }, [goals, query]);

  // Figma 2937:268413 splits the picker into a "Selected" group at the
  // top (checked rows), a horizontal divider, then the unchecked rows.
  const { selectedRows, unselectedRows } = useMemo(() => {
    const sel = [];
    const rest = [];
    for (const g of filtered) {
      if (selected.has(g.id)) sel.push(g); else rest.push(g);
    }
    return { selectedRows: sel, unselectedRows: rest };
  }, [filtered, selected]);

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // Same measure + target + duration recipe Goal Details uses so the
  // subtitle here reads exactly like the goal's own subtitle in the
  // plan (e.g. "Exercise > 150 Mins/week • 3 Months").
  const subtitleFor = (g) => {
    const target = formatGoalTarget(g);
    const dur = formatGoalDuration(g);
    const left = [g.measure, target].filter(Boolean).join(' ').trim();
    return [left, dur].filter(Boolean).join(' • ');
  };

  const canLink = selected.size > 0;
  const handleLink = () => {
    if (!canLink) return;
    onLink?.(Array.from(selected));
    onClose?.();
  };

  return (
    <Drawer
      title="Link Goal to Barrier"
      onClose={onClose}
      width={700}
      noCloseDivider
      headerRight={
        <>
          <Button variant="primary" size="M" disabled={!canLink} onClick={handleLink}>
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
            placeholder="Search Goal"
            leadingIcon="solar:magnifer-linear"
            aria-label="Search Goal"
          />
        </div>

        {filtered.length === 0 ? (
          <div className={styles.empty}>
            {goals.length === 0
              ? 'Every goal in this plan is already linked to this barrier.'
              : 'No goals match that search.'}
          </div>
        ) : (
          <>
            {selectedRows.length > 0 && (
              <>
                <div className={styles.groupLabel}>Selected</div>
                <ul className={styles.list}>
                  {selectedRows.map(g => renderRow(g, selected, toggle, subtitleFor, styles))}
                </ul>
                {unselectedRows.length > 0 && <div className={styles.groupDivider} aria-hidden />}
              </>
            )}
            {unselectedRows.length > 0 && (
              <ul className={styles.list}>
                {unselectedRows.map(g => renderRow(g, selected, toggle, subtitleFor, styles))}
              </ul>
            )}
          </>
        )}
      </div>
    </Drawer>
  );
}

function renderRow(g, selected, toggle, subtitleFor, styles) {
  const isChecked = selected.has(g.id);
  const subtitle = subtitleFor(g);
  const type = g.category || g.type || 'Others';
  // The plan template a goal belongs to is derived from its chronic-
  // condition binding — a goal that targets a condition (Hypertension,
  // DM2, etc.) is authored under that plan-template. Fall back to any
  // explicit templateName / template if the store starts carrying one.
  const conditionLabel = Array.isArray(g.conditions) && g.conditions.length
    ? (typeof g.conditions[0] === 'string' ? g.conditions[0] : g.conditions[0]?.label)
    : null;
  const templateName = g.templateName || g.template || conditionLabel || null;
  return (
    <li key={g.id}>
      <button
        type="button"
        role="checkbox"
        aria-checked={isChecked}
        className={styles.row}
        onClick={() => toggle(g.id)}
      >
        <span className={styles.check}>
          <CheckboxTick checked={isChecked} />
        </span>
        <div className={styles.stack}>
          <span className={styles.title}>{g.title}</span>
          {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
          {templateName && (
            <span className={styles.templateLine}>
              Template: <Badge tone="grey" size="S" label={templateName} />
            </span>
          )}
        </div>
        <Badge tone="grey" size="S" label={type} />
      </button>
    </li>
  );
}

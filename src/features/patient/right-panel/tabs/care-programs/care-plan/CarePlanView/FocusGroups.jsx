import { useState } from 'react';
import { Badge } from '@/components/Badge/Badge';
import { Icon } from '@/components/Icon/Icon';
import { PanelSectionMore } from '@/components/PanelSection/PanelSection';
import { FOCUS_GROUPS } from '../lib/carePlanFocus';
import styles from './CarePlanFocusPanel.module.css';

const SEVERITY_ICON = {
  danger: ['solar:danger-circle-linear', 'var(--status-error)'],
  warning: ['solar:danger-triangle-linear', 'var(--status-warning)'],
};
const GROUP_LIMIT = 3;

function Group({ label, items, onOpen, renderActions }) {
  const [all, setAll] = useState(false);
  const [icon, color] = SEVERITY_ICON[items[0].severity];
  const shown = all ? items : items.slice(0, GROUP_LIMIT);
  return (
    <li className={styles.group}>
      <span className={styles.groupHead}>
        <Icon name={icon} size={14} color={color} />
        <span className={styles.groupLabel}>{label}</span>
        <span className={styles.groupCount}>{items.length}</span>
      </span>
      <ul className={styles.groupRows}>
        {shown.map(f => (
          <li key={f.key} className={styles.focusRow}>
            <span className={styles.focusText}>
              {f.item && onOpen ? (
                <button type="button" className={`${styles.titleButton} ${styles.focusName}`} title={f.name} onClick={() => onOpen(f)}>{f.name}</button>
              ) : <span className={styles.focusName} title={f.name}>{f.name}</span>}
              <span className={styles.focusReason}>{f.reason}</span>
            </span>
            {f.program && <Badge size="sm" label={f.program.code} />}
            {renderActions?.(f)}
          </li>
        ))}
      </ul>
      {items.length > GROUP_LIMIT && (
        <PanelSectionMore className={styles.groupMore} expanded={all} hiddenCount={items.length - GROUP_LIMIT} onToggle={() => setAll(v => !v)} />
      )}
    </li>
  );
}

/**
 * Look at These First as a list grouped by what's wrong (review due, goals
 * off target, overdue interventions, unaddressed barriers): one heading per
 * kind with its severity and count, then a short row per item, its name
 * (opening it), why it's listed, and its program on All Programs.
 */
export function FocusGroups({ items, onOpen, renderActions }) {
  return (
    <ul className={styles.groups}>
      {FOCUS_GROUPS.map(({ kind, label }) => {
        const rows = items.filter(f => f.kind === kind);
        return rows.length ? <Group key={kind} label={label} items={rows} onOpen={onOpen} renderActions={renderActions} /> : null;
      })}
    </ul>
  );
}

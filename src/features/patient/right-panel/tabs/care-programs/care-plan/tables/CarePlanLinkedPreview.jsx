import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../../../../../../components/Icon/Icon';
import { Badge } from '../../../../../../../components/Badge/Badge';
import { ActionButton } from '../../../../../../../components/ActionButton/ActionButton';
import styles from './CarePlanLinkedPreview.module.css';

/** Total linked items across the three link kinds (care program is context). */
export function linkedTotal(data) {
  if (!data) return 0;
  return (data.goals?.length || 0) + (data.interventions?.length || 0)
    + (data.barriers?.length || 0) + (data.automations?.length || 0);
}

function Row({ icon, iconColor = 'var(--neutral-400)', label }) {
  return (
    <div className={styles.row}>
      <Icon name={icon} size={16} color={iconColor} className={styles.rowIcon} />
      <span className={styles.rowLabel}>{label}</span>
    </div>
  );
}

/** Portal-rendered hover card previewing a goal's linked items (Figma SNP-Story 2632:112808). */
function LinkedItemsPopover({ anchorRect, data }) {
  const total = linkedTotal(data);
  const width = 320;
  // Anchor below the trigger, right-aligned, clamped to the viewport.
  const top = Math.min(anchorRect.bottom + 6, window.innerHeight - 12);
  const left = Math.max(12, Math.min(anchorRect.right - width, window.innerWidth - width - 12));
  const programs = data.programs || [];
  return createPortal(
    <div className={styles.card} style={{ top, left, width }} role="tooltip">
      <div className={styles.head}>
        <Icon name="custom:link" size={16} color="var(--neutral-400)" />
        <span className={styles.headText}>{total} Linked Item{total === 1 ? '' : 's'}</span>
      </div>
      {programs.length > 0 && (
        <div className={styles.section}>
          <span className={styles.sectionLabel}>Care Program</span>
          <div className={styles.badges}>
            {programs.map(p => <Badge key={p} tone="grey" size="S" label={p} />)}
          </div>
        </div>
      )}
      {data.goals?.length > 0 && (
        <div className={styles.section}>
          <span className={styles.sectionLabel}>{data.goals.length === 1 ? 'Goal' : 'Goals'}</span>
          {data.goals.map(g => (
            <Row key={g.id} icon="solar:flag-linear" label={g.title} />
          ))}
        </div>
      )}
      {data.interventions?.length > 0 && (
        <div className={styles.section}>
          <span className={styles.sectionLabel}>Interventions</span>
          {data.interventions.map(i => (
            <Row key={i.id} icon={i.icon || 'solar:clipboard-list-linear'} label={i.title} />
          ))}
        </div>
      )}
      {data.barriers?.length > 0 && (
        <div className={styles.section}>
          <span className={styles.sectionLabel}>Barriers</span>
          {data.barriers.map(b => (
            <Row key={b.id} icon="solar:danger-triangle-linear" iconColor="var(--neutral-300)" label={b.title} />
          ))}
        </div>
      )}
      {data.automations?.length > 0 && (
        <div className={styles.section}>
          <span className={styles.sectionLabel}>Automation</span>
          {data.automations.map(a => (
            <Row key={a.id} icon="solar:bolt-linear" iconColor="var(--neutral-300)" label={a.title} />
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}

/**
 * Link affordance for a GBI row: an ActionButton badged with the number of
 * linked interventions/barriers/automations. Hovering previews them; clicking
 * opens the link manager (when editable).
 */
export function GbiLinkButton({ data, canEdit, onClick, size = 'S' }) {
  const total = linkedTotal(data);
  const [rect, setRect] = useState(null);
  const wrapRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const open = () => {
    if (total === 0) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (wrapRef.current) setRect(wrapRef.current.getBoundingClientRect());
    }, 120);
  };
  const close = () => { clearTimeout(timerRef.current); setRect(null); };

  return (
    <span
      ref={wrapRef}
      className={styles.wrap}
      onMouseEnter={open}
      onMouseLeave={close}
      onClick={(e) => { e.stopPropagation(); if (canEdit) onClick?.(e); }}
    >
      <ActionButton
        icon="custom:link"
        size={size}
        count={total > 0 ? String(total) : undefined}
        iconColor={total > 0 ? 'var(--neutral-300)' : 'var(--neutral-200)'}
        tooltip={total === 0 ? 'No linked items' : undefined}
        aria-label={`${total} linked items`}
      />
      {rect && <LinkedItemsPopover anchorRect={rect} data={data} />}
    </span>
  );
}

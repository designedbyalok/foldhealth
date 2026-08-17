import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../../components/Icon/Icon';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { RULE_FIELDS, FIELD_GROUPS, groupAccent } from './fieldCatalog';
import styles from './ruleBuilder.module.css';

/* Figma lays the five groups over four columns: Personal Info + Location
   stack in the first, the rest get one each. */
const COLUMN_LAYOUT = [
  ['personal', 'location'],
  ['medical'],
  ['patientInfo'],
  ['others'],
];

/**
 * AddConditionPopover — the condition picker (Figma 1:13419). Anchored below
 * the "+ Add Condition" trigger, portal-rendered so the canvas never clips it.
 */
export function AddConditionPopover({ anchorRect, onSelect, onClose }) {
  const popRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Keep the popover on screen: open below the trigger, clamp to the right edge.
  const top = Math.min((anchorRect?.bottom ?? 80) + 8, window.innerHeight - 420);
  const left = Math.max(12, Math.min(anchorRect?.left ?? 80, window.innerWidth - 990));

  return createPortal(
    <>
      <div className={styles.popoverBackdrop} onMouseDown={onClose} aria-hidden="true" />
      <div ref={popRef} className={styles.popover} style={{ top, left }} role="dialog" aria-label="Add Condition">
        <div className={styles.popoverHeader}>
          <span className={styles.popoverTitle}>Add Condition</span>
          <ActionButton icon="solar:close-circle-linear" size="L" tooltip="Close" onClick={onClose} />
        </div>
        <div className={styles.popoverColumns}>
          {COLUMN_LAYOUT.map((groupKeys, col) => (
            <div key={col} className={styles.popoverColumn}>
              {groupKeys.map(groupKey => {
                const group = FIELD_GROUPS.find(g => g.key === groupKey);
                return (
                  <div key={groupKey} className={styles.popoverGroup}>
                    <div className={styles.popoverGroupTitle}>{group.label}</div>
                    {RULE_FIELDS.filter(f => f.group === groupKey).map(field => (
                      <button
                        key={field.key}
                        type="button"
                        className={styles.popoverItem}
                        onClick={() => onSelect(field)}
                      >
                        <span className={styles.popoverItemIcon} style={{ background: groupAccent(groupKey) }}>
                          <Icon name={field.icon} size={16} color="var(--neutral-400)" />
                        </span>
                        {field.label}
                        {field.isNew && <span className={styles.newBadge}>New</span>}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </>,
    document.body,
  );
}

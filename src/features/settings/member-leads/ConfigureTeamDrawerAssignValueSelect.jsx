import { useState, useEffect, useRef } from 'react';
import { Icon } from '../../../components/Icon/Icon';
import { Avatar } from '../../../components/Avatar/Avatar';
import { valueOptionsForDimension } from './teamTypeConfig';
import drawerStyles from './ConfigureTeamDrawer.module.css';

/**
 * AssignValueSelect: custom dropdown for the Assign-To "value" column.
 * Replaces the native <select> so each dimension can render the right
 * kind of row:
 *   - TIN     → icon bubble + number + provider count + "Assigned: X%"
 *                (mirrors Figma 2609:12533, same look as Allocated TINs)
 *   - Staff   → avatar + name + role
 *   - Vendor  → plain text row
 *
 * Single-select. The trigger looks like an input field with a chevron
 * matching the dimension dropdown to its left.
 */
export function AssignValueSelect({ dim, value, onChange, tinAssignedPct, staffAvailablePct }) {
  const rawOptions = valueOptionsForDimension(dim);
  // Replace each TIN option's stale assignedPct with the live value
  // computed from the draft + saved teams.
  const options = rawOptions.map(o =>
    o.kind === 'tin' && tinAssignedPct ? { ...o, assignedPct: tinAssignedPct(o.value) } : o,
  );
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selected = options.find(o => o.value === value);
  const triggerLabel = selected ? selected.label : 'Select…';
  const isPlaceholder = !selected;

  return (
    <div className={drawerStyles.assignValueWrap} ref={wrapRef}>
      <button
        type="button"
        className={drawerStyles.assignValueTrigger}
        onClick={() => setOpen(v => !v)}
      >
        <span className={isPlaceholder ? drawerStyles.assignValuePlaceholder : drawerStyles.assignValueText}>
          {triggerLabel}
        </span>
        <Icon name="solar:alt-arrow-down-linear" size={12} color="var(--neutral-300)" />
      </button>
      {open && (
        <div className={drawerStyles.assignValueMenu}>
          {options.length === 0 ? (
            <div className={drawerStyles.userMenuEmpty}>No options.</div>
          ) : options.map(opt => {
            const isSelected = opt.value === value;
            const onPick = () => { onChange(opt.value); setOpen(false); };
            if (opt.kind === 'tin') {
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={drawerStyles.tinRow}
                  onClick={onPick}
                >
                  <span className={drawerStyles.tinIconBubble}>
                    <Icon name="solar:buildings-2-linear" size={14} color="var(--secondary-300)" />
                  </span>
                  <span className={drawerStyles.tinRowText}>
                    <span className={drawerStyles.tinRowNumber}>{opt.label}</span>
                    <span className={drawerStyles.tinRowProviders}>{opt.providers} Providers</span>
                  </span>
                  <span className={drawerStyles.tinRowAssigned}>Assigned: {opt.assignedPct}%</span>
                  {isSelected && (
                    <Icon name="solar:check-circle-bold" size={14} color="var(--primary-300)" />
                  )}
                </button>
              );
            }
            if (opt.kind === 'staff') {
              // Name on top, role underneath; available % chip on the right.
              const available = staffAvailablePct ? staffAvailablePct(opt.value) : null;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={drawerStyles.userMenuItem}
                  onClick={onPick}
                >
                  <Avatar variant="assignee" initials={opt.initials} />
                  <span className={drawerStyles.userMenuText}>
                    <span className={drawerStyles.userMenuName}>{opt.label}</span>
                    {opt.role && <span className={drawerStyles.userMenuRole}>{opt.role}</span>}
                  </span>
                  {available != null && (
                    <span className={drawerStyles.userMenuAvailable}>
                      Available: {available}%
                    </span>
                  )}
                  {isSelected && (
                    <Icon name="solar:check-circle-bold" size={14} color="var(--primary-300)" />
                  )}
                </button>
              );
            }
            // vendor / fallback: plain row
            return (
              <button
                key={opt.value}
                type="button"
                className={drawerStyles.vendorRow}
                onClick={onPick}
              >
                <span className={drawerStyles.vendorRowText}>{opt.label}</span>
                {isSelected && (
                  <Icon name="solar:check-circle-bold" size={14} color="var(--primary-300)" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

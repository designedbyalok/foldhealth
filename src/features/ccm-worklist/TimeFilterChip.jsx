import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../components/Icon/Icon';
import { Select } from '../../components/Select/Select';
import { ALL_USERS } from './TimeFilterChip.utils';
import styles from './TimeFilterChip.module.css';
// (portal + fixed positioning under the anchor rect) + outside-click
// dismiss.
export function TimeFilterPopover({
  anchorRect,
  onClose,
  label,
  thresholds,
  userOptions,
  value,
  onChange,
}) {
  const popRef = useRef(null);
  const filter = value || { user: ALL_USERS, threshold: null };

  useEffect(() => {
    const onClick = (e) => {
      if (popRef.current && !popRef.current.contains(e.target)) onClose();
    };
    const t = setTimeout(() => document.addEventListener('mousedown', onClick), 0);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', onClick); };
  }, [onClose]);

  const setUser = (user) => onChange({ ...filter, user });
  const setThreshold = (threshold) =>
    onChange({ ...filter, threshold: filter.threshold === threshold ? null : threshold });

  const style = {
    top: anchorRect.bottom + 4,
    left: anchorRect.left,
    minWidth: 220,
  };

  return createPortal(
    <div className={styles.overlay}>
      <div ref={popRef} className={styles.popover} style={style} role="group" aria-label={label}>
        <div className={styles.header}>{label}</div>
        <div className={styles.userRow}>
          <Icon name="solar:users-group-two-rounded-linear" size={16} color="var(--neutral-300)" />
          <Select
            options={[{ value: ALL_USERS, label: ALL_USERS }, ...userOptions.map(u => ({ value: u, label: u }))]}
            value={filter.user || ALL_USERS}
            onValueChange={setUser}
          />
        </div>
        <div className={styles.list}>
          {thresholds.map(t => {
            const active = filter.threshold === t;
            return (
              <button
                key={t}
                type="button"
                className={styles.row}
                onClick={() => setThreshold(t)}
                aria-pressed={active}
              >
                <span className={`${styles.radio} ${active ? styles.radioActive : ''}`}>
                  {active && <span className={styles.radioDot} />}
                </span>
                <span className={styles.rowLabel}>{t}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}

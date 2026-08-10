import { useState, useEffect, useRef } from 'react';
import { Icon } from '../../components/Icon/Icon';
import styles from './NodeSettings.module.css';

export function CustomSelect({ id, value, options, placeholder, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const selected = options.find(o => o.value === value);

  return (
    <div className={styles.customSelect} ref={ref}>
      <button id={id} className={`${styles.customSelectTrigger} ${open ? styles.customSelectTriggerOpen : ''}`} onClick={() => setOpen(!open)}>
        <span className={value ? styles.customSelectValue : styles.customSelectPlaceholder}>
          {selected?.label || placeholder || 'Select...'}
        </span>
        <Icon name="solar:alt-arrow-down-linear" size={12} color="var(--neutral-300)" />
      </button>
      {open && (
        <div className={styles.customSelectDropdown}>
          {options.map(o => (
            <div
              key={o.value}
              className={`${styles.customSelectItem} ${o.value === value ? styles.customSelectItemActive : ''}`}
              onClick={() => { onChange(o.value); setOpen(false); }}
            >
              {o.label}
            </div>
          ))}
          {options.length === 0 && (
            <div className={styles.customSelectEmpty}>No options</div>
          )}
        </div>
      )}
    </div>
  );
}

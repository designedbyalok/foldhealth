import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../components/Icon/Icon';
import { DUE_OPTIONS } from './DueDateChip.utils';
import styles from './DueDateChip.module.css';
export function DueDateChip({ value, onChange }) {
  const triggerRef = useRef(null);
  const [pos, setPos] = useState(null);

  const open = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 6, left: rect.left });
  };
  const close = () => setPos(null);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={[styles.chip, value ? styles.chipActive : ''].join(' ')}
        onClick={pos ? close : open}
      >
        <span>{value || 'Due Date'}</span>
        <Icon
          name="solar:alt-arrow-down-linear"
          size={12}
          color={value ? 'var(--primary-300)' : 'var(--neutral-300)'}
        />
      </button>
      {pos && (
        <DueDatePopover
          pos={pos}
          value={value}
          onSelect={(v) => { onChange(v); close(); }}
          onClose={close}
        />
      )}
    </>
  );
}

function DueDatePopover({ pos, value, onSelect, onClose }) {
  // Close on outside-click / Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <>
      <div aria-hidden="true" className={styles.overlay} onClick={onClose} />
      <div className={styles.popover} style={{ top: pos.top, left: pos.left }}>
        <div className={styles.popHeader}>Due Date</div>
        <div className={styles.optionList}>
          {DUE_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              className={styles.option}
              onClick={() => onSelect(opt)}
            >
              <span
                className={[styles.radio, value === opt ? styles.radioActive : ''].join(' ')}
              >
                {value === opt && <span className={styles.radioDot} />}
              </span>
              <span className={styles.optionLabel}>{opt}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className={styles.reset}
          onClick={() => onSelect(null)}
        >
          Reset Selection
        </button>
      </div>
    </>,
    document.body,
  );
}

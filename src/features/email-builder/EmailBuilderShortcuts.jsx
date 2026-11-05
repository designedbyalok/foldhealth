import { useState, useEffect, useRef, Fragment } from 'react';
import { Icon } from '../../components/Icon/Icon';
import { Kbd } from '../../components/Kbd/Kbd';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { CloseButton } from '../../components/CloseButton/CloseButton';
import styles from './EmailBuilder.module.css';

const SHORTCUTS = [
  { icon: 'solar:undo-left-round-linear', label: 'Undo', keys: [{ icon: 'solar:command-linear' }, { text: 'Z' }] },
  { icon: 'solar:undo-right-round-linear', label: 'Redo', keys: [{ icon: 'solar:arrow-up-linear' }, { icon: 'solar:command-linear' }, { text: 'Z' }] },
  { icon: 'solar:copy-linear', label: 'Duplicate block', keys: [{ icon: 'solar:command-linear' }, { text: 'D' }] },
  { icon: 'solar:pen-new-round-linear', label: 'Rename layer', keys: [{ icon: 'solar:command-linear' }, { text: 'R' }] },
  { icon: 'solar:square-bottom-down-linear', label: 'Select children', keys: [{ text: 'Enter' }] },
  { icon: 'solar:square-top-up-linear', label: 'Select parent', keys: [{ icon: 'solar:arrow-up-linear' }, { text: 'Enter' }] },
  { icon: 'solar:close-circle-linear', label: 'Clear selection', keys: [{ text: 'Esc' }] },
  { icon: 'solar:trash-bin-minimalistic-linear', label: 'Delete block', keys: [{ text: 'Backspace' }] },
];

export function ShortcutsHelpButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <ActionButton
        icon="solar:question-circle-linear"
        tooltip="Keyboard shortcuts"
        onClick={() => setOpen(o => !o)}
      />
      {open && (
        <div className={styles.shortcutsPopover}>
          <div className={styles.shortcutsHeader}>
            <span className={styles.shortcutsTitle}>Keyboard shortcuts</span>
            <CloseButton size={18} onClick={() => setOpen(false)} className={styles.shortcutsClose} label="Close shortcuts" />
          </div>
          {SHORTCUTS.map(s => (
            <div key={s.label} className={styles.shortcutRow}>
              <Icon name={s.icon} size={16} style={{ color: 'var(--neutral-300)', flexShrink: 0 }} />
              <span className={styles.shortcutLabel}>{s.label}</span>
              <div className={styles.shortcutKeys}>
                {s.keys.map((k, i) => (
                  <Fragment key={i}>
                    {i > 0 && <span className={styles.keySep}>+</span>}
                    <Kbd icon={k.icon}>{k.text}</Kbd>
                  </Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

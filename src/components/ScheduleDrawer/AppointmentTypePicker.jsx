import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icon/Icon';
import styles from './ScheduleDrawer.module.css';

export function AppointmentTypePicker({ value, onSelect, appointmentTypes }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const btnRef = useRef(null);

  const filtered = appointmentTypes.filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div style={{ position: 'relative' }}>
      {value ? (
        <button ref={btnRef} className={styles.detailValue} onClick={() => setOpen(v => !v)} style={{ cursor: 'pointer' }}>
          <span className={styles.apptDot} style={{ background: value.color }} />
          {value.name}
        </button>
      ) : (
        <button ref={btnRef} className={styles.detailValuePlaceholder} onClick={() => setOpen(v => !v)}>
          <Icon name="solar:calendar-mark-linear" size={16} color="var(--neutral-200)" />
          Select Appointment Type
        </button>
      )}
      {open && createPortal(
        <>
          {/* Decorative click-catcher, and a sibling of the dropdown rather than
              its parent — an aria-hidden ancestor would hide the whole menu from
              assistive tech. Escape is the keyboard dismiss path. */}
          <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setOpen(false)} aria-hidden="true" />
          <div className={styles.apptDropdown} style={{ position: 'fixed', top: btnRef.current?.getBoundingClientRect().bottom + 4, left: btnRef.current?.getBoundingClientRect().left, zIndex: 9999 }}>
            <div className={styles.apptSearchWrap}>
              <Icon name="solar:magnifer-linear" size={14} color="var(--neutral-200)" />
              <input className={styles.apptSearchInput} placeholder="Search" aria-label="Search appointment types" value={search} onChange={e => setSearch(e.target.value)} autoFocus />
            </div>
            {filtered.map(t => (
              <button key={t.name} className={styles.apptItem} onClick={() => { onSelect(t); setOpen(false); }}>
                <span className={styles.apptDot} style={{ background: t.color }} />
                <div style={{ flex: 1 }}>
                  <div className={styles.apptItemName}>{t.name}</div>
                  <div className={styles.apptItemMeta}>{t.code} &bull; {t.mode}</div>
                </div>
                <div className={styles.apptItemDuration}>
                  <Icon name="solar:clock-circle-linear" size={12} color="var(--neutral-200)" />
                  {t.duration}
                </div>
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

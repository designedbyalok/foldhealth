import { useState, useMemo, useRef, useEffect } from 'react';
import { Icon } from '../Icon/Icon';
import { Avatar } from '../Avatar/Avatar';
import { getInitials } from './scheduleDrawerConstants';
import styles from './ScheduleDrawer.module.css';

export function PatientSearch({ patients, onSelect, inputId }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);

  const filtered = useMemo(() => {
    if (!query.trim()) return patients.slice(0, 8);
    const q = query.toLowerCase();
    return patients.filter(p => p.name?.toLowerCase().includes(q)).slice(0, 8);
  }, [patients, query]);

  return (
    <div ref={ref} className={styles.patientSearch}>
      <div className={styles.searchInputWrap}>
        <Icon name="solar:magnifer-linear" size={16} color="var(--neutral-200)" />
        <input
          id={inputId}
          className={styles.searchInput}
          placeholder="Search patient or prospect"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
        />
      </div>
      {open && (
        <div className={styles.searchDropdown}>
          {filtered.length > 0 ? filtered.map(p => (
            <button key={p.id} className={styles.searchItem} onClick={() => { onSelect(p); setOpen(false); setQuery(''); }}>
              <Avatar variant="patient" initials={getInitials(p.name).toUpperCase()} />
              <div>
                <div className={styles.searchItemName}>{p.name}</div>
                <div className={styles.searchItemMeta}>{p.gender?.[0] || 'M'} &bull; {p.dob || '03-29-1992'} ({p.age || '31'}Y)</div>
              </div>
            </button>
          )) : (
            <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--neutral-200)', textAlign: 'center' }}>No patients found</div>
          )}
        </div>
      )}
    </div>
  );
}

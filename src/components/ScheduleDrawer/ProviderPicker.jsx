import { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icon/Icon';
import { Avatar } from '../Avatar/Avatar';
import { getInitials, PROVIDER_OPTIONS, EMPTY_PROFILE_USERS } from './scheduleDrawerConstants';
import styles from './ScheduleDrawer.module.css';

export function ProviderPicker({ value, onSelect, profileUsers = EMPTY_PROFILE_USERS, onAddSecondary }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const btnRef = useRef(null);

  const allProviders = useMemo(() => {
    const dbUsers = profileUsers.map(u => ({ name: u.name, gender: 'Staff', dob: '', age: '', slots: 'Available' }));
    return dbUsers.length > 0 ? dbUsers : PROVIDER_OPTIONS;
  }, [profileUsers]);

  const filtered = allProviders.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ position: 'relative', flex: 1 }}>
      {value ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
          <button ref={btnRef} className={styles.detailValue} onClick={() => setOpen(v => !v)} style={{ cursor: 'pointer', flex: 1 }}>
            <Avatar variant="assignee" initials={getInitials(value).toUpperCase()} /> {value}
          </button>
          <button className={styles.addSecondaryBtn} onClick={onAddSecondary}><Icon name="solar:user-plus-linear" size={14} color="var(--primary-300)" /> Add Secondary</button>
        </div>
      ) : (
        <button ref={btnRef} className={styles.detailValuePlaceholder} onClick={() => setOpen(v => !v)}><Icon name="solar:user-linear" size={16} color="var(--neutral-200)" /> Select Provider</button>
      )}
      {open && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setOpen(false)}>
          <div className={styles.providerDropdown} style={{ position: 'fixed', top: btnRef.current?.getBoundingClientRect().bottom + 4, left: btnRef.current?.getBoundingClientRect().left, zIndex: 9999 }} onClick={e => e.stopPropagation()}>
            <div className={styles.apptSearchWrap}><Icon name="solar:magnifer-linear" size={14} color="var(--neutral-200)" /><input aria-label="Search providers" className={styles.apptSearchInput} placeholder="Search" value={search} onChange={e => setSearch(e.target.value)} autoFocus /></div>
            {filtered.map(p => (
              <button key={p.name} className={styles.providerItem} onClick={() => { onSelect(p.name); setOpen(false); }}>
                <Avatar variant="assignee" initials={getInitials(p.name).toUpperCase()} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--neutral-400)' }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--neutral-200)' }}>{p.gender}</div>
                </div>
                <span style={{ fontSize: 12, color: p.slots === 'Not Available' ? 'var(--neutral-200)' : 'var(--primary-300)' }}>{p.slots || ''}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

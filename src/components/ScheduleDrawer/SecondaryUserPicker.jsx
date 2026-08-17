import { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icon/Icon';
import { CheckboxTick } from '../CheckboxTick/CheckboxTick';
import { Avatar } from '../Avatar/Avatar';
import { getInitials, PROVIDER_OPTIONS } from './scheduleDrawerConstants';
import styles from './ScheduleDrawer.module.css';

export function SecondaryUserPicker({ selected, onChange, profileUsers, primary }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const btnRef = useRef(null);

  const allProviders = useMemo(() => {
    const dbUsers = profileUsers.map(u => u.name);
    const fallback = PROVIDER_OPTIONS.map(p => p.name);
    return (dbUsers.length > 0 ? dbUsers : fallback).filter(n => n !== primary);
  }, [profileUsers, primary]);

  const filtered = allProviders.filter(n => !search || n.toLowerCase().includes(search.toLowerCase()));
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const toggle = (name) => onChange(selectedSet.has(name) ? selected.filter(n => n !== name) : [...selected, name]);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, flex: 1 }}>
      {selected.map(name => (
        <span key={name} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--neutral-400)', background: 'var(--neutral-50)', padding: '2px 8px', borderRadius: 4, border: '0.5px solid var(--neutral-100)' }}>
          <Avatar variant="assignee" initials={getInitials(name).toUpperCase()} /> {name}
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={() => toggle(name)} aria-label={`Remove ${name}`}>
            <Icon name="solar:close-linear" size={10} color="var(--neutral-300)" />
          </button>
        </span>
      ))}
      <div style={{ position: 'relative' }}>
        <button ref={btnRef} className={styles.detailValuePlaceholder} onClick={() => setOpen(v => !v)} style={{ fontSize: 13 }}>
          <Icon name="solar:add-circle-linear" size={14} color="var(--primary-300)" /> {selected.length === 0 ? 'Select Secondary Users' : 'Add More'}
        </button>
        {open && createPortal(
          <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setOpen(false)}>
            <div className={styles.providerDropdown} style={{ position: 'fixed', top: btnRef.current?.getBoundingClientRect().bottom + 4, left: btnRef.current?.getBoundingClientRect().left, zIndex: 9999 }} onClick={e => e.stopPropagation()}>
              <div className={styles.apptSearchWrap}><Icon name="solar:magnifer-linear" size={14} color="var(--neutral-200)" /><input aria-label="Search users" className={styles.apptSearchInput} placeholder="Search" value={search} onChange={e => setSearch(e.target.value)} autoFocus /></div>
              {filtered.map(name => (
                <button key={name} type="button" role="menuitemcheckbox" aria-checked={selectedSet.has(name)} className={styles.providerItem} onClick={() => toggle(name)} style={{ background: selectedSet.has(name) ? 'var(--primary-25)' : undefined }}>
                  <CheckboxTick checked={selectedSet.has(name)} size={15} />
                  <Avatar variant="assignee" initials={getInitials(name).toUpperCase()} />
                  <span style={{ fontSize: 14, color: 'var(--neutral-400)' }}>{name}</span>
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}

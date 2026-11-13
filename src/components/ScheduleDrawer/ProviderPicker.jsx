import { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icon/Icon';
import { Avatar } from '../Avatar/Avatar';
import { Badge } from '../Badge/Badge';
import { Tooltip } from '../Tooltip/Tooltip';
import { getInitials, PROVIDER_OPTIONS, EMPTY_PROFILE_USERS } from './scheduleDrawerConstants';
import styles from './ScheduleDrawer.module.css';

const NOBODY_OUT = () => null;
const mdY = (v) => { const d = new Date(v); return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`; };

/**
 * @param {object}   props
 * @param {function} [props.outOfOffice] – (provider) => their Out of Office
 *   record at the picked date and time, or null. Those providers can't be
 *   picked: they're listed last, under Not Available, with an Out of Office
 *   badge (its tooltip gives the dates) and who covers them (`coveredBy`, names).
 */
export function ProviderPicker({ value, onSelect, profileUsers = EMPTY_PROFILE_USERS, onAddSecondary, outOfOffice = NOBODY_OUT }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const btnRef = useRef(null);

  const allProviders = useMemo(() => {
    const dbUsers = profileUsers.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role || 'Staff', dob: '', age: '', slots: 'Available' }));
    return dbUsers.length > 0 ? dbUsers : PROVIDER_OPTIONS;
  }, [profileUsers]);

  const matching = allProviders.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));
  const away = matching.filter(p => outOfOffice(p));
  // Searching for someone who's out puts whoever covers them on top, under
  // Suggested, with who they're covering for (even if their own name
  // doesn't match the search).
  const covering = new Map(); // covering provider name → names they cover
  if (search) {
    away.forEach(p => (outOfOffice(p).coveredBy || []).forEach((n) => {
      covering.set(n, [...(covering.get(n) || []), p.name]);
    }));
  }
  const suggested = allProviders.filter(p => covering.has(p.name) && !outOfOffice(p));
  const available = matching.filter(p => !outOfOffice(p) && !covering.has(p.name));

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
            {suggested.length > 0 && <div className={styles.providerGroup}>Suggested</div>}
            {suggested.map(p => (
              <button key={`s-${p.id || p.name}`} className={styles.providerItem} onClick={() => { onSelect(p.name, p); setOpen(false); }}>
                <Avatar variant="assignee" size="M" initials={getInitials(p.name).toUpperCase()} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--font-base)', fontWeight: 500, color: 'var(--neutral-400)' }}>{p.name}</div>
                  <div style={{ fontSize: 'var(--font-sm)', color: 'var(--neutral-200)' }}>{p.role || p.gender}</div>
                  <div className={styles.providerCovering}>Covering for {covering.get(p.name).join(', ')}</div>
                </div>
                <span style={{ fontSize: 'var(--font-sm)', color: p.slots === 'Not Available' ? 'var(--neutral-200)' : 'var(--primary-300)' }}>{p.slots || ''}</span>
              </button>
            ))}
            {suggested.length > 0 && available.length > 0 && <div className={styles.providerGroup}>All Providers</div>}
            {available.map(p => (
              <button key={p.id || p.name} className={styles.providerItem} onClick={() => { onSelect(p.name, p); setOpen(false); }}>
                <Avatar variant="assignee" size="M" initials={getInitials(p.name).toUpperCase()} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 'var(--font-base)', fontWeight: 500, color: 'var(--neutral-400)' }}>{p.name}</div>
                  <div style={{ fontSize: 'var(--font-sm)', color: 'var(--neutral-200)' }}>{p.role || p.gender}</div>
                </div>
                <span style={{ fontSize: 'var(--font-sm)', color: p.slots === 'Not Available' ? 'var(--neutral-200)' : 'var(--primary-300)' }}>{p.slots || ''}</span>
              </button>
            ))}
            {away.length > 0 && <div className={styles.providerGroup}>Not Available</div>}
            {away.map(p => {
              const out = outOfOffice(p);
              return (
                <div key={p.id || p.name} className={`${styles.providerItem} ${styles.providerItemDisabled}`} aria-disabled="true">
                  <Avatar variant="assignee" size="M" initials={getInitials(p.name).toUpperCase()} userName={p.name} userId={p.id} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className={styles.providerNameRow}>
                      <span className={styles.providerMutedName}>{p.name}</span>
                      <Tooltip label={`Out of office ${mdY(out.startAt)} - ${mdY(out.endAt)}`} placement="top" align="right">
                        <Badge tone="magenta" size="sm" label="Out of Office" />
                      </Tooltip>
                    </div>
                    <div className={styles.providerMutedSub}>{p.role || p.gender}</div>
                    <div className={styles.providerCoveredBy}>
                      {out.coveredBy?.length ? `Covered by: ${out.coveredBy.join(', ')}` : 'No covering provider'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icon/Icon';
import { Button } from '../Button/Button';
import { Drawer } from '../Drawer/Drawer';
import { Avatar } from '../Avatar/Avatar';
import { ActionButton } from '../ActionButton/ActionButton';
import { Switch } from '../Switch/Switch';
import { Select } from '../Select/Select';
import { useAppStore } from '../../store/useAppStore';
import { supabase } from '../../lib/supabase';
import styles from './ScheduleDrawer.module.css';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const FALLBACK_APPOINTMENT_TYPES = [
  { name: 'Annual Wellness Visit', code: 'AWV', mode: 'In-person', duration: '60 min', color: '#D9A50B' },
  // Program-related appointment types — one per care program. When booked for
  // a patient they surface under "Program related appointments" in that
  // program's Appointment step (matched by `programCode`).
  { name: 'SNP Care Program Visit', code: 'SNP', mode: 'In-person', duration: '45 min', color: 'var(--primary-300)' },
  { name: 'TOC Inpatient Visit', code: 'TOC IP', mode: 'In-person', duration: '45 min', color: 'var(--status-info)' },
  { name: 'TOC Emergency Dept. Visit', code: 'TOC ED', mode: 'In-person', duration: '45 min', color: 'var(--status-error)' },
  { name: 'High Utilizers Visit', code: 'HIU', mode: 'In-person/Virtual', duration: '30 min', color: 'var(--secondary-300)' },
  { name: 'Disease Management Visit', code: 'DM', mode: 'In-person/Virtual', duration: '30 min', color: 'var(--status-success)' },
  { name: 'Chronic Care Management Visit', code: 'CCM', mode: 'Virtual', duration: '20 min', color: 'var(--status-warning)' },
  { name: 'Transitional Care Visit', code: 'TCM', mode: 'In-person', duration: '30 min', color: 'var(--accent-cyan)' },
  { name: 'Follow-up Appointment', code: 'Routine', mode: 'In-person/Virtual', duration: '15-30 min', color: '#8C5AE2' },
  { name: 'Specialty Consultation', code: 'Routine', mode: 'In-person', duration: '45 min', color: '#009B53' },
  { name: 'Telehealth Consultation', code: 'Routine', mode: 'Virtual', duration: '30 min', color: '#145ECC' },
  { name: 'Lab Results Discussion', code: 'Routine', mode: 'Virtual', duration: '15 min', color: '#009B53' },
];

const MODE_OPTIONS = [
  { label: 'At Clinic', icon: 'solar:buildings-linear' },
  { label: 'Virtual/Telehealth', icon: 'solar:monitor-linear' },
];
const LOCATION_OPTIONS = ['Fold Health, New York', '7 Hills Department', '68th Street, New York', '168th Street, New York'];
const PROVIDER_OPTIONS = [
  { name: 'Ralph Kessler', gender: 'Male', dob: '03-29-1992', age: 31, slots: '6 Slots Available' },
  { name: 'Robert Langdon', gender: 'Male', dob: '11-20-1986', age: 30, slots: '3 Slots Available' },
  { name: 'Cameron Haley', gender: 'Male', dob: '11-23-1986', age: 35, slots: '1 Slots Available' },
  { name: 'Mrs. Andrew Mayer IV', gender: 'Male', dob: '11-25-1986', age: 30, slots: 'Not Available' },
  { name: 'Gayle Jacobs', gender: 'Male', dob: '12-02-1986', age: 31, slots: '4 Slots Available' },
];
// Generate 30-min time slots from 6:00 AM to 7:30 PM
const TIME_SLOTS = (() => {
  const slots = [];
  for (let h = 6; h < 20; h++) {
    for (const m of [0, 30]) {
      const ampm = h >= 12 ? 'pm' : 'am';
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      slots.push(`${h12}:${String(m).padStart(2, '0')} ${ampm}`);
    }
  }
  return slots;
})();

function getInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] || '') + (parts[parts.length - 1]?.[0] || '');
}

/* ── Patient Search Dropdown ── */
function PatientSearch({ patients, onSelect }) {
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

/* ── Appointment Type Picker ── */
function AppointmentTypePicker({ value, onSelect, appointmentTypes }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const btnRef = useRef(null);

  const filtered = appointmentTypes.filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()));

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
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setOpen(false)}>
          <div className={styles.apptDropdown} style={{ position: 'fixed', top: btnRef.current?.getBoundingClientRect().bottom + 4, left: btnRef.current?.getBoundingClientRect().left, zIndex: 9999 }} onClick={e => e.stopPropagation()}>
            <div className={styles.apptSearchWrap}>
              <Icon name="solar:magnifer-linear" size={14} color="var(--neutral-200)" />
              <input className={styles.apptSearchInput} placeholder="Search" value={search} onChange={e => setSearch(e.target.value)} autoFocus />
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
        </div>,
        document.body
      )}
    </div>
  );
}

/* ── Generic Detail Dropdown ── */
function DetailDropdown({ value, placeholder, icon, options, onSelect, renderItem }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);

  // Resolve the icon based on the selected value's option (for mode icons, etc.)
  const resolvedIcon = (() => {
    if (!value) return icon;
    const match = options.find(o => o.label === value);
    return match?.icon || icon;
  })();

  if (value) {
    return (
      <div style={{ position: 'relative' }}>
        <button ref={btnRef} className={styles.detailValue} onClick={() => setOpen(v => !v)} style={{ cursor: 'pointer' }}>
          <Icon name={resolvedIcon} size={16} color="var(--neutral-300)" /> {value}
        </button>
        {open && createPortal(
          <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setOpen(false)}>
            <div className={styles.simpleDropdown} style={{ position: 'fixed', top: btnRef.current?.getBoundingClientRect().bottom + 4, left: btnRef.current?.getBoundingClientRect().left, zIndex: 9999 }} onClick={e => e.stopPropagation()}>
              {options.map(opt => (
                <button key={opt.label} className={styles.simpleDropItem} onClick={() => { onSelect(opt.label); setOpen(false); }}>
                  {renderItem ? renderItem(opt) : opt.label}
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }
  return (
    <div style={{ position: 'relative' }}>
      <button ref={btnRef} className={styles.detailValuePlaceholder} onClick={() => setOpen(v => !v)}><Icon name={icon} size={16} color="var(--neutral-200)" /> {placeholder}</button>
      {open && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setOpen(false)}>
          <div className={styles.simpleDropdown} style={{ position: 'fixed', top: btnRef.current?.getBoundingClientRect().bottom + 4, left: btnRef.current?.getBoundingClientRect().left, zIndex: 9999 }} onClick={e => e.stopPropagation()}>
            {options.map(opt => (
              <button key={opt.label} className={styles.simpleDropItem} onClick={() => { onSelect(opt.label); setOpen(false); }}>
                {renderItem ? renderItem(opt) : opt.label}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/* ── Provider Picker (searchable with avatar + slots) ── */
function ProviderPicker({ value, onSelect, profileUsers = [], onAddSecondary }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const btnRef = useRef(null);

  // Merge DB users with fallback providers
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
            <div className={styles.apptSearchWrap}><Icon name="solar:magnifer-linear" size={14} color="var(--neutral-200)" /><input className={styles.apptSearchInput} placeholder="Search" value={search} onChange={e => setSearch(e.target.value)} autoFocus /></div>
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

/* ── Secondary User Multi-Picker ── */
function SecondaryUserPicker({ selected, onChange, profileUsers, primary }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const btnRef = useRef(null);

  const allProviders = useMemo(() => {
    const dbUsers = profileUsers.map(u => u.name);
    const fallback = PROVIDER_OPTIONS.map(p => p.name);
    return (dbUsers.length > 0 ? dbUsers : fallback).filter(n => n !== primary);
  }, [profileUsers, primary]);

  const filtered = allProviders.filter(n => !search || n.toLowerCase().includes(search.toLowerCase()));
  const toggle = (name) => onChange(selected.includes(name) ? selected.filter(n => n !== name) : [...selected, name]);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, flex: 1 }}>
      {selected.map(name => (
        <span key={name} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--neutral-400)', background: 'var(--neutral-50)', padding: '2px 8px', borderRadius: 4, border: '0.5px solid var(--neutral-100)' }}>
          <Avatar variant="assignee" initials={getInitials(name).toUpperCase()} /> {name}
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={() => toggle(name)}>
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
              <div className={styles.apptSearchWrap}><Icon name="solar:magnifer-linear" size={14} color="var(--neutral-200)" /><input className={styles.apptSearchInput} placeholder="Search" value={search} onChange={e => setSearch(e.target.value)} autoFocus /></div>
              {filtered.map(name => (
                <button key={name} className={styles.providerItem} onClick={() => toggle(name)} style={{ background: selected.includes(name) ? 'var(--primary-25)' : undefined }}>
                  <input type="checkbox" checked={selected.includes(name)} readOnly style={{ accentColor: 'var(--primary-300)', width: 15, height: 15 }} />
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

/* ── Date Picker (simple calendar) ── */
function DatePicker({ value, onSelect }) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());
  const btnRef = useRef(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  return (
    <div style={{ position: 'relative' }}>
      {value ? (
        <button ref={btnRef} className={styles.detailValue} onClick={() => setOpen(v => !v)} style={{ cursor: 'pointer' }}><Icon name="solar:calendar-linear" size={16} color="var(--neutral-300)" /> {value}</button>
      ) : (
        <button ref={btnRef} className={styles.detailValuePlaceholder} onClick={() => setOpen(v => !v)}><Icon name="solar:calendar-linear" size={16} color="var(--neutral-200)" /> Select Date</button>
      )}
      {open && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setOpen(false)}>
          <div className={styles.calendarDropdown} style={{ position: 'fixed', top: btnRef.current?.getBoundingClientRect().bottom + 4, left: btnRef.current?.getBoundingClientRect().left, zIndex: 9999 }} onClick={e => e.stopPropagation()}>
            <div className={styles.calendarHeader}>
              <ActionButton icon="solar:alt-arrow-left-linear" size="S" onClick={() => setViewDate(new Date(year, month - 1, 1))} />
              <span className={styles.calendarTitle}>{MONTH_NAMES[month]} {year}</span>
              <ActionButton icon="solar:alt-arrow-right-linear" size="S" onClick={() => setViewDate(new Date(year, month + 1, 1))} />
            </div>
            <div className={styles.calendarGrid}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} className={styles.calendarDayLabel}>{d}</div>)}
              {days.map((d, i) => d ? (
                <button key={i} className={styles.calendarDay} onClick={() => { onSelect(`${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}-${year}`); setOpen(false); }}>{d}</button>
              ) : <div key={i} />)}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

const APPOINTMENT_STATUSES = ['Booked', 'Cancelled', 'No Show', 'Checked In'];

/* ── Main Drawer ── */
// Inline SVG for the Add Staff Instruction icon
const StaffInstructionIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12.8278 3.37739L12.4933 3.74903L12.8278 3.37739ZM16.1268 6.34647L15.7923 6.71812L16.1268 6.34647ZM18.0453 8.4611L17.5886 8.66451L18.0453 8.4611ZM2.6433 17.3564L2.99686 17.0028L2.6433 17.3564ZM17.3573 17.3564L17.0038 17.0028L17.3573 17.3564ZM4.58366 13.2493C4.30752 13.2493 4.08366 13.4732 4.08366 13.7493C4.08366 14.0255 4.30752 14.2493 4.58366 14.2493V13.2493ZM7.91699 14.2493C8.19313 14.2493 8.41699 14.0255 8.41699 13.7493C8.41699 13.4732 8.19313 13.2493 7.91699 13.2493V14.2493ZM5.75033 15.416C5.75033 15.6922 5.97418 15.916 6.25033 15.916C6.52647 15.916 6.75033 15.6922 6.75033 15.416H5.75033ZM6.75033 12.0827C6.75033 11.8065 6.52647 11.5827 6.25033 11.5827C5.97418 11.5827 5.75033 11.8065 5.75033 12.0827H6.75033ZM11.667 18.3327V17.8327H8.33366V18.8327H11.667V18.3327ZM1.66699 11.666H2.16699V8.33268H1.16699V11.666H1.66699ZM18.3337 11.3018H17.8337V11.666H18.8337V11.3018H18.3337ZM12.4933 3.74903L15.7923 6.71812L16.4612 5.97482L13.1623 3.00574L12.4933 3.74903ZM18.8337 11.3018C18.8337 9.88376 18.8438 9.02486 18.5021 8.25768L17.5886 8.66452C17.8236 9.19215 17.8337 9.79543 17.8337 11.3018H18.8337ZM15.7923 6.71812C16.9119 7.7258 17.3536 8.13688 17.5886 8.66451L18.5021 8.25768C18.1604 7.49049 17.5152 6.92342 16.4612 5.97482L15.7923 6.71812ZM8.35849 2.16602C9.66718 2.16602 10.1922 2.17373 10.6622 2.35409L11.0205 1.42047C10.3373 1.1583 9.59146 1.16602 8.35849 1.16602V2.16602ZM13.1623 3.00574C12.2503 2.18497 11.7036 1.68262 11.0205 1.42047L10.6622 2.35409C11.1323 2.53447 11.5255 2.87802 12.4933 3.74903L13.1623 3.00574ZM8.33366 17.8327C6.74818 17.8327 5.60936 17.8316 4.74271 17.7151C3.89044 17.6005 3.37663 17.3826 2.99686 17.0028L2.28975 17.7099C2.88629 18.3065 3.6463 18.5767 4.60946 18.7062C5.55824 18.8337 6.77644 18.8327 8.33366 18.8327V17.8327ZM1.16699 11.666C1.16699 13.2232 1.16593 14.4414 1.29349 15.3902C1.42298 16.3534 1.69321 17.1134 2.28975 17.7099L2.99686 17.0028C2.61709 16.623 2.39916 16.1092 2.28457 15.257C2.16805 14.3903 2.16699 13.2515 2.16699 11.666H1.16699ZM11.667 18.8327C13.2242 18.8327 14.4424 18.8337 15.3912 18.7062C16.3543 18.5767 17.1144 18.3065 17.7109 17.7099L17.0038 17.0028C16.624 17.3826 16.1102 17.6005 15.2579 17.7151C14.3913 17.8316 13.2525 17.8327 11.667 17.8327V18.8327ZM18.8337 11.666C18.8337 13.2515 18.8326 14.3903 17.7161 15.257C17.6015 16.1092 17.3836 16.623 17.0038 17.0028L17.7109 17.7099C18.3074 17.1134 18.5777 16.3534 18.7072 15.3902C18.8347 14.4414 18.8337 13.2232 18.8337 11.666H18.8337ZM2.16699 8.33268C2.16699 6.7472 2.16805 5.60839 2.28457 4.74173C2.39916 3.88946 2.61709 3.37565 2.99686 2.99588L2.28975 2.28877C1.69321 2.88531 1.42298 3.64533 1.29349 4.60849C1.16593 5.55726 1.16699 6.77547 1.16699 8.33268H2.16699ZM8.35849 1.16602C6.79295 1.16602 5.5687 1.16496 4.61597 1.29247C3.64923 1.42186 2.88668 1.69184 2.28975 2.28877L2.99686 2.99588C3.37624 2.6165 3.89166 2.39833 4.74862 2.28364C5.61959 2.16707 6.76477 2.16602 8.35849 2.16602V1.16602ZM10.3337 2.08268V4.16602H11.3337V2.08268H10.3337ZM15.0003 8.83268H17.9837V7.83268H15.0003V8.83268ZM10.3337 4.16602C10.3337 5.13397 10.3326 5.91024 10.4144 6.51862C10.4981 7.14139 10.6768 7.66256 11.0903 8.07604L11.7974 7.36893C11.6007 7.17222 11.4743 6.89725 11.4055 6.38537C11.3347 5.85911 11.3337 5.16224 11.3337 4.16602H10.3337ZM15.0003 7.83268C14.0041 7.83268 13.3072 7.83162 12.781 7.76087C12.2691 7.69205 11.9941 7.56565 11.7974 7.36893L11.0903 8.07604C11.5038 8.48952 12.025 8.66822 12.6477 8.75195C13.2561 8.83374 14.0324 8.83268 15.0003 8.83268V7.83268ZM4.58366 14.2493H7.91699V13.2493H4.58366V14.2493ZM6.75033 15.416V13.7493H5.75033V15.416H6.75033ZM6.75033 13.7493V12.0827H5.75033V13.7493H6.75033Z" fill="currentColor"/>
  </svg>
);

export function ScheduleDrawer({ onClose, selectedSlot, onSave, existingAppointment, timezoneLabel = 'GMT', initialPatientId }) {
  const isViewMode = !!existingAppointment;
  const patients = useAppStore(s => s.patients);
  const fetchPatients = useAppStore(s => s.fetchPatients);
  const showToast = useAppStore(s => s.showToast);
  const createAppointment = useAppStore(s => s.createAppointment);
  const updateAppointment = useAppStore(s => s.updateAppointment);
  const storeApptTypes = useAppStore(s => s.appointmentTypes);
  const fetchAppointmentTypes = useAppStore(s => s.fetchAppointmentTypes);

  // Use DB types, fall back to hardcoded
  const appointmentTypes = storeApptTypes.length > 0 ? storeApptTypes : FALLBACK_APPOINTMENT_TYPES;

  // Ensure patients and appointment types are loaded — only fetch when
  // empty. Unconditionally calling fetchPatients() flips patientsLoading
  // true in the store, which unmounts the worklist behind the drawer and
  // shows its skeleton (looks like the worklist "reloads" every time the
  // Schedule button is clicked). Skip when we already have the data.
  useEffect(() => {
    if (fetchPatients && patients.length === 0) fetchPatients();
    if (fetchAppointmentTypes && storeApptTypes.length === 0) fetchAppointmentTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pre-fill patient when initialPatientId is provided
  useEffect(() => {
    if (!initialPatientId || !patients.length) return;
    const match = patients.find(p => p.id === initialPatientId);
    if (match) setSelectedPatient(match);
  }, [initialPatientId, patients]);

  // Derive initial date/time from selectedSlot (Temporal.ZonedDateTime)
  const initialDate = (() => {
    if (!selectedSlot?.month) return '';
    const m = String(selectedSlot.month).padStart(2, '0');
    const d = String(selectedSlot.day).padStart(2, '0');
    return `${m}-${d}-${selectedSlot.year}`;
  })();

  const initialTime = (() => {
    if (!selectedSlot?.hour && selectedSlot?.hour !== 0) return '';
    const h = selectedSlot.hour;
    const min = String(selectedSlot.minute || 0).padStart(2, '0');
    const ampm = h >= 12 ? 'pm' : 'am';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${min} ${ampm}`;
  })();

  const [selectedPatient, setSelectedPatient] = useState(null);
  const [reasonForVisit, setReasonForVisit] = useState('');
  const [appointmentType, setAppointmentType] = useState(null);
  const [mode, setMode] = useState('');
  const [location, setLocation] = useState('');
  const [provider, setProvider] = useState('');
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [recurring, setRecurring] = useState(false);
  const [recurFrequency, setRecurFrequency] = useState(1);
  const [recurUnit, setRecurUnit] = useState('Week(s)');
  const [recurDays, setRecurDays] = useState([]);
  const [recurEndDate, setRecurEndDate] = useState('');
  const [recurConfirmed, setRecurConfirmed] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showPickTime, setShowPickTime] = useState(false);
  const [customTime, setCustomTime] = useState('');
  const timeBtnRef = useRef(null);
  const [requireRsvp, setRequireRsvp] = useState(false);
  const [showSecondary, setShowSecondary] = useState(false);
  const [secondaryUsers, setSecondaryUsers] = useState([]);
  const [profileUsers, setProfileUsers] = useState([]);
  const [memberInstruction, setMemberInstruction] = useState('');
  const [showStaffInstructions, setShowStaffInstructions] = useState(false);
  const [staffInstruction, setStaffInstruction] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const rawStatus = existingAppointment?.status;
  const [apptStatus, setApptStatus] = useState(rawStatus === 'Scheduled' ? 'Booked' : (rawStatus || 'Booked'));
  const [editingInstruction, setEditingInstruction] = useState(false);
  const [instructionDraft, setInstructionDraft] = useState(existingAppointment?.member_instruction || '');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef(null);
  const deleteAppointment = useAppStore(s => s.deleteAppointment);
  const [showViewStaffInstructions, setShowViewStaffInstructions] = useState(!!existingAppointment?.staff_instruction);
  const [editingStaffInstruction, setEditingStaffInstruction] = useState(false);
  const [staffInstructionDraft, setStaffInstructionDraft] = useState(existingAppointment?.staff_instruction || '');

  // Fetch staff users from profiles DB
  useEffect(() => {
    supabase.from('profiles').select('id, full_name, first_name, last_name, email, status').order('full_name').then(({ data }) => {
      if (data) setProfileUsers(data.filter(u => u.status === 'Active').map(u => ({
        name: u.full_name?.trim() || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
        email: u.email,
      })));
    });
  }, []);

  // Auto-fill mode and location when appointment type is selected
  useEffect(() => {
    if (appointmentType) {
      setMode(appointmentType.mode === 'Virtual' ? 'Virtual' : 'At Clinic');
      setLocation(LOCATION_OPTIONS[0]);
    }
  }, [appointmentType]);

  const canSchedule = selectedPatient && appointmentType;

  const handleSchedule = async () => {
    // Compute end time (+30 min)
    const computeEndTime = (t) => {
      const match = t.match(/(\d+):(\d+)\s*(am|pm)/i);
      if (!match) return t;
      const [, h, m, p] = match;
      const mins = (parseInt(m) || 0) + 30;
      return mins >= 60
        ? `${(parseInt(h) || 0) + 1}:${String(mins - 60).padStart(2, '0')} ${p}`
        : `${h}:${String(mins).padStart(2, '0')} ${p}`;
    };

    // Derive calendar_id from appointment type color
    const colorToCalId = { '#D9A50B': 'awv', '#8C5AE2': 'followup', '#009B53': 'specialty', '#145ECC': 'telehealth' };
    const calId = appointmentType ? (colorToCalId[appointmentType.color] || 'followup') : 'followup';

    const row = {
      patient_id: selectedPatient?.id || null,
      patient_name: selectedPatient?.name || '',
      appointment_type_id: appointmentType?.id ?? null,
      appointment_type_name: appointmentType?.name || '',
      mode,
      location,
      primary_user: provider,
      secondary_users: secondaryUsers,
      date,
      time_start: time,
      time_end: time ? computeEndTime(time) : '',
      reason_for_visit: reasonForVisit,
      member_instruction: memberInstruction,
      staff_instruction: staffInstruction,
      require_rsvp: requireRsvp,
      recurring,
      recurring_config: recurring ? JSON.stringify({ frequency: recurFrequency, unit: recurUnit, days: recurDays, endDate: recurEndDate }) : null,
      status: 'Scheduled',
      calendar_id: calId,
    };

    const result = await createAppointment(row);
    if (result) {
      // Pass the created row so non-store surfaces (e.g. a program's
      // appointments list) can mirror it into their own view.
      if (onSave) onSave(row);
      setBookingSuccess(true);
      setTimeout(() => onClose(), 2000);
    } else {
      showToast('Failed to save appointment');
    }
  };

  const handleStatusChange = async (newStatus) => {
    setApptStatus(newStatus);
    if (existingAppointment?.id) {
      await updateAppointment(existingAppointment.id, { status: newStatus });
      if (onSave) onSave();
    }
  };

  const handleSaveInstruction = async () => {
    if (existingAppointment?.id) {
      await updateAppointment(existingAppointment.id, { member_instruction: instructionDraft });
      if (onSave) onSave();
    }
    setEditingInstruction(false);
  };

  const handleSaveStaffInstruction = async () => {
    if (existingAppointment?.id) {
      await updateAppointment(existingAppointment.id, { staff_instruction: staffInstructionDraft });
      if (onSave) onSave();
    }
    setEditingStaffInstruction(false);
  };

  const handleDeleteAppointment = async () => {
    if (existingAppointment?.id) {
      await deleteAppointment(existingAppointment.id);
      if (onSave) onSave();
      showToast('Appointment deleted');
      onClose();
    }
  };

  // Determine if appointment is in the past (read-only)
  const isPastAppointment = (() => {
    if (!existingAppointment?.date) return false;
    const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
    const [mo, dd, yyyy] = existingAppointment.date.split('-');
    const apptDate = `${yyyy}-${mo}-${dd}`;
    return apptDate < today;
  })();


  // ── View Mode: Appointment Details ──
  if (isViewMode) {
    const ea = existingAppointment;
    // Resolve appointment type color from DB types
    const matchedType = appointmentTypes.find(t => t.name === ea.appointment_type_name);
    const apptTypeColor = matchedType?.color || ea.appointment_type_name?.includes('Wellness') ? '#D9A50B' : '#8C5AE2';
    const apptTypeForPicker = appointmentType || (ea.appointment_type_name ? { name: ea.appointment_type_name, color: matchedType?.color || apptTypeColor, id: matchedType?.id } : null);

    return (
      <Drawer title="Appointment Details" onClose={onClose} bodyClassName={styles.drawerBody}>
        <div className={styles.content} style={{ gap: 16 }}>
          {/* Status bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--neutral-50)', borderRadius: 8, padding: 8 }}>
            <div style={{ flex: 1 }}>
              <Select
                style={{ width: 120 }}
                options={APPOINTMENT_STATUSES.map(s => ({ value: s, label: s }))}
                value={apptStatus}
                onChange={handleStatusChange}
                disabled={isPastAppointment}
              />
            </div>
            <ActionButton icon="solar:paperclip-linear" size="L" tooltip="Attach" />
            <span style={{ width: 0.5, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />
            {!showViewStaffInstructions && (
              <ActionButton size="L" tooltip="Add Staff Instructions" onClick={() => setShowViewStaffInstructions(true)}>
                <StaffInstructionIcon />
              </ActionButton>
            )}
            {!showViewStaffInstructions && <span style={{ width: 0.5, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />}
            <div style={{ position: 'relative' }} ref={moreMenuRef}>
              <ActionButton icon="solar:menu-dots-bold" size="L" tooltip="More" onClick={() => setShowMoreMenu(v => !v)} />
              {showMoreMenu && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setShowMoreMenu(false)} />
                  <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 9999, background: 'var(--neutral-0)', border: '0.5px solid var(--neutral-100)', borderRadius: 8, boxShadow: '0 4px 24px -4px rgba(0,0,0,0.12)', padding: 8, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <button onClick={() => { showToast('Booking link copied!'); setShowMoreMenu(false); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 4, border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--neutral-400)', fontFamily: 'Inter, sans-serif', width: '100%', textAlign: 'left' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--neutral-50)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                      <Icon name="solar:link-linear" size={16} color="var(--neutral-300)" /> Send Booking Link
                    </button>
                    <button onClick={() => { setShowMoreMenu(false); handleDeleteAppointment(); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 4, border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--status-error, #D72825)', fontFamily: 'Inter, sans-serif', width: '100%', textAlign: 'left' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--neutral-50)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                      <Icon name="solar:trash-bin-minimalistic-linear" size={16} color="var(--status-error, #D72825)" /> Delete Appointment
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Patient Details */}
          <div className={styles.section}>
            <label className={styles.sectionLabel}>Patient Details</label>
            <div className={styles.patientCard}>
              <div className={styles.patientCardHeader}>
                <Avatar variant="patient" initials={getInitials(ea.patient_name).toUpperCase()} />
                <div className={styles.patientCardInfo}>
                  <div className={styles.patientCardName}>{ea.patient_name || 'Unknown'}</div>
                  <div className={styles.patientCardMeta}>
                    <span style={{ color: '#D72825', fontWeight: 500 }}>RAF Score: 3.5</span>{' '}
                    <span style={{ color: '#009B53', display: 'inline-flex', alignItems: 'center', gap: 2 }}>+0.5 <Icon name="solar:arrow-up-linear" size={10} color="#009B53" /></span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <ActionButton icon="solar:phone-linear" size="L" tooltip="Call" />
                  <span style={{ width: 0.5, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />
                  <ActionButton icon="solar:chat-round-line-linear" size="L" tooltip="Chat" />
                  <span style={{ width: 0.5, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />
                  <ActionButton icon="solar:menu-dots-bold" size="L" tooltip="More" />
                </div>
              </div>
              {ea.reason_for_visit && (
                <div className={styles.reasonField} style={{ pointerEvents: 'none' }}>
                  <label className={styles.reasonLabel}>Reason for Visit</label>
                  <div className={styles.reasonInput} style={{ background: 'var(--neutral-50)', minHeight: 32 }}>{ea.reason_for_visit}</div>
                </div>
              )}
              <div className={styles.patientInfoGrid}>
                <div className={styles.patientInfoRow}>
                  <span className={styles.patientInfoLabel} style={{ fontSize: 14, fontWeight: 500 }}>Patient Location</span>
                  <span className={styles.patientInfoValue} style={{ fontSize: 14 }}>{ea.location || 'New York'}</span>
                </div>
                <div className={styles.patientInfoRow}>
                  <span className={styles.patientInfoLabel} style={{ fontSize: 14, fontWeight: 500 }}>Last Appointment</span>
                  <span className={styles.patientInfoValue} style={{ fontSize: 14 }}>07-26-2023 with Katherine Moss <button className={styles.viewDetailsLink}>View Details</button></span>
                </div>
              </div>
            </div>
          </div>

          {/* Appointment Details — editable pickers (except patient); read-only for past */}
          <div className={styles.section} style={isPastAppointment ? { pointerEvents: 'none', opacity: 0.7 } : undefined}>
            <label className={styles.sectionLabel}>Appointment Details {isPastAppointment && <span style={{ fontSize: 11, color: 'var(--neutral-200)', fontWeight: 400 }}>(Past — read only)</span>}</label>
            <div className={styles.detailsCard}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Appointment Type</span>
                <AppointmentTypePicker value={apptTypeForPicker} onSelect={(v) => { setAppointmentType(v); if (v && ea.id) updateAppointment(ea.id, { appointment_type_name: v.name, appointment_type_id: v.id || null }); }} appointmentTypes={appointmentTypes} />
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Mode of Appointment</span>
                <DetailDropdown value={mode || ea.mode} placeholder="Select Mode" icon={mode === 'Virtual' || ea.mode === 'Virtual' ? 'solar:monitor-linear' : 'solar:buildings-linear'} options={MODE_OPTIONS.map(m => ({ label: m.label, icon: m.icon }))} onSelect={v => { setMode(v); if (ea.id) updateAppointment(ea.id, { mode: v }); }} renderItem={(opt) => <><Icon name={opt.icon} size={16} color="var(--neutral-300)" /> {opt.label}</>} />
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Location</span>
                <DetailDropdown value={location || ea.location} placeholder="Select Location" icon="solar:map-point-linear" options={LOCATION_OPTIONS.map(l => ({ label: l }))} onSelect={v => { setLocation(v); if (ea.id) updateAppointment(ea.id, { location: v }); }} />
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Primary User</span>
                <ProviderPicker value={provider || ea.primary_user} onSelect={v => { setProvider(v); if (ea.id) updateAppointment(ea.id, { primary_user: v }); }} profileUsers={profileUsers} onAddSecondary={() => setShowSecondary(true)} />
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Date</span>
                <DatePicker value={date || ea.date} onSelect={v => { setDate(v); if (ea.id) updateAppointment(ea.id, { date: v }); }} />
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Time</span>
                <span className={styles.detailValue}><Icon name="solar:clock-circle-linear" size={16} color="var(--neutral-300)" /> {ea.time_start || '—'} - {ea.time_end || '—'} ({timezoneLabel})</span>
              </div>
            </div>
          </div>

          {/* Member Instruction — rich text editor with save/discard */}
          <div className={styles.section}>
            <label className={styles.sectionLabel}>Member Instruction</label>
            {editingInstruction ? (
              <div className={styles.instructionEditor}>
                <div
                  className={styles.instructionEditable}
                  contentEditable
                  suppressContentEditableWarning
                  dangerouslySetInnerHTML={{ __html: instructionDraft }}
                  onInput={e => setInstructionDraft(e.currentTarget.innerHTML)}
                />
                <div className={styles.instructionToolbar}>
                  <ActionButton icon="solar:paperclip-linear" size="S" tooltip="Attach" />
                  <span className={styles.toolbarDivider} />
                  <ActionButton icon="solar:text-bold-linear" size="S" tooltip="Bold" onClick={() => document.execCommand('bold')} />
                  <ActionButton icon="solar:text-italic-linear" size="S" tooltip="Italic" onClick={() => document.execCommand('italic')} />
                  <ActionButton icon="solar:text-underline-linear" size="S" tooltip="Underline" onClick={() => document.execCommand('underline')} />
                  <span className={styles.toolbarDivider} />
                  <ActionButton icon="solar:text-field-linear" size="S" tooltip="Heading" onClick={() => document.execCommand('formatBlock', false, 'h3')} />
                  <ActionButton icon="solar:list-linear" size="S" tooltip="List" onClick={() => document.execCommand('insertUnorderedList')} />
                  <div style={{ flex: 1 }} />
                  <ActionButton icon="solar:close-linear" size="S" tooltip="Discard" state="error" onClick={() => { setInstructionDraft(ea.member_instruction || ''); setEditingInstruction(false); }} />
                  <ActionButton icon="solar:check-read-linear" size="S" tooltip="Save" onClick={handleSaveInstruction} />
                </div>
              </div>
            ) : (
              <div
                onClick={() => setEditingInstruction(true)}
                style={{ border: '0.5px solid var(--neutral-150)', borderRadius: 4, padding: 8, fontSize: 14, color: ea.member_instruction ? 'var(--neutral-400)' : 'var(--neutral-200)', fontFamily: 'Inter, sans-serif', lineHeight: 1.4, background: 'var(--neutral-50)', cursor: 'pointer', minHeight: 36 }}
              >
                {ea.member_instruction || 'Click to add instructions...'}
              </div>
            )}
          </div>

          {/* Staff Instructions — only shown when action button is clicked */}
          {showViewStaffInstructions && (
            <div className={styles.section}>
              <label className={styles.sectionLabel}>Staff Instructions</label>
              {editingStaffInstruction ? (
                <div className={styles.instructionEditor}>
                  <div
                    className={styles.instructionEditable}
                    contentEditable
                    suppressContentEditableWarning
                    dangerouslySetInnerHTML={{ __html: staffInstructionDraft }}
                    onInput={e => setStaffInstructionDraft(e.currentTarget.innerHTML)}
                  />
                  <div className={styles.instructionToolbar}>
                    <ActionButton icon="solar:paperclip-linear" size="S" tooltip="Attach" />
                    <span className={styles.toolbarDivider} />
                    <ActionButton icon="solar:text-bold-linear" size="S" tooltip="Bold" onClick={() => document.execCommand('bold')} />
                    <ActionButton icon="solar:text-italic-linear" size="S" tooltip="Italic" onClick={() => document.execCommand('italic')} />
                    <ActionButton icon="solar:text-underline-linear" size="S" tooltip="Underline" onClick={() => document.execCommand('underline')} />
                    <span className={styles.toolbarDivider} />
                    <ActionButton icon="solar:text-field-linear" size="S" tooltip="Heading" onClick={() => document.execCommand('formatBlock', false, 'h3')} />
                    <ActionButton icon="solar:list-linear" size="S" tooltip="List" onClick={() => document.execCommand('insertUnorderedList')} />
                    <div style={{ flex: 1 }} />
                    <ActionButton icon="solar:trash-bin-minimalistic-linear" size="S" tooltip="Remove" state="error" onClick={() => { setShowViewStaffInstructions(false); setStaffInstructionDraft(''); if (ea.id) updateAppointment(ea.id, { staff_instruction: '' }); }} />
                    <ActionButton icon="solar:close-linear" size="S" tooltip="Discard" state="error" onClick={() => { setStaffInstructionDraft(ea.staff_instruction || ''); setEditingStaffInstruction(false); }} />
                    <ActionButton icon="solar:check-read-linear" size="S" tooltip="Save" onClick={handleSaveStaffInstruction} />
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setEditingStaffInstruction(true)}
                  style={{ border: '0.5px solid var(--neutral-150)', borderRadius: 4, padding: 8, fontSize: 14, color: ea.staff_instruction ? 'var(--neutral-400)' : 'var(--neutral-200)', fontFamily: 'Inter, sans-serif', lineHeight: 1.4, background: 'var(--neutral-50)', cursor: 'pointer', minHeight: 36 }}
                >
                  {ea.staff_instruction || 'Click to add staff instructions...'}
                </div>
              )}
            </div>
          )}
        </div>
      </Drawer>
    );
  }

  // ── Booking Success Screen ──
  if (bookingSuccess) {
    return (
      <Drawer title="Schedule Appointment" onClose={onClose} bodyClassName={styles.drawerBody}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 24, padding: '120px 0' }}>
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
            <circle cx="40" cy="40" r="36" stroke="#009B53" strokeWidth="4" fill="none" />
            <path d="M24 40L36 52L56 28" stroke="#009B53" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          <span style={{ fontSize: 24, fontWeight: 500, color: 'var(--neutral-400)', fontFamily: 'Inter, sans-serif' }}>Appointment Booked Successfully</span>
        </div>
      </Drawer>
    );
  }

  return (
    <Drawer title="Schedule Appointment" onClose={onClose} noCloseDivider headerRight={
      <>
        <Button variant="primary" size="L" disabled={!canSchedule} onClick={handleSchedule}>Schedule</Button>
        <span className={styles.headerDivider} />
      </>
    } bodyClassName={styles.drawerBody}>
      <div className={styles.content}>
        {/* Patient Selection */}
        {!selectedPatient ? (
          <div className={styles.section}>
            <label className={styles.sectionLabel}>Patient/Prospect <span className={styles.required}>*</span></label>
            <PatientSearch patients={patients} onSelect={setSelectedPatient} />
          </div>
        ) : (
          <div className={styles.section}>
            <label className={styles.sectionLabel}>Patient Details</label>
            <div className={styles.patientCard}>
              <div className={styles.patientCardHeader}>
                <Avatar variant="patient" initials={getInitials(selectedPatient.name).toUpperCase()} />
                <div className={styles.patientCardInfo}>
                  <div className={styles.patientCardName}>{selectedPatient.name}</div>
                  <div className={styles.patientCardMeta}>
                    {selectedPatient.gender?.[0] || 'M'} &bull; {selectedPatient.age || '62'}Y ({selectedPatient.dob || '03/29/1961'}) &bull;{' '}
                    <span style={{ color: '#D72825', fontWeight: 500 }}>RAF Score: {selectedPatient.laceScore || '3.5'}</span>{' '}
                    <span style={{ color: '#009B53', display: 'inline-flex', alignItems: 'center', gap: 2 }}>+0.5 <Icon name="solar:arrow-up-linear" size={10} color="#009B53" /></span>
                  </div>
                </div>
                <ActionButton icon="solar:close-linear" size="S" tooltip="Remove" onClick={() => setSelectedPatient(null)} />
              </div>

              {/* Reason for Visit — always editable */}
              <div className={styles.reasonField}>
                <label className={styles.reasonLabel}>Reason for Visit</label>
                <input
                  className={styles.reasonInput}
                  placeholder="Enter Reason for Visit"
                  value={reasonForVisit}
                  onChange={e => setReasonForVisit(e.target.value)}
                />
              </div>

              {/* Patient Info */}
              <div className={styles.patientInfoGrid}>
                <div className={styles.patientInfoRow}>
                  <span className={styles.patientInfoLabel}>Patient Location</span>
                  <span className={styles.patientInfoValue}>{selectedPatient.facility || 'New York'}</span>
                </div>
                <div className={styles.patientInfoRow}>
                  <span className={styles.patientInfoLabel}>Last Appointment</span>
                  <span className={styles.patientInfoValue}>
                    07-26-2023 with Katherine Moss{' '}
                    <button className={styles.viewDetailsLink}>View Details</button>
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Appointment Details */}
        <div className={styles.section}>
          <label className={styles.sectionLabel}>Appointment Details</label>
          <div className={styles.detailsCard}>
            {/* Appointment Type */}
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Appointment Type</span>
              <AppointmentTypePicker value={appointmentType} onSelect={setAppointmentType} appointmentTypes={appointmentTypes} />
            </div>

            {/* Mode of Appointment — dropdown */}
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Mode of Appointment</span>
              <DetailDropdown
                value={mode}
                placeholder="Select Mode of Appointment"
                icon="solar:monitor-linear"
                options={MODE_OPTIONS.map(m => ({ label: m.label, icon: m.icon }))}
                onSelect={v => setMode(v)}
                renderItem={(opt) => <><Icon name={opt.icon} size={16} color="var(--neutral-300)" /> {opt.label}</>}
              />
            </div>

            {/* Location — dropdown */}
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Location</span>
              <DetailDropdown
                value={location}
                placeholder="Select Location"
                icon="solar:map-point-linear"
                options={LOCATION_OPTIONS.map(l => ({ label: l }))}
                onSelect={v => setLocation(v)}
              />
            </div>

            {/* Primary User — dropdown with search, avatar, slots */}
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Primary User</span>
              <ProviderPicker value={provider} onSelect={setProvider} profileUsers={profileUsers} onAddSecondary={() => setShowSecondary(true)} />
            </div>

            {/* Secondary Users */}
            {showSecondary && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Secondary User</span>
                <SecondaryUserPicker selected={secondaryUsers} onChange={setSecondaryUsers} profileUsers={profileUsers} primary={provider} />
              </div>
            )}

            {/* Date — calendar picker */}
            <div className={styles.detailRowTop}>
              <span className={styles.detailLabel}>Date</span>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <DatePicker value={date} onSelect={setDate} />
                  {date && (
                    <div className={styles.recurringToggle}>
                      <Switch checked={recurring} onChange={v => { setRecurring(v); setRecurConfirmed(false); }} label="Set Recurring" />
                    </div>
                  )}
                </div>
                {/* Recurring configuration */}
                {date && recurring && !recurConfirmed && (
                  <div style={{ border: '0.5px solid var(--neutral-150)', borderRadius: 8, padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, color: 'var(--neutral-300)' }}>Repeats every</span>
                      <input type="number" min={1} max={30} value={recurFrequency} onChange={e => setRecurFrequency(parseInt(e.target.value) || 1)} style={{ width: 50, height: 28, border: '0.5px solid var(--neutral-200)', borderRadius: 4, textAlign: 'center', fontSize: 14, fontFamily: 'Inter, sans-serif', color: 'var(--neutral-400)', padding: '0 8px' }} />
                      <select value={recurUnit} onChange={e => { setRecurUnit(e.target.value); if (e.target.value === 'Day(s)') setRecurDays([]); }} style={{ height: 28, border: '0.5px solid var(--neutral-200)', borderRadius: 4, fontSize: 14, fontFamily: 'Inter, sans-serif', color: 'var(--neutral-400)', padding: '0 8px', background: 'var(--neutral-0)' }}>
                        <option value="Day(s)">Day/s</option>
                        <option value="Week(s)">Week/s</option>
                      </select>
                      {recurUnit === 'Week(s)' && <span style={{ fontSize: 14, color: 'var(--neutral-300)' }}>on</span>}
                      {recurUnit === 'Week(s)' && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          {[{ key: 'Sun', label: 'S' }, { key: 'Mon', label: 'M' }, { key: 'Tue', label: 'T' }, { key: 'Wed', label: 'W' }, { key: 'Thu', label: 'T' }, { key: 'Fri', label: 'F' }, { key: 'Sat', label: 'S' }].map(d => (
                            <button key={d.key} onClick={() => setRecurDays(prev => prev.includes(d.key) ? prev.filter(x => x !== d.key) : [...prev, d.key])} style={{ width: 24, height: 24, border: 'none', borderRadius: 4, fontSize: 12, fontFamily: 'Inter, sans-serif', color: recurDays.includes(d.key) ? 'var(--neutral-0)' : 'var(--neutral-300)', background: recurDays.includes(d.key) ? 'var(--primary-300)' : 'var(--neutral-0)', cursor: 'pointer', fontWeight: 500, boxShadow: recurDays.includes(d.key) ? 'none' : 'inset 0 0 0 0.5px var(--neutral-200)' }}>
                              {d.label}
                            </button>
                          ))}
                        </div>
                      )}
                      <span style={{ fontSize: 14, color: 'var(--neutral-300)' }}>Until</span>
                      <input type="date" value={recurEndDate} onChange={e => setRecurEndDate(e.target.value)} style={{ height: 28, border: '0.5px solid var(--neutral-200)', borderRadius: 4, fontSize: 14, fontFamily: 'Inter, sans-serif', color: 'var(--neutral-400)', padding: '0 8px', width: 120 }} />
                    </div>
                    <button onClick={() => setRecurConfirmed(true)} style={{ alignSelf: 'flex-start', fontSize: 12, color: 'var(--primary-300)', background: 'var(--primary-50)', border: '0.5px solid var(--primary-200)', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>Confirm</button>
                  </div>
                )}
                {/* Recurring confirmed summary */}
                {date && recurring && recurConfirmed && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, color: 'var(--neutral-300)', fontFamily: 'Inter, sans-serif' }}>
                      Repeats every {recurFrequency} {recurUnit.toLowerCase()}{recurUnit === 'Week(s)' && recurDays.length > 0 ? ` on ${recurDays.join(' and ')}` : ''}{recurEndDate ? ` until ${recurEndDate}` : ''}
                    </span>
                    <button onClick={() => setRecurConfirmed(false)} style={{ fontSize: 11, color: 'var(--primary-300)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', textDecoration: 'underline' }}>Edit</button>
                  </div>
                )}
              </div>
            </div>

            {/* Time — inline after selection, slot picker when choosing */}
            {date && (
              <div className={styles.detailRowTop}>
                <span className={styles.detailLabel}>Time</span>
                <div style={{ flex: 1 }}>
                  <button ref={timeBtnRef} className={time ? styles.detailValue : styles.detailValuePlaceholder} onClick={() => setShowTimePicker(v => !v)} style={{ cursor: 'pointer' }}>
                    <Icon name="solar:clock-circle-linear" size={16} color={time ? 'var(--neutral-300)' : 'var(--neutral-200)'} />
                    {time ? (
                      <>{time} - {(() => { const [h, m, p] = time.match(/(\d+):(\d+)\s*(am|pm)/i)?.slice(1) || []; const mins = (parseInt(m) || 0) + 30; return mins >= 60 ? `${(parseInt(h) || 0) + 1}:${String(mins - 60).padStart(2, '0')} ${p}` : `${h}:${String(mins).padStart(2, '0')} ${p}`; })()} ({timezoneLabel})</>
                    ) : 'Select Time'}
                  </button>
                  {showTimePicker && (
                    <div className={styles.timeSlotDropdown} style={{ position: 'relative', marginTop: 8 }}>
                      <div className={styles.timeSlotHeader}>
                        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--neutral-200)' }}>Available Slots (30 mins)</span>
                        <div style={{ flex: 1 }} />
                        <button onClick={() => setShowPickTime(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--primary-300)', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                          <Icon name="solar:clock-circle-linear" size={12} color="var(--primary-300)" /> Pick Time
                        </button>
                        <span style={{ width: 0.5, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: 'var(--neutral-300)', background: 'var(--neutral-50)', padding: '2px 8px', borderRadius: 4, border: '0.5px solid var(--neutral-100)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Icon name="solar:global-linear" size={10} color="var(--neutral-300)" />
                          {timezoneLabel}
                        </span>
                      </div>
                      {showPickTime ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input type="time" value={customTime} onChange={e => setCustomTime(e.target.value)} style={{ height: 32, border: '0.5px solid var(--neutral-200)', borderRadius: 4, fontSize: 14, fontFamily: 'Inter, sans-serif', color: 'var(--neutral-400)', padding: '0 8px' }} autoFocus />
                          <button onClick={() => { if (customTime) { const [hh, mm] = customTime.split(':').map(Number); const ampm = hh >= 12 ? 'pm' : 'am'; const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh; setTime(`${h12}:${String(mm).padStart(2, '0')} ${ampm}`); setShowTimePicker(false); setShowPickTime(false); } }} style={{ fontSize: 12, color: 'var(--primary-300)', background: 'var(--primary-50)', border: '0.5px solid var(--primary-200)', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>Set</button>
                          <button onClick={() => setShowPickTime(false)} style={{ fontSize: 12, color: 'var(--neutral-300)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
                        </div>
                      ) : (
                        <div className={styles.timeSlots}>
                          {TIME_SLOTS.map(t => (
                            <button key={t} className={`${styles.timeSlot} ${time === t ? styles.timeSlotActive : ''}`} onClick={() => { setTime(t); setShowTimePicker(false); }}>
                              {t}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RSVP */}
        <label className={styles.rsvpRow}>
          <input type="checkbox" checked={requireRsvp} onChange={() => setRequireRsvp(v => !v)} className={styles.checkbox} />
          <span>Require RSVP</span>
          <Icon name="solar:info-circle-linear" size={14} color="var(--neutral-200)" />
        </label>

        {/* Member Instruction */}
        <div className={styles.section}>
          <label className={styles.sectionLabel}>Member Instruction</label>
          <div className={styles.instructionEditor}>
            <div
              className={styles.instructionEditable}
              contentEditable
              suppressContentEditableWarning
              data-placeholder="Add Instructions for Member"
              onInput={e => setMemberInstruction(e.currentTarget.innerHTML)}
            />
            <div className={styles.instructionToolbar}>
              <ActionButton icon="solar:paperclip-linear" size="S" tooltip="Attach" />
              <span className={styles.toolbarDivider} />
              <ActionButton icon="solar:text-bold-linear" size="S" tooltip="Bold" onClick={() => document.execCommand('bold')} />
              <ActionButton icon="solar:text-italic-linear" size="S" tooltip="Italic" onClick={() => document.execCommand('italic')} />
              <ActionButton icon="solar:text-underline-linear" size="S" tooltip="Underline" onClick={() => document.execCommand('underline')} />
              <span className={styles.toolbarDivider} />
              <ActionButton icon="solar:text-field-linear" size="S" tooltip="Heading" onClick={() => document.execCommand('formatBlock', false, 'h3')} />
              <ActionButton icon="solar:list-linear" size="S" tooltip="List" onClick={() => document.execCommand('insertUnorderedList')} />
            </div>
          </div>
        </div>

        {/* Staff Instructions */}
        {!showStaffInstructions ? (
          <button className={styles.addStaffBtn} onClick={() => setShowStaffInstructions(true)}>
            <Icon name="solar:document-add-linear" size={16} color="var(--primary-300)" />
            Add Staff Instructions
          </button>
        ) : (
          <div className={styles.section}>
            <label className={styles.sectionLabel}>Staff Instructions</label>
            <div className={styles.instructionEditor}>
              <div
                className={styles.instructionEditable}
                contentEditable
                suppressContentEditableWarning
                data-placeholder="Add Instructions for Staff"
                onInput={e => setStaffInstruction(e.currentTarget.innerHTML)}
              />
              <div className={styles.instructionToolbar}>
                <ActionButton icon="solar:paperclip-linear" size="S" tooltip="Attach" />
                <span className={styles.toolbarDivider} />
                <ActionButton icon="solar:text-bold-linear" size="S" tooltip="Bold" onClick={() => document.execCommand('bold')} />
                <ActionButton icon="solar:text-italic-linear" size="S" tooltip="Italic" onClick={() => document.execCommand('italic')} />
                <ActionButton icon="solar:text-underline-linear" size="S" tooltip="Underline" onClick={() => document.execCommand('underline')} />
                <span className={styles.toolbarDivider} />
                <ActionButton icon="solar:text-field-linear" size="S" tooltip="Heading" onClick={() => document.execCommand('formatBlock', false, 'h3')} />
                <ActionButton icon="solar:list-linear" size="S" tooltip="List" onClick={() => document.execCommand('insertUnorderedList')} />
                <div style={{ flex: 1 }} />
                <ActionButton icon="solar:trash-bin-minimalistic-linear" size="S" tooltip="Remove" state="error" onClick={() => { setShowStaffInstructions(false); setStaffInstruction(''); }} />
              </div>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}

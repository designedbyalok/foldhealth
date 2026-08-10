import { Switch } from '../Switch/Switch';
import styles from './ScheduleDrawer.module.css';

const WEEKDAY_BUTTONS = [
  { key: 'Sun', label: 'S' },
  { key: 'Mon', label: 'M' },
  { key: 'Tue', label: 'T' },
  { key: 'Wed', label: 'W' },
  { key: 'Thu', label: 'T' },
  { key: 'Fri', label: 'F' },
  { key: 'Sat', label: 'S' },
];

export function ScheduleDrawerRecurringFields({
  recurFrequency,
  setRecurFrequency,
  recurUnit,
  setRecurUnit,
  recurDays,
  setRecurDays,
  recurEndDate,
  setRecurEndDate,
  recurConfirmed,
  setRecurConfirmed,
}) {
  if (recurConfirmed) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 13, color: 'var(--neutral-300)', fontFamily: 'Inter, sans-serif' }}>
          Repeats every {recurFrequency} {recurUnit.toLowerCase()}{recurUnit === 'Week(s)' && recurDays.length > 0 ? ` on ${recurDays.join(' and ')}` : ''}{recurEndDate ? ` until ${recurEndDate}` : ''}
        </span>
        <button onClick={() => setRecurConfirmed(false)} style={{ fontSize: 11, color: 'var(--primary-300)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', textDecoration: 'underline' }}>Edit</button>
      </div>
    );
  }

  return (
    <div style={{ border: '0.5px solid var(--neutral-150)', borderRadius: 8, padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, color: 'var(--neutral-300)' }}>Repeats every</span>
        <input aria-label="Repeat frequency" type="number" min={1} max={30} value={recurFrequency} onChange={e => setRecurFrequency(parseInt(e.target.value) || 1)} style={{ width: 50, height: 28, border: '0.5px solid var(--neutral-200)', borderRadius: 4, textAlign: 'center', fontSize: 14, fontFamily: 'Inter, sans-serif', color: 'var(--neutral-400)', padding: '0 8px' }} />
        <select aria-label="Repeat unit" value={recurUnit} onChange={e => { setRecurUnit(e.target.value); if (e.target.value === 'Day(s)') setRecurDays([]); }} style={{ height: 28, border: '0.5px solid var(--neutral-200)', borderRadius: 4, fontSize: 14, fontFamily: 'Inter, sans-serif', color: 'var(--neutral-400)', padding: '0 8px', background: 'var(--neutral-0)' }}>
          <option value="Day(s)">Day/s</option>
          <option value="Week(s)">Week/s</option>
        </select>
        {recurUnit === 'Week(s)' && <span style={{ fontSize: 14, color: 'var(--neutral-300)' }}>on</span>}
        {recurUnit === 'Week(s)' && (
          <div style={{ display: 'flex', gap: 4 }}>
            {WEEKDAY_BUTTONS.map(d => (
              <button key={d.key} onClick={() => setRecurDays(prev => prev.includes(d.key) ? prev.filter(x => x !== d.key) : [...prev, d.key])} style={{ width: 24, height: 24, border: 'none', borderRadius: 4, fontSize: 12, fontFamily: 'Inter, sans-serif', color: recurDays.includes(d.key) ? 'var(--neutral-0)' : 'var(--neutral-300)', background: recurDays.includes(d.key) ? 'var(--primary-300)' : 'var(--neutral-0)', cursor: 'pointer', fontWeight: 500, boxShadow: recurDays.includes(d.key) ? 'none' : 'inset 0 0 0 0.5px var(--neutral-200)' }}>
                {d.label}
              </button>
            ))}
          </div>
        )}
        <span style={{ fontSize: 14, color: 'var(--neutral-300)' }}>Until</span>
        <input aria-label="Repeat until date" type="date" value={recurEndDate} onChange={e => setRecurEndDate(e.target.value)} style={{ height: 28, border: '0.5px solid var(--neutral-200)', borderRadius: 4, fontSize: 14, fontFamily: 'Inter, sans-serif', color: 'var(--neutral-400)', padding: '0 8px', width: 120 }} />
      </div>
      <button onClick={() => setRecurConfirmed(true)} style={{ alignSelf: 'flex-start', fontSize: 12, color: 'var(--primary-300)', background: 'var(--primary-50)', border: '0.5px solid var(--primary-200)', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>Confirm</button>
    </div>
  );
}

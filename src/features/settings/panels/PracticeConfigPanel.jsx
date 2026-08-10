import { useState } from 'react';
import { Icon } from '../../../components/Icon/Icon';
import { Switch } from '../../../components/Switch/Switch';
import { Button } from '../../../components/Button/Button';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DEFAULT_HOURS = { start: '8:00 AM', end: '9:00 PM' };

const HOLIDAYS = [
  { date: '2026-01-01', name: 'New Year\'s Day' },
  { date: '2026-07-04', name: 'Independence Day' },
  { date: '2026-11-26', name: 'Thanksgiving' },
  { date: '2026-12-25', name: 'Christmas Day' },
];

const VM_OPTIONS = ['Leave voicemail', 'Hang up silently', 'Leave callback number only'];

const s = {
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: 500, color: 'var(--neutral-400)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 },
  card: { background: 'var(--neutral-0)', border: '0.5px solid var(--neutral-150)', borderRadius: 8, padding: 16, marginBottom: 12 },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '0.5px solid var(--neutral-100)', fontSize: 14 },
  dayLabel: { width: 40, fontWeight: 500, color: 'var(--neutral-400)' },
  timeInput: { padding: '4px 8px', border: '0.5px solid var(--neutral-150)', borderRadius: 4, fontSize: 13, color: 'var(--neutral-400)', width: 100 },
  select: { padding: '6px 10px', border: '0.5px solid var(--neutral-150)', borderRadius: 4, fontSize: 13, color: 'var(--neutral-400)', background: 'var(--neutral-0)' },
  holidayRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '0.5px solid var(--neutral-100)', fontSize: 13, color: 'var(--neutral-400)' },
  holidayDate: { color: 'var(--neutral-300)', width: 100 },
};

export function PracticeConfigPanel() {
  const [hours, setHours] = useState(() => DAYS.map(() => ({ ...DEFAULT_HOURS, enabled: true })));
  const [vmBehavior, setVmBehavior] = useState('Leave voicemail');
  const [amdEnabled, setAmdEnabled] = useState(true);

  return (
    <div style={{ padding: 16 }}>
      {/* Practice Hours */}
      <div style={s.section}>
        <div style={s.sectionTitle}>
          <Icon name="solar:clock-circle-bold" size={16} color="var(--status-info)" />
          Practice Hours
        </div>
        <div style={s.card}>
          {DAYS.map((day, i) => (
            <div key={day} style={s.row}>
              <span style={s.dayLabel}>{day}</span>
              <Switch checked={hours[i].enabled} onChange={() => {
                const next = [...hours]; next[i] = { ...next[i], enabled: !next[i].enabled }; setHours(next);
              }} />
              <input aria-label={`${day} opening time`} style={s.timeInput} value={hours[i].start} readOnly disabled={!hours[i].enabled} />
              <span style={{ color: 'var(--neutral-200)' }}>to</span>
              <input aria-label={`${day} closing time`} style={s.timeInput} value={hours[i].end} readOnly disabled={!hours[i].enabled} />
            </div>
          ))}
        </div>
      </div>

      {/* Holidays */}
      <div style={s.section}>
        <div style={s.sectionTitle}>
          <Icon name="solar:calendar-bold" size={16} color="var(--status-warning)" />
          Holiday Schedule
        </div>
        <div style={s.card}>
          {HOLIDAYS.map(h => (
            <div key={h.date} style={s.holidayRow}>
              <span style={s.holidayDate}>{h.date}</span>
              <span style={{ flex: 1 }}>{h.name}</span>
              <Icon name="solar:close-circle-bold" size={16} color="var(--neutral-200)" style={{ cursor: 'pointer' }} />
            </div>
          ))}
          <Button variant="secondary" size="S" leadingIcon="solar:add-circle-linear" style={{ marginTop: 8 }}>
            Add Holiday
          </Button>
        </div>
      </div>

      {/* Voicemail / AMD Config */}
      <div style={s.section}>
        <div style={s.sectionTitle}>
          <Icon name="solar:phone-bold" size={16} color="#E8742C" />
          Voicemail & AMD Configuration
        </div>
        <div style={s.card}>
          <div style={s.row}>
            <span>Answering Machine Detection (AMD)</span>
            <Switch checked={amdEnabled} onChange={setAmdEnabled} />
          </div>
          <div style={{ ...s.row, borderBottom: 'none' }}>
            <span>When voicemail detected</span>
            <select aria-label="When voicemail detected" style={s.select} value={vmBehavior} onChange={e => setVmBehavior(e.target.value)}>
              {VM_OPTIONS.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

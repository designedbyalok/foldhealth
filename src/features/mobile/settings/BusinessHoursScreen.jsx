import { useState } from 'react';
import { Button } from '../../../components/Button/Button';
import { Switch } from '../../../components/Switch/Switch';
import { useAppStore } from '../../../store/useAppStore';
import { useMobileNav } from '../MobileNavContext';
import { FieldGroup, FormScreen, PickerField } from '../patient/FormScreen';
import styles from './settings.module.css';

// Same days, defaults and timezones as the desktop Business Hours drawer
// (Settings > Messages > group > Business Hours).
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIMEZONES = [
  'Asia/Kolkata (+5:30)', 'America/New_York (ET)', 'America/Chicago (CT)',
  'America/Denver (MT)', 'America/Los_Angeles (PT)', 'UTC (+0:00)',
].map(tz => ({ value: tz, label: tz }));
const DEFAULT_SLOTS = {
  Sunday: [{ from: '12:00 am', to: '12:00 am' }],
  Monday: [{ from: '12:00 pm', to: '4:00 pm' }, { from: '5:00 pm', to: '8:00 pm' }],
  Tuesday: [{ from: '12:00 pm', to: '4:00 pm' }],
  Wednesday: [{ from: '12:00 pm', to: '4:00 pm' }],
  Thursday: [{ from: '12:00 pm', to: '4:00 pm' }],
  Friday: [{ from: '12:00 pm', to: '4:00 pm' }],
  Saturday: [{ from: '12:00 am', to: '12:00 am' }],
};
const DEFAULT_AVAILABLE = { Sunday: false, Monday: true, Tuesday: true, Wednesday: true, Thursday: true, Friday: true, Saturday: false };

/** Messages business hours: which days the inbox is staffed, and the timezone. */
export function BusinessHoursScreen() {
  const { pop } = useMobileNav();
  const showToast = useAppStore(s => s.showToast);
  const [available, setAvailable] = useState(DEFAULT_AVAILABLE);
  const [timezone, setTimezone] = useState('Asia/Kolkata (+5:30)');

  return (
    <FormScreen
      title="Business hours"
      subtitle="Global template for messaging"
      footer={<Button size="lg" onClick={() => { showToast('Business hours saved'); pop(); }}>Save</Button>}
    >
      <PickerField label="Time Zone" value={timezone} options={TIMEZONES} onChange={setTimezone} />
      <FieldGroup label="Days">
        {DAYS.map(day => (
          <div key={day} className={styles.dayCard}>
            <div className={styles.dayRow}>
              <span className={styles.dayName}>{day}</span>
              <span className={styles.switchWrap}>
                <Switch checked={available[day]} onChange={(on) => setAvailable(a => ({ ...a, [day]: on }))} ariaLabel={`${day} available`} />
              </span>
            </div>
            <span className={styles.dayHours}>
              {available[day] ? DEFAULT_SLOTS[day].map(s => `${s.from} to ${s.to}`).join(', ') : 'Unavailable'}
            </span>
          </div>
        ))}
      </FieldGroup>
    </FormScreen>
  );
}

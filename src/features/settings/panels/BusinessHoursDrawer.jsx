import { useState } from 'react';
import { Icon } from '../../../components/Icon/Icon';
import { Drawer } from '../../../components/Drawer/Drawer';
import { Button } from '../../../components/Button/Button';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { useAppStore } from '../../../store/useAppStore';
import { Select } from '../../../components/Select/Select';
import { Switch } from '../../../components/Switch/Switch';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const TIMEZONES = [
  'Asia/Kolkata (+5:30)',
  'America/New_York (ET)',
  'America/Chicago (CT)',
  'America/Denver (MT)',
  'America/Los_Angeles (PT)',
  'UTC (+0:00)',
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

const DEFAULT_AVAILABLE = {
  Sunday: false, Monday: true, Tuesday: true, Wednesday: true, Thursday: true, Friday: true, Saturday: false,
};

const inputStyle = {
  padding: '8px 12px', borderRadius: 4, border: '0.5px solid var(--neutral-150)',
  fontSize: 13, fontFamily: "'Inter', sans-serif", outline: 'none', color: 'var(--neutral-400)',
  width: 120, boxSizing: 'border-box',
};

export function BusinessHoursDrawer() {
  const businessHoursOpen = useAppStore(s => s.businessHoursOpen);
  const setBusinessHoursOpen = useAppStore(s => s.setBusinessHoursOpen);
  const showToast = useAppStore(s => s.showToast);

  const [slots, setSlots] = useState(DEFAULT_SLOTS);
  const [available, setAvailable] = useState(DEFAULT_AVAILABLE);
  const [timezone, setTimezone] = useState('Asia/Kolkata (+5:30)');

  if (!businessHoursOpen) return null;

  const toggleDay = (day) => setAvailable(prev => ({ ...prev, [day]: !prev[day] }));

  const addSlot = (day) => {
    setSlots(prev => ({ ...prev, [day]: [...prev[day], { from: '9:00 am', to: '5:00 pm' }] }));
  };

  const removeSlot = (day, idx) => {
    setSlots(prev => ({ ...prev, [day]: prev[day].filter((_, i) => i !== idx) }));
  };

  const headerRight = (
    <Button variant="primary" size="L" onClick={() => { showToast('Business hours saved'); setBusinessHoursOpen(false); }}>
      Save
    </Button>
  );

  return (
    <Drawer title="Set Global Template Business Hours" onClose={() => setBusinessHoursOpen(false)} headerRight={headerRight}>
      {/* Time Zone */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, color: 'var(--neutral-300)', marginBottom: 6 }}>Time Zone</div>
        <Select
          options={TIMEZONES}
          value={timezone}
          onChange={setTimezone}
          style={{ width: '100%' }}
        />
      </div>

      {/* Day cards */}
      {DAYS.map(day => {
        const isAvailable = available[day];
        const daySlots = slots[day] || [];
        return (
          <div key={day} style={{
            border: '0.5px solid var(--neutral-150)', borderRadius: 8,
            marginBottom: 12, overflow: 'hidden',
          }}>
            {/* Day header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', borderBottom: isAvailable ? '0.5px solid var(--neutral-100)' : 'none',
            }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--neutral-500)' }}>{day}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Button variant="ghost" size="S" onClick={() => addSlot(day)}
                  style={{ opacity: isAvailable ? 1 : 0.4 }}>
                  + Add New Time
                </Button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Switch checked={isAvailable} onChange={() => toggleDay(day)} />
                  <span style={{ fontSize: 12, color: isAvailable ? 'var(--neutral-400)' : 'var(--neutral-200)' }}>Available</span>
                </div>
              </div>
            </div>

            {/* Time slots */}
            <div style={{ padding: '10px 14px' }}>
              {daySlots.map((slot, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--primary-300)', marginBottom: 4 }}>From Time</div>
                    <div style={{ position: 'relative' }}>
                      <input aria-label="From time" value={slot.from} readOnly style={{
                        ...inputStyle,
                        color: isAvailable ? 'var(--neutral-400)' : 'var(--neutral-200)',
                        background: isAvailable ? '#fff' : 'var(--neutral-50)',
                      }} />
                      <Icon name="solar:clock-circle-linear" size={14} color="var(--neutral-200)"
                        style={{ position: 'absolute', right: 10, top: 10 }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--neutral-300)', marginBottom: 4 }}>To Time</div>
                    <div style={{ position: 'relative' }}>
                      <input aria-label="To time" value={slot.to} readOnly style={{
                        ...inputStyle,
                        color: isAvailable ? 'var(--neutral-400)' : 'var(--neutral-200)',
                        background: isAvailable ? '#fff' : 'var(--neutral-50)',
                      }} />
                      <Icon name="solar:clock-circle-linear" size={14} color="var(--neutral-200)"
                        style={{ position: 'absolute', right: 10, top: 10 }} />
                    </div>
                  </div>
                  {daySlots.length > 1 && (
                    <ActionButton icon="solar:close-circle-linear" size="L" tooltip="Remove slot"
                      onClick={() => removeSlot(day, idx)} style={{ marginTop: 18 }} />
                  )}
                </div>
              ))}
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--neutral-300)', cursor: 'pointer', marginTop: 4 }}>
                <input type="checkbox" style={{ accentColor: 'var(--primary-300)' }} /> Apply to All Days
              </label>
            </div>
          </div>
        );
      })}
    </Drawer>
  );
}

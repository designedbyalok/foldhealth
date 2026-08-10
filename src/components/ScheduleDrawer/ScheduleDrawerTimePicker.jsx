import { Icon } from '../Icon/Icon';
import { TIME_SLOTS } from './scheduleDrawerConstants';
import styles from './ScheduleDrawer.module.css';

function formatEndTime(time) {
  const [h, m, p] = time.match(/(\d+):(\d+)\s*(am|pm)/i)?.slice(1) || [];
  const mins = (parseInt(m) || 0) + 30;
  return mins >= 60
    ? `${(parseInt(h) || 0) + 1}:${String(mins - 60).padStart(2, '0')} ${p}`
    : `${h}:${String(mins).padStart(2, '0')} ${p}`;
}

export function ScheduleDrawerTimePicker({
  time,
  setTime,
  isSectionOpen,
  setSectionOpen,
  customTime,
  setCustomTime,
  timeBtnRef,
  timezoneLabel,
}) {
  return (
    <div className={styles.detailRowTop}>
      <span className={styles.detailLabel}>Time</span>
      <div style={{ flex: 1 }}>
        <button ref={timeBtnRef} className={time ? styles.detailValue : styles.detailValuePlaceholder} onClick={() => setSectionOpen('timePicker', !isSectionOpen('timePicker'))} style={{ cursor: 'pointer' }}>
          <Icon name="solar:clock-circle-linear" size={16} color={time ? 'var(--neutral-300)' : 'var(--neutral-200)'} />
          {time ? (
            <>{time} - {formatEndTime(time)} ({timezoneLabel})</>
          ) : 'Select Time'}
        </button>
        {isSectionOpen('timePicker') && (
          <div className={styles.timeSlotDropdown} style={{ position: 'relative', marginTop: 8 }}>
            <div className={styles.timeSlotHeader}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--neutral-200)' }}>Available Slots (30 mins)</span>
              <div style={{ flex: 1 }} />
              <button onClick={() => setSectionOpen('pickTime', !isSectionOpen('pickTime'))} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--primary-300)', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                <Icon name="solar:clock-circle-linear" size={12} color="var(--primary-300)" /> Pick Time
              </button>
              <span style={{ width: 0.5, height: 16, background: 'var(--neutral-150)', flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--neutral-300)', background: 'var(--neutral-50)', padding: '2px 8px', borderRadius: 4, border: '0.5px solid var(--neutral-100)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Icon name="solar:global-linear" size={10} color="var(--neutral-300)" />
                {timezoneLabel}
              </span>
            </div>
            {isSectionOpen('pickTime') ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input aria-label="Custom time" type="time" value={customTime} onChange={e => setCustomTime(e.target.value)} style={{ height: 32, border: '0.5px solid var(--neutral-200)', borderRadius: 4, fontSize: 14, fontFamily: 'Inter, sans-serif', color: 'var(--neutral-400)', padding: '0 8px' }} autoFocus />
                <button onClick={() => { if (customTime) { const [hh, mm] = customTime.split(':').map(Number); const ampm = hh >= 12 ? 'pm' : 'am'; const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh; setTime(`${h12}:${String(mm).padStart(2, '0')} ${ampm}`); setSectionOpen('timePicker', false); setSectionOpen('pickTime', false); } }} style={{ fontSize: 12, color: 'var(--primary-300)', background: 'var(--primary-50)', border: '0.5px solid var(--primary-200)', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>Set</button>
                <button onClick={() => setSectionOpen('pickTime', false)} style={{ fontSize: 12, color: 'var(--neutral-300)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
              </div>
            ) : (
              <div className={styles.timeSlots}>
                {TIME_SLOTS.map(t => (
                  <button key={t} className={`${styles.timeSlot} ${time === t ? styles.timeSlotActive : ''}`} onClick={() => { setTime(t); setSectionOpen('timePicker', false); }}>
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

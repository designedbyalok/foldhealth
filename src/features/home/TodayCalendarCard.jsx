import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../components/Icon/Icon';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { ScheduleDrawer } from '../../components/ScheduleDrawer/ScheduleDrawer';
import { useAppStore } from '../../store/useAppStore';
import styles from './HomeView.module.css';

const HOUR_HEIGHT = 48;
const MIN_HEIGHT = 400;
// Below this a title plus a meta line no longer fit, so the card goes single-line.
const COMPACT_EVENT_HEIGHT = 40;

function addDays(date, delta) {
  const d = new Date(date);
  d.setDate(d.getDate() + delta);
  return d;
}

function formatDate(d) {
  return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
}

function mmddyyyy(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${m}-${day}-${d.getFullYear()}`;
}

function parseTimeToMinutes(str) {
  if (!str) return null;
  const m = str.trim().toLowerCase().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ampm = m[3];
  if (ampm === 'pm' && h !== 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  return h * 60 + min;
}

function hourLabel(hour) {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

function makeSlotTemporal(date, hour, minute) {
  const T = globalThis.Temporal;
  if (!T) return null;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  return T.ZonedDateTime.from({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour,
    minute,
    timeZone: tz,
  });
}

export function TodayCalendarCard({ dragHandleClassName }) {
  const [viewDate, setViewDate] = useState(() => new Date());
  const [now, setNow] = useState(() => new Date());
  const [drawerSlot, setDrawerSlot] = useState(null);
  const temporalReadyRef = useRef(!!globalThis.Temporal);
  const bodyRef = useRef(null);
  const scrolledRef = useRef(false);

  const appointments = useAppStore(s => s.appointments || []);
  const fetchAppointments = useAppStore(s => s.fetchAppointments);

  useEffect(() => {
    if (fetchAppointments) fetchAppointments();
  }, [fetchAppointments]);

  useEffect(() => {
    if (globalThis.Temporal) { temporalReadyRef.current = true; return; }
    import('temporal-polyfill').then(mod => {
      if (typeof globalThis.Temporal === 'undefined') globalThis.Temporal = mod.Temporal;
      temporalReadyRef.current = true;
    }).catch(err => {
      console.warn('[TodayCalendarCard] temporal-polyfill failed to load:', err);
    });
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const isToday = useMemo(() => {
    const a = viewDate, b = now;
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }, [viewDate, now]);

  const nowTopPx = useMemo(() => {
    const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
    return (minutesSinceMidnight / 60) * HOUR_HEIGHT;
  }, [now]);

  useEffect(() => {
    if (scrolledRef.current || !bodyRef.current) return;
    const target = Math.max(0, nowTopPx - 120);
    bodyRef.current.scrollTop = target;
    scrolledRef.current = true;
  }, [nowTopPx]);

  const dateKey = mmddyyyy(viewDate);
  const todaysAppointments = useMemo(
    () => (appointments || []).filter(a => a.date === dateKey && a.status !== 'Cancelled'),
    [appointments, dateKey]
  );

  const eventBlocks = useMemo(() => todaysAppointments.flatMap(a => {
    const startMin = parseTimeToMinutes(a.timeStart || a.time_start);
    const endMin = parseTimeToMinutes(a.timeEnd || a.time_end);
    if (startMin == null) return [];
    const top = (startMin / 60) * HOUR_HEIGHT;
    const height = endMin != null ? Math.max(20, ((endMin - startMin) / 60) * HOUR_HEIGHT) : 24;
    return [{
      id: a.id,
      top,
      height,
      title: a.patientName || a.patient_name || 'Appointment',
      meta: [a.appointmentTypeName || a.appointment_type_name, a.reasonForVisit || a.reason_for_visit]
        .filter(Boolean).join(' · '),
    }];
  }), [todaysAppointments]);

  const handleSlotClick = (hour, minute) => {
    if (!temporalReadyRef.current) return;
    const slot = makeSlotTemporal(viewDate, hour, minute);
    if (slot) setDrawerSlot(slot);
  };

  const handleDrawerClose = () => setDrawerSlot(null);
  const handleSave = () => { if (fetchAppointments) fetchAppointments({ force: true }); };

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className={styles.card}>
      <div className={[styles.cardHeader, dragHandleClassName].filter(Boolean).join(' ')}>
        <div className={styles.cardTitle}>
          <Icon name="solar:calendar-linear" size={14} color="var(--primary-300)" />
          {isToday ? 'Today' : viewDate.toLocaleDateString('en-US', { weekday: 'short' })}, {formatDate(viewDate)}
        </div>
        <div className={styles.calNav}>
          <ActionButton icon="solar:alt-arrow-left-linear" size="sm" tooltip="Previous day" onClick={() => setViewDate(d => addDays(d, -1))} />
          <ActionButton icon="solar:calendar-date-linear" size="sm" tooltip="Today" onClick={() => setViewDate(new Date())} />
          <ActionButton icon="solar:alt-arrow-right-linear" size="sm" tooltip="Next day" onClick={() => setViewDate(d => addDays(d, 1))} />
        </div>
      </div>
      <div className={styles.calBody} ref={bodyRef}>
        <div className={styles.calGrid} style={{ height: `${HOUR_HEIGHT * 24}px`, minHeight: `${MIN_HEIGHT}px` }}>
          {hours.map(h => (
            <div key={h} className={styles.calHourRow} style={{ height: `${HOUR_HEIGHT}px` }}>
              <span className={styles.calHourLabel}>{hourLabel(h)}</span>
              <div className={styles.calHalfLine} />
              <div
                className={[styles.calSlot, styles.topHalf].join(' ')}
                onClick={() => handleSlotClick(h, 0)}
                title={`${hourLabel(h)} – ${hourLabel(h)} :30`}
              />
              <div
                className={[styles.calSlot, styles.botHalf].join(' ')}
                onClick={() => handleSlotClick(h, 30)}
              />
            </div>
          ))}
          {eventBlocks.map(evt => (
            <div
              key={evt.id}
              className={[styles.calEvent, evt.height < COMPACT_EVENT_HEIGHT && styles.calEventCompact].filter(Boolean).join(' ')}
              style={{ top: `${evt.top}px`, height: `${evt.height}px` }}
              title={evt.title}
            >
              <div className={styles.calEventTitle}>{evt.title}</div>
              {evt.meta && <div className={styles.calEventMeta}>{evt.meta}</div>}
            </div>
          ))}
          {isToday && (
            <div className={styles.nowLine} style={{ top: `${nowTopPx}px` }}>
              <span className={styles.nowLabel}>Now</span>
            </div>
          )}
        </div>
      </div>
      {drawerSlot && (
        <ScheduleDrawer
          selectedSlot={drawerSlot}
          existingAppointment={null}
          onClose={handleDrawerClose}
          onSave={handleSave}
          timezoneLabel="GMT"
          source="home"
        />
      )}
    </div>
  );
}

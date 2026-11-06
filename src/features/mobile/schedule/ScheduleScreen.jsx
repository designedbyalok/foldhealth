import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../../components/Icon/Icon';
import { displayAppointmentStatus } from '../../../components/ScheduleDrawer/scheduleDrawerConstants';
import { useAppStore } from '../../../store/useAppStore';
import { MobileRootHeader } from '../MobileHeader';
import { MobileEmpty, MobileListSkeleton } from '../MobileParts';
import { useMobileNav } from '../MobileNavContext';
import { appointmentStart, toApptDate } from './appointmentTime';
import common from '../mobile.module.css';
import styles from './ScheduleScreen.module.css';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const TONES = ['green', 'blue', 'amber'];
const startOfWeek = (d) => { const s = new Date(d.getFullYear(), d.getMonth(), d.getDate()); s.setDate(s.getDate() - s.getDay()); return s; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const sameDay = (a, b) => a.toDateString() === b.toDateString();
// The same visit type keeps the same colour.
const toneOf = (name) => TONES[[...String(name || '')].reduce((n, ch) => n + ch.charCodeAt(0), 0) % TONES.length];
const hourLabel = (h) => `${String(h % 12 || 12).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;

/** The provider's day, one week at a time (Figma 759:22910). */
export function ScheduleScreen() {
  const { push } = useMobileNav();
  const appointments = useAppStore(s => s.appointments);
  const loading = useAppStore(s => s.appointmentsLoading);
  const fetchAppointments = useAppStore(s => s.fetchAppointments);
  const involvesMe = useAppStore(s => s._appointmentInvolvesMe);
  const me = useAppStore(s => s.currentUserProfile);
  const [selected, setSelected] = useState(() => new Date());
  const touchX = useRef(null);
  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  const today = new Date();
  const weekStart = startOfWeek(selected);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Without a resolved profile there is no "me" to match, so show everyone's.
  const mine = useMemo(
    () => (appointments || []).filter(a => !me?.name || involvesMe(a)),
    [appointments, me, involvesMe],
  );
  const busyDays = useMemo(() => new Set(mine.map(a => a.date)), [mine]);
  const dayAppts = useMemo(() => mine
    .filter(a => a.date === toApptDate(selected))
    .map(a => ({ ...a, start: appointmentStart(a) }))
    .filter(a => a.start)
    .sort((a, b) => a.start - b.start), [mine, selected]);

  const hours = useMemo(() => {
    const byHour = new Map();
    dayAppts.forEach(a => {
      const h = a.start.getHours();
      byHour.set(h, [...(byHour.get(h) || []), a]);
    });
    const first = Math.min(8, ...byHour.keys());
    const last = Math.max(17, ...byHour.keys());
    return Array.from({ length: last - first + 1 }, (_, i) => [first + i, byHour.get(first + i) || []]);
  }, [dayAppts]);

  const shiftWeek = (n) => setSelected(d => addDays(d, n * 7));

  return (
    <div className={common.screen}>
      <MobileRootHeader title="Schedule" />
      <div className={styles.monthRow}>
        <span>{selected.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
        {!sameDay(selected, today) && <button type="button" className={styles.today} onClick={() => setSelected(new Date())}>Today</button>}
      </div>
      <div
        className={styles.week}
        onTouchStart={(e) => { touchX.current = e.touches[0]?.clientX ?? null; }}
        onTouchEnd={(e) => {
          const endX = e.changedTouches[0]?.clientX;
          const startX = touchX.current;
          touchX.current = null;
          if (startX == null || endX == null) return;
          const dx = endX - startX;
          if (Math.abs(dx) > 50) shiftWeek(dx < 0 ? 1 : -1);
        }}
      >
        {days.map((d, i) => {
          const active = sameDay(d, selected);
          return (
            <button key={d.toISOString()} type="button" className={styles.day} aria-pressed={active} aria-label={d.toDateString()} onClick={() => setSelected(d)}>
              <span className={styles.dow}>{DOW[i]}</span>
              <span className={[styles.date, sameDay(d, today) ? styles.dateToday : '', active ? styles.dateActive : ''].join(' ')}>{d.getDate()}</span>
              <span className={[styles.dot, busyDays.has(toApptDate(d)) ? '' : styles.dotEmpty].join(' ')} />
            </button>
          );
        })}
      </div>
      <div className={common.body}>
        {loading && !appointments?.length ? <MobileListSkeleton count={4} /> : dayAppts.length === 0 ? (
          <MobileEmpty icon="solar:calendar-minimalistic-linear" title="No appointments" description="Nothing is booked for this day." />
        ) : (
          <div className={styles.agenda}>
            {hours.map(([h, list]) => (
              <div key={h} className={styles.hour}>
                <span className={styles.hourLabel}>{hourLabel(h)}</span>
                <div className={styles.slot}>
                  {list.map(a => {
                    const cancelled = /cancel/i.test(a.status || '');
                    return (
                      <button
                        key={a.id}
                        type="button"
                        className={[styles.appt, styles[toneOf(a.appointment_type_name)], cancelled ? styles.cancelled : ''].join(' ')}
                        onClick={a.patient_id ? () => push('member', { patientId: a.patient_id }) : undefined}
                      >
                        <span className={styles.apptName}>
                          <Icon name={a.mode && /virtual|tele/i.test(a.mode) ? 'solar:videocamera-record-linear' : 'solar:user-linear'} size={16} />
                          {a.patient_name || 'Appointment'}
                        </span>
                        <span className={styles.apptLine}>{a.reason_for_visit || a.appointment_type_name || 'Visit'}</span>
                        <span className={styles.apptLine}>
                          {[`${a.time_start}${a.time_end ? ` - ${a.time_end}` : ''}`, displayAppointmentStatus(a.status)].join(' • ')}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

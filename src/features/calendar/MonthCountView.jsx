import { useMemo } from 'react';
import { Icon } from '../../components/Icon/Icon';
import { OooIcon } from '../../components/Icon/OooIcon';
import { Tooltip } from '../../components/Tooltip/Tooltip';
import { canEdit, recordsFor, recordsOnDate } from '../ooo/oooUtils';
import { HOLIDAY_ICON } from '../holidays/holidayUtils';
import styles from './MonthCountView.module.css';

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const isoToAppt = (s) => { const [y, m, d] = s.split('-'); return `${m}-${d}-${y}`; };

/**
 * Calendar Month view as counts, like the legacy calendar: each day shows
 * its total, then how many appointments and group events, instead of a
 * list of chips that overflows. Sunday-first weeks, including the days of
 * the neighbouring months that complete them; past days are greyed and
 * today is tinted with its date in a purple circle.
 *
 * Out of office: with one user picked, their out-of-office days are dashed
 * pink and say so (click to edit; "+" is hidden as they can't be booked);
 * with everyone, a day shows "N Providers Out of Office".
 *
 * @param {object}   props
 * @param {string}   props.date          – Any ISO date in the month shown
 * @param {object[]} props.appointments  – Already filtered by the toolbar
 * @param {object[]} props.oooRecords
 * @param {string}   [props.focusUser]   – The one user picked, if any
 * @param {object[]} [props.holidays]    – Holidays for what's shown (the user's or filtered locations, else all)
 * @param {boolean}  [props.holidayBlocks] – Holidays block booking here (a user or location is picked)
 * @param {function} props.onOpenDay     – (iso) => void, a day's Day view
 * @param {function} props.onAdd         – (iso) => void, book on that day
 * @param {function} props.onEditOoo     – (record) => void
 * @param {function} props.onOpenOooDay  – (iso) => void, everyone out that day
 */
export function MonthCountView({ date, appointments, oooRecords, holidays = [], holidayBlocks = false, focusUser, onOpenDay, onAdd, onEditOoo, onOpenOooDay }) {
  const todayIso = iso(new Date());
  const weeks = useMemo(() => {
    const [y, m] = date.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const last = new Date(y, m, 0);
    const start = new Date(y, m - 1, 1 - first.getDay());
    const end = new Date(y, m - 1, last.getDate() + (6 - last.getDay()));
    const out = [];
    for (let d = new Date(start); d <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      if (!out.length || out[out.length - 1].length === 7) out.push([]);
      out[out.length - 1].push(iso(d));
    }
    return out;
  }, [date]);

  const counts = useMemo(() => {
    const byDay = {};
    (appointments || []).forEach((a) => {
      const k = a.date;
      if (!k) return;
      const c = byDay[k] || (byDay[k] = { appts: 0, groups: 0 });
      if (/group/i.test(a.appointment_type_name || '')) c.groups += 1; else c.appts += 1;
    });
    return byDay;
  }, [appointments]);

  return (
    <div className={styles.wrap}>
      <div className={styles.dayNames} aria-hidden="true">
        {DAY_NAMES.map(n => <span key={n}>{n}</span>)}
      </div>
      <div className={styles.grid} style={{ '--weeks': weeks.length }}>
        {weeks.flat().map((day) => {
          const c = counts[isoToAppt(day)] || { appts: 0, groups: 0 };
          const past = day < todayIso;
          const isToday = day === todayIso;
          const on = recordsOnDate(oooRecords, day);
          const mine = focusUser ? recordsFor(on, focusUser)[0] : null;
          const othersOut = !focusUser ? new Set(on.map(r => r.userName)).size : 0;
          const dayNum = day.slice(8);
          const dayHolidays = recordsOnDate(holidays, day);
          const blockedByHoliday = holidayBlocks && dayHolidays.length > 0;
          return (
            <div
              key={day}
              className={[styles.cell, past ? styles.past : '', isToday ? styles.today : '', blockedByHoliday && !mine ? styles.holiday : '', mine ? styles.ooo : ''].filter(Boolean).join(' ')}
              role="button"
              tabIndex={0}
              aria-label={`${day}, ${c.appts} appointments, ${c.groups} group events`}
              onClick={() => onOpenDay(day)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenDay(day); } }}
            >
              <div className={styles.cellHead}>
                {!past && !mine && !blockedByHoliday ? (
                  <button
                    type="button"
                    className={styles.add}
                    aria-label={`Schedule on ${day}`}
                    onClick={(e) => { e.stopPropagation(); onAdd(day); }}
                  >
                    <Icon name="solar:add-linear" size={14} color="currentColor" />
                  </button>
                ) : <span />}
                <span className={isToday ? `${styles.dayNum} ${styles.dayNumToday}` : styles.dayNum}>{dayNum}</span>
              </div>
              <span className={styles.total}>{c.appts + c.groups}</span>
              <span className={styles.line}>
                <Icon name="solar:user-linear" size={14} color="var(--neutral-300)" />
                {c.appts} Appointments
              </span>
              <span className={styles.line}>
                <Icon name="solar:users-group-rounded-linear" size={14} color="var(--neutral-300)" />
                {c.groups} Group Events
              </span>
              {mine && (
                canEdit(mine) ? (
                  <Tooltip label="Edit Out of Office Record" followCursor className={styles.oooTip}>
                    <button type="button" className={styles.oooLine} onClick={(e) => { e.stopPropagation(); onEditOoo(mine); }}>
                      <OooIcon size={14} color="var(--accent-magenta)" />
                      Out of Office
                    </button>
                  </Tooltip>
                ) : (
                  <span className={`${styles.oooLine} ${styles.oooLinePast}`}>
                    <OooIcon size={14} color="var(--accent-magenta)" />
                    Out of Office
                  </span>
                )
              )}
              {/* Holidays that day, under any Out of Office line. */}
              {dayHolidays.slice(0, 2).map(h => (
                <span key={h.id} className={styles.holidayLine} title={`Holiday: ${h.name}`}>
                  <Icon name={HOLIDAY_ICON} size={14} color="var(--accent-green)" />
                  <span className={styles.holidayName}>{h.name}</span>
                </span>
              ))}
              {dayHolidays.length > 2 && <span className={styles.line}>+{dayHolidays.length - 2} more holidays</span>}
              {othersOut > 0 && (
                <button type="button" className={styles.oooCount} onClick={(e) => { e.stopPropagation(); onOpenOooDay(day); }}>
                  <OooIcon size={14} color="var(--accent-magenta)" />
                  {othersOut} Provider{othersOut === 1 ? '' : 's'} Out of Office
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

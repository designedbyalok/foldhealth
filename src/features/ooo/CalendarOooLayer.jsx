import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { OooIcon } from '../../components/Icon/OooIcon';
import { Tooltip } from '../../components/Tooltip/Tooltip';
import { Icon } from '../../components/Icon/Icon';
import { HOLIDAY_ICON } from '../holidays/holidayUtils';
import { canEdit, daySpan, recordsFor, recordsOnDate } from './oooUtils';
import styles from './CalendarOooLayer.module.css';

// Must match CalendarContent: dayBoundaries 00:00–23:00 on a 2000px grid.
const GRID_HEIGHT = 2000;
const GRID_HOURS = 23;

/**
 * Out of Office on the Week view (Figma Eventus "Edit OOO Flow"), drawn
 * into schedule-x's grid through portals. Week shows one user: their OOO
 * time is a pink block over each day it touches. A day out for all of it
 * gets an "Out of Office" strip in its header; part of a day is labelled
 * along the top of its block. Existing appointments stay visible and
 * clickable on top. OOO time can't be booked: clicking it opens the record
 * to edit (a past one is read-only). Day and Month views draw their own
 * grids (DayResourceView, MonthCountView).
 *
 * @param {object}   props
 * @param {string}   [props.focusUser]  – The user in view
 * @param {object[]} props.records
 * @param {object[]} [props.holidays] – Holidays at the user's locations (shown green, not bookable)
 * @param {function} [props.onHoliday] – (holiday) => void, a click on holiday time
 * @param {number}   props.renderTick   – Changes whenever schedule-x redraws its grid
 * @param {function} props.onEdit       – (record) => void
 */
export function CalendarOooLayer({ focusUser, records, holidays = [], renderTick, onEdit, onHoliday }) {
  const [targets, setTargets] = useState([]);
  // Latest handler for the native click listeners added below.
  const onEditRef = useRef(onEdit);
  useEffect(() => { onEditRef.current = onEdit; }, [onEdit]);
  const onHolidayRef = useRef(onHoliday);
  useEffect(() => { onHolidayRef.current = onHoliday; }, [onHoliday]);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let timer;
    const hosts = [];
    // Listeners added to the hosts, removed on each redraw and on unmount.
    const disposers = [];

    const collect = () => {
      if (cancelled) return;
      disposers.splice(0).forEach((off) => off());
      const cells = [...document.querySelectorAll('.sx__time-grid-day')];
      if (!cells.length && attempts++ < 60) { timer = setTimeout(collect, 50); return; }
      document.querySelectorAll('[data-ooo-host]').forEach(el => el.remove());
      document.querySelectorAll('[data-ooo-day]').forEach(el => el.removeAttribute('data-ooo-day'));
      document.querySelectorAll('[data-holiday-day]').forEach(el => el.removeAttribute('data-holiday-day'));
      const heads = [...document.querySelectorAll('.sx__week-grid__date')];
      const next = [];
      cells.forEach((cell, i) => {
        const date = heads[i]?.getAttribute('data-date');
        if (!date || !focusUser) return;
        const mine = recordsFor(recordsOnDate(records, date), focusUser);
        const dayHolidays = recordsOnDate(holidays, date);
        if (!mine.length && !dayHolidays.length) return;
        if (getComputedStyle(cell).position === 'static') cell.style.position = 'relative';
        // A day out for all of it gets an "Out of Office" strip at the foot
        // of its header (so the label can't collide with an appointment),
        // and a whole-day holiday a green one; with both, Out of Office sits
        // above. Part of a day is labelled on its block instead.
        const isFullDay = (r) => { const sp = daySpan(r, date); return !!sp && sp.start <= 0 && sp.end >= 1; };
        const fullHoliday = dayHolidays.find(isFullDay);
        const fullOoo = mine.some(isFullDay);
        const addStrip = (kind, extra, payload) => {
          const strip = document.createElement('span');
          strip.setAttribute('data-ooo-host', 'strip');
          strip.className = [styles.stripHost, extra].filter(Boolean).join(' ');
          heads[i].appendChild(strip);
          hosts.push(strip);
          next.push({ host: strip, kind, date, ...payload });
        };
        if (fullHoliday) {
          heads[i].setAttribute('data-holiday-day', '1');
          addStrip('holidayStrip', null, { holiday: fullHoliday });
        }
        if (fullOoo) {
          heads[i].setAttribute('data-ooo-day', '1');
          addStrip('strip', fullHoliday ? styles.stripHostUpper : null, {});
        }
        // Holiday time: green, under any OOO block (drawn first). It can't
        // be booked; a click says why.
        dayHolidays.forEach((holiday) => {
          const span = daySpan(holiday, date);
          if (!span) return;
          const host = document.createElement('div');
          host.setAttribute('data-ooo-host', 'holiday');
          host.className = styles.holidayHost;
          const px = (f) => Math.min(GRID_HEIGHT, f * 24 * (GRID_HEIGHT / GRID_HOURS));
          host.style.top = `${px(span.start)}px`;
          host.style.height = `${Math.max(24, px(span.end) - px(span.start))}px`;
          const onClick = (e) => { e.stopPropagation(); onHolidayRef.current?.(holiday); };
          host.addEventListener('click', onClick);
          disposers.push(() => host.removeEventListener('click', onClick));
          cell.appendChild(host);
          hosts.push(host);
          if (!isFullDay(holiday)) next.push({ host, kind: 'holidayLabel', date, holiday, record: holiday });
          next.push({ host, kind: 'holidayTip', date, holiday, record: holiday });
        });
        mine.forEach((record) => {
          const span = daySpan(record, date);
          if (!span) return;
          const host = document.createElement('div');
          host.setAttribute('data-ooo-host', 'block');
          host.className = styles.blockHost;
          // A past record is read-only: no lift, no pointer.
          if (!canEdit(record)) host.classList.add(styles.blockHostPast);
          const px = (f) => Math.min(GRID_HEIGHT, f * 24 * (GRID_HEIGHT / GRID_HOURS));
          host.style.top = `${px(span.start)}px`;
          host.style.height = `${Math.max(24, px(span.end) - px(span.start))}px`;
          host.style.bottom = 'auto';
          // OOO time can't be booked: a click on it opens the record to
          // edit instead. Native and stopped here, since schedule-x listens
          // on the grid cell itself, before React's root listener would run.
          // (The "new appointment" hover preview skips OOO time itself, see
          // useCalendarView, so the tooltip can follow the pointer here.)
          const onClick = (e) => {
            e.stopPropagation();
            if (canEdit(record)) onEditRef.current(record);
          };
          host.addEventListener('click', onClick);
          disposers.push(() => host.removeEventListener('click', onClick));
          // Reachable by keyboard like the Day view's blocks: Enter or Space opens it.
          if (canEdit(record)) {
            host.setAttribute('role', 'button');
            host.tabIndex = 0;
            host.setAttribute('aria-label', `Edit ${focusUser}'s Out of Office record`);
            const onKey = (e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              e.stopPropagation();
              onEditRef.current(record);
            };
            host.addEventListener('keydown', onKey);
            disposers.push(() => host.removeEventListener('keydown', onKey));
          }
          cell.appendChild(host);
          hosts.push(host);
          // A part-day block is labelled along its top; an editable one
          // also gets a hover tooltip.
          if (!isFullDay(record)) next.push({ host, kind: 'blockLabel', date, record });
          if (canEdit(record)) next.push({ host, kind: 'blockTip', date, record });
        });
      });
      if (cancelled) return;
      setTargets(next);
    };
    // After schedule-x has committed its grid (see handleRangeUpdate).
    timer = setTimeout(collect, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      disposers.forEach((off) => off());
      hosts.forEach(h => h.remove());
    };
  }, [focusUser, records, holidays, renderTick]);

  return targets.map((t) => createPortal(
    t.kind === 'holidayStrip' || t.kind === 'holidayLabel' ? (
      <span className={styles.holidayStrip}>
        <Icon name={HOLIDAY_ICON} size={12} color="var(--neutral-0)" />
        <span className={styles.stripText}>{t.holiday.name}</span>
      </span>
    ) : t.kind === 'holidayTip' ? (
      <Tooltip label={`Holiday: ${t.holiday.name}`} followCursor>
        <span className={styles.blockTipArea} aria-hidden="true" />
      </Tooltip>
    ) : t.kind === 'blockTip' ? (
      <Tooltip label="Edit Out of Office Record" followCursor>
        <span className={styles.blockTipArea} aria-hidden="true" />
      </Tooltip>
    ) : (
      <span className={styles.oooStrip}>
        <OooIcon size={12} color="var(--neutral-0)" arrowColor="var(--accent-magenta)" />
        Out of Office
      </span>
    ),
    t.host,
    `${t.kind}-${t.date}-${t.record?.id || ''}`,
  ));
}

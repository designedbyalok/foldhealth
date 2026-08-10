import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { FALLBACK_APPOINTMENT_TYPES } from '../../components/ScheduleDrawer/scheduleDrawerConstants';
import { useAppStore } from '../../store/useAppStore';
import { supabase } from '../../lib/supabase';
import {
  BROWSER_TIMEZONE,
  getNowInTimezone,
  getTodayInTimezone,
  getTimezoneOffset,
  MONTH_NAMES,
} from './calendarUtils';
import styles from './CalendarView.module.css';

export function useCalendarView() {
  const [currentView, setCurrentView] = useState('week');
  const [showSchedule, setShowSchedule] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const calendarRef = useRef(null);
  const eventsPluginRef = useRef(null);
  const [timezone, setTimezone] = useState(BROWSER_TIMEZONE);
  const timezoneLabel = getTimezoneOffset(timezone);

  const [calendarTitle, setCalendarTitle] = useState(() => {
    const today = getTodayInTimezone(timezone);
    const [y, m] = today.split('-');
    return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
  });

  const [filterUser, setFilterUser] = useState([]);
  const [filterLocation, setFilterLocation] = useState([]);
  const [filterType, setFilterType] = useState([]);
  const [filterStatus, setFilterStatus] = useState([]);

  const appointments = useAppStore(s => s.appointments);
  const appointmentTypes = useAppStore(s => s.appointmentTypes);
  const fetchAppointments = useAppStore(s => s.fetchAppointments);
  const fetchAppointmentTypes = useAppStore(s => s.fetchAppointmentTypes);
  const showToast = useAppStore(s => s.showToast);

  useEffect(() => {
    fetchAppointments();
    fetchAppointmentTypes();
  }, []);

  const apptTypesForFilter = appointmentTypes.length > 0 ? appointmentTypes : FALLBACK_APPOINTMENT_TYPES;

  const [users, setUsers] = useState([]);
  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, full_name, email, status')
      .order('full_name')
      .then(({ data }) => {
        if (data?.length) {
          setUsers(data.map(u => ({
            id: u.id,
            name: u.full_name?.trim() || u.email?.split('@')[0] || 'Unknown',
          })));
        }
      });
  }, []);

  const filteredAppointments = useMemo(() => {
    let filtered = appointments || [];
    if (filterUser.length > 0) {
      const userSet = new Set(filterUser);
      filtered = filtered.filter(a => userSet.has(a.primary_user));
    }
    if (filterType.length > 0) {
      const typeSet = new Set(filterType);
      filtered = filtered.filter(a => typeSet.has(a.appointment_type_name));
    }
    return filtered;
  }, [appointments, filterUser, filterType, users]);

  const handleViewChange = (view) => {
    setCurrentView(view);
    const app = calendarRef.current;
    if (app?.$app?.calendarState) {
      const selectedDate = app.$app.datePickerState?.selectedDate?.value || new Date().toISOString().split('T')[0];
      app.$app.calendarState.setView(view, selectedDate);
    }
  };

  const updateTitle = useCallback(() => {
    const app = calendarRef.current;
    if (!app?.$app) return;
    const dateVal = app.$app.datePickerState?.selectedDate?.value;
    if (dateVal) {
      const m = typeof dateVal.month === 'number' ? dateVal.month - 1 : new Date().getMonth();
      const y = typeof dateVal.year === 'number' ? dateVal.year : new Date().getFullYear();
      setCalendarTitle(`${MONTH_NAMES[m]} ${y}`);
    }
  }, []);

  const applyPastOverlays = useCallback(() => {
    const today = getTodayInTimezone(timezone);
    document.querySelectorAll('.sx__week-grid__date').forEach(dateEl => {
      const dateStr = dateEl.getAttribute('data-date');
      dateEl.style.opacity = (dateStr && dateStr < today) ? '0.4' : '';
    });
    document.querySelectorAll('.sx__time-grid-day').forEach((dayCol, i) => {
      dayCol.querySelectorAll('[data-past-overlay]').forEach(el => el.remove());
      const dateEls = document.querySelectorAll('.sx__week-grid__date');
      const dateStr = dateEls[i]?.getAttribute('data-date');
      if (dateStr && dateStr < today) {
        const overlay = document.createElement('div');
        overlay.setAttribute('data-past-overlay', '1');
        overlay.className = styles.pastDayOverlay;
        dayCol.appendChild(overlay);
      }
    });
    document.querySelectorAll('.sx__date-grid-day').forEach(cell => {
      cell.querySelectorAll('[data-past-overlay]').forEach(el => el.remove());
      const dateStr = cell.getAttribute('data-date');
      if (dateStr && dateStr < today) {
        cell.style.opacity = '0.5';
      } else {
        cell.style.opacity = '';
      }
    });
  }, [timezone]);

  const applyTimeIndicator = useCallback(() => {
    const START_HOUR = 0, END_HOUR = 23, GRID_HEIGHT = 2000;
    const weekGridEl = document.querySelector('.sx__week-grid');
    if (!weekGridEl) return;
    weekGridEl.querySelectorAll('[data-time-indicator]').forEach(el => el.remove());
    const { hours, minutes } = getNowInTimezone(timezone);
    const totalMinutesFromStart = (hours - START_HOUR) * 60 + minutes;
    if (totalMinutesFromStart >= 0 && totalMinutesFromStart <= (END_HOUR - START_HOUR) * 60) {
      const topPx = (totalMinutesFromStart / ((END_HOUR - START_HOUR) * 60)) * GRID_HEIGHT;
      const line = document.createElement('div');
      line.setAttribute('data-time-indicator', '1');
      line.className = styles.currentTimeLine;
      line.style.top = `${topPx}px`;
      weekGridEl.appendChild(line);
    }
  }, [timezone]);

  const handleToday = () => {
    const app = calendarRef.current;
    if (!app?.$app) return;
    const T = globalThis.Temporal;
    if (T) {
      app.$app.datePickerState.selectedDate.value = T.Now.plainDateISO(timezone);
      setTimeout(() => { updateTitle(); applyPastOverlays(); applyTimeIndicator(); }, 50);
    }
  };

  const navigateCalendar = useCallback((direction) => {
    const app = calendarRef.current;
    if (!app?.$app) return;
    const $app = app.$app;
    const currentViewConfig = $app.config.views.value.find(v => v.name === $app.calendarState.view.value);
    if (!currentViewConfig) return;
    const units = direction === 'forward' ? currentViewConfig.backwardForwardUnits : -currentViewConfig.backwardForwardUnits;
    $app.datePickerState.selectedDate.value = currentViewConfig.backwardForwardFn($app.datePickerState.selectedDate.value, units);
  }, []);

  const handlePrev = () => { navigateCalendar('backward'); setTimeout(() => { updateTitle(); applyPastOverlays(); applyTimeIndicator(); }, 50); };
  const handleNext = () => { navigateCalendar('forward'); setTimeout(() => { updateTitle(); applyPastOverlays(); applyTimeIndicator(); }, 50); };

  const clearSelection = useCallback(() => {
    const ep = eventsPluginRef.current;
    if (ep) {
      try { ep.remove('__selection__'); } catch {}
    }
  }, []);

  const [clickedAppointment, setClickedAppointment] = useState(null);
  const eventClickRef = useRef(false);

  const handleSlotClick = useCallback((dateTime) => {
    if (eventClickRef.current) return;

    const T = globalThis.Temporal;
    if (T && dateTime?.epochMilliseconds) {
      const now = T.Now.zonedDateTimeISO(timezone);
      const minTime = now.add({ minutes: 15 });
      if (dateTime.epochMilliseconds < minTime.epochMilliseconds) {
        showToast('Cannot book in the past. Appointment must be at least 15 minutes from now.');
        return;
      }
    }

    const ep = eventsPluginRef.current;
    if (ep && T && dateTime?.add) {
      const clickStart = dateTime.epochMilliseconds;
      const clickEnd = dateTime.add({ minutes: 30 }).epochMilliseconds;
      try {
        const allEvents = ep.getAll();
        const hasOverlap = allEvents.some(e => {
          if (e.id === '__selection__') return false;
          return clickStart < e.end.epochMilliseconds && clickEnd > e.start.epochMilliseconds;
        });
        if (hasOverlap) return;
      } catch {}
    }

    setClickedAppointment(null);
    setSelectedSlot(dateTime);
    setShowSchedule(true);

    if (ep && T && dateTime?.add) {
      clearSelection();
      const end = dateTime.add({ minutes: 30 });
      ep.add({
        id: '__selection__',
        start: dateTime,
        end,
        title: 'New Appointment',
        calendarId: 'selection',
      });
    }
  }, [clearSelection]);

  const handleEventClick = useCallback((event) => {
    eventClickRef.current = true;
    setTimeout(() => { eventClickRef.current = false; }, 100);
    const appt = appointments.find(a => a.id === event.id);
    setClickedAppointment(appt || null);
    setSelectedSlot(event.start);
    setShowSchedule(true);
  }, [appointments]);

  const handleCloseDrawer = useCallback(() => {
    setShowSchedule(false);
    setClickedAppointment(null);
    clearSelection();
    const applyCancelled = () => {
      const store = useAppStore.getState();
      for (const a of (store.appointments || [])) {
        if (a.status !== 'Cancelled') continue;
        const el = document.querySelector(`[data-event-id="${a.id}"]`);
        if (el && !el.classList.contains('is-cancelled')) el.classList.add('is-cancelled');
      }
    };
    setTimeout(applyCancelled, 300);
    setTimeout(applyCancelled, 800);
    setTimeout(applyCancelled, 1500);
  }, [clearSelection]);

  const hoverRef = useRef(null);
  useEffect(() => {
    const START_HOUR = 0;
    const END_HOUR = 23;
    const GRID_HEIGHT = 2000;
    const TOTAL_HOURS = END_HOUR - START_HOUR;
    const PX_PER_HOUR = GRID_HEIGHT / TOTAL_HOURS;
    const PX_PER_30 = PX_PER_HOUR / 2;

    function formatTime(h, m) {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
    }

    function getOrCreateOverlay() {
      if (hoverRef.current) return hoverRef.current;
      const el = document.createElement('div');
      el.className = styles.hoverPreview;
      hoverRef.current = el;
      return el;
    }

    function handleMove(e) {
      if (e.target.closest('.sx__event')) {
        const overlay = hoverRef.current;
        if (overlay) overlay.style.opacity = '0';
        return;
      }
      const col = e.currentTarget;
      const rect = col.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const slotIndex = Math.floor(y / PX_PER_30);
      const snappedY = slotIndex * PX_PER_30;
      const totalMinutes = (START_HOUR * 60) + (slotIndex * 30);
      const startH = Math.floor(totalMinutes / 60);
      const startM = totalMinutes % 60;
      const endH = Math.floor((totalMinutes + 30) / 60);
      const endM = (totalMinutes + 30) % 60;

      if (startH >= END_HOUR) return;

      const overlay = getOrCreateOverlay();
      if (overlay.parentElement !== col) col.appendChild(overlay);
      overlay.style.top = `${snappedY}px`;
      overlay.style.height = `${PX_PER_30}px`;
      overlay.textContent = `${formatTime(startH, startM)} – ${formatTime(endH, endM)}`;
      overlay.style.opacity = '1';
    }

    function handleLeave() {
      const overlay = hoverRef.current;
      if (overlay) overlay.style.opacity = '0';
    }

    // Remember the exact nodes we subscribed to. Re-querying at cleanup time
    // can return a different set once schedule-x has re-rendered the grid,
    // which would leave the original listeners attached forever.
    let subscribedDays = [];

    const timer = setTimeout(() => {
      subscribedDays = Array.from(document.querySelectorAll('.sx__time-grid-day'));
      subscribedDays.forEach(day => {
        day.addEventListener('mousemove', handleMove);
        day.addEventListener('mouseleave', handleLeave);
      });

      const weekGrid = document.querySelector('.sx__week-grid');
      document.querySelectorAll('[data-tz-label]').forEach(el => el.remove());
      if (weekGrid) {
        const tzEl = document.createElement('div');
        tzEl.setAttribute('data-tz-label', '1');
        tzEl.className = styles.timezoneLabel;
        tzEl.textContent = timezoneLabel;
        weekGrid.insertBefore(tzEl, weekGrid.firstChild);
      }

      applyPastOverlays();
      applyTimeIndicator();

      const { hours: nowH, minutes: nowM } = getNowInTimezone(timezone);
      const totalMin = (nowH - START_HOUR) * 60 + nowM;
      if (totalMin > 0) {
        const scrollTarget = (totalMin / ((END_HOUR - START_HOUR) * 60)) * GRID_HEIGHT - 200;
        const wrap = document.querySelector('[class*="calendarWrap"]');
        if (wrap) wrap.scrollTop = Math.max(0, scrollTarget);
      }
    }, 800);

    return () => {
      clearTimeout(timer);
      subscribedDays.forEach(day => {
        day.removeEventListener('mousemove', handleMove);
        day.removeEventListener('mouseleave', handleLeave);
      });
      subscribedDays = [];
      if (hoverRef.current?.parentElement) {
        hoverRef.current.parentElement.removeChild(hoverRef.current);
      }
      hoverRef.current = null;
    };
  }, [currentView, timezone, timezoneLabel, applyPastOverlays, applyTimeIndicator]);

  return {
    calendarTitle,
    currentView,
    showSchedule,
    selectedSlot,
    calendarRef,
    eventsPluginRef,
    timezone,
    timezoneLabel,
    filterUser,
    filterLocation,
    filterType,
    filterStatus,
    users,
    apptTypesForFilter,
    filteredAppointments,
    clickedAppointment,
    fetchAppointments,
    setFilterUser,
    setFilterLocation,
    setFilterType,
    setFilterStatus,
    setTimezone,
    handleViewChange,
    handleToday,
    handlePrev,
    handleNext,
    handleSlotClick,
    handleEventClick,
    handleCloseDrawer,
  };
}

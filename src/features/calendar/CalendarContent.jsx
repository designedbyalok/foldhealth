import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { DEFAULT_CALENDARS, apptToEvent } from './calendarUtils';
import { WeekGridDate } from './WeekGridDate';

// Kept at module level: the wrapper re-registers whenever this object changes.
const CUSTOM_COMPONENTS = { weekGridDate: WeekGridDate };

export function CalendarContent({ onSlotClick, onEventClick, onRangeUpdate, calendarRef, eventsPluginRef, dbAppointments }) {
  const [calendarApp, setCalendarApp] = useState(null);
  const [SXCalendar, setSXCalendar] = useState(null);
  const [error, setError] = useState(null);
  const internalPluginRef = useRef(null);
  const resolvedTheme = useAppStore(s => s.resolvedTheme);

  // Use refs for callbacks so the calendar always calls the latest handlers
  const slotClickRef = useRef(onSlotClick);
  const eventClickRef = useRef(onEventClick);
  const rangeUpdateRef = useRef(onRangeUpdate);
  useEffect(() => {
    slotClickRef.current = onSlotClick;
    eventClickRef.current = onEventClick;
    rangeUpdateRef.current = onRangeUpdate;
  });

  // Initialize calendar ONCE
  useEffect(() => {
    (async () => {
      try {
        // Load everything in parallel: awaiting these one by one made the
        // initial "Loading calendar..." state last the sum of all fetches.
        const [temporalMod, calMod, reactMod, eventsMod] = await Promise.all([
          import('temporal-polyfill'),
          import('@schedule-x/calendar'),
          import('@schedule-x/react'),
          import('@schedule-x/events-service'),
          import('@schedule-x/theme-default/dist/index.css'),
        ]);
        if (typeof globalThis.Temporal === 'undefined') {
          globalThis.Temporal = temporalMod.Temporal;
        }

        const eventsPlugin = eventsMod.createEventsServicePlugin();

        // Read current theme from the html data-theme attribute so init matches
        // whatever the rest of the app is showing right now.
        const initialDark = document.documentElement.getAttribute('data-theme') === 'dark';

        const app = calMod.createCalendar({
          views: [calMod.createViewWeek(), calMod.createViewDay(), calMod.createViewMonthGrid()],
          defaultView: 'week',
          events: [],
          calendars: DEFAULT_CALENDARS,
          isDark: initialDark,
          // Our toolbar tabs own the view. Without this, schedule-x measures
          // the wrapper on mount, 0px if it mounts mid-layout, decides the
          // calendar is "small" and silently hijacks week view into day view.
          isResponsive: false,
          dayBoundaries: { start: '00:00', end: '23:00' },
          weekOptions: { gridHeight: 2000, nDays: 7 },
          locale: 'en-US',
          callbacks: {
            onClickDateTime: (dateTime, e) => { if (slotClickRef.current) slotClickRef.current(dateTime, e); },
            onClickDate: (date, e) => { if (slotClickRef.current) slotClickRef.current(date, e); },
            onEventClick: (event) => { if (eventClickRef.current && event.id !== '__selection__') eventClickRef.current(event); },
            // Fires on every navigation and view change, the hook uses it to
            // repaint the past-day overlays, the now-line and the title
            // instead of guessing with a timeout after each nav click.
            onRangeUpdate: () => { if (rangeUpdateRef.current) rangeUpdateRef.current(); },
          },
        }, [eventsPlugin]);

        // Publish the plugin only once createCalendar has succeeded. The
        // plugin's events facade is built in its beforeRender hook, so a
        // plugin exposed before a failed init looks usable but throws on
        // first use: and the events effect below would crash the tree
        // before the `error` branch could render.
        calendarRef.current = app;
        internalPluginRef.current = eventsPlugin;
        if (eventsPluginRef) eventsPluginRef.current = eventsPlugin;
        setSXCalendar(() => reactMod.ScheduleXCalendar);
        setCalendarApp(app);
      } catch (err) {
        console.error('Schedule-X init error:', err);
        setError(err.message);
      }
    })();
  }, []);

  // Sync schedule-x theme when the app theme flips (light/dark/system).
  useEffect(() => {
    if (!calendarApp) return;
    try {
      // schedule-x exposes a `setTheme('light' | 'dark')` on the calendar instance.
      if (typeof calendarApp.setTheme === 'function') {
        calendarApp.setTheme(resolvedTheme === 'dark' ? 'dark' : 'light');
      }
    } catch (err) {
      console.warn('Failed to set schedule-x theme:', err);
    }
  }, [resolvedTheme, calendarApp]);

  // Sync events dynamically when DB data changes (without recreating calendar).
  // Depends on calendarApp as well as the data: the calendar initialises
  // asynchronously, so appointments that arrive first would otherwise be
  // dropped by the `!ep` guard and never re-synced.
  useEffect(() => {
    const ep = internalPluginRef.current;
    const T = globalThis.Temporal;
    if (!ep || !T) return;

    // Use UTC for event positioning: times are stored as wall-clock strings
    // and should always appear at the literal time position on the calendar
    // Guard the conversion, not the insert: apptToEvent parses the stored
    // date/time strings via Temporal, which throws on a malformed row. One bad
    // row used to take down the whole calendar; now it just skips that row.
    const newEvents = (dbAppointments || []).flatMap(a => {
      try {
        const ev = apptToEvent(a, T, 'UTC');
        return ev ? [ev] : [];
      } catch (err) {
        console.warn('Skipping appointment with an unparseable date/time', a.id, a.date, a.time_start, err);
        return [];
      }
    });

    // Replace all events (except __selection__) with fresh DB events
    for (const e of ep.getAll()) {
      if (e.id !== '__selection__') ep.remove(e.id);
    }
    for (const e of newEvents) {
      // add() validates the event and rejects ids outside [a-zA-Z0-9_-].
      // Skip the offender rather than losing every later event in the loop.
      try { ep.add(e); } catch (err) {
        console.warn('Appointment rejected by the calendar', e.id, err);
      }
    }

    // Cancelled events carry their own class via _options.additionalClasses
    // (see apptToEvent), so there is nothing to re-apply after render.
  }, [dbAppointments, calendarApp]);

  if (error) return <div style={{ padding: 32, color: 'var(--status-error)', fontFamily: 'Inter' }}>Calendar error: {error}</div>;
  if (!calendarApp || !SXCalendar) return <div style={{ padding: 32, color: 'var(--neutral-300)', textAlign: 'center', fontFamily: 'Inter' }}>Loading calendar...</div>;

  return <SXCalendar calendarApp={calendarApp} customComponents={CUSTOM_COMPONENTS} />;
}

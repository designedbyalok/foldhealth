import { useEffect, useMemo, useRef, useState } from 'react';
import { ScheduleDrawer } from '../../components/ScheduleDrawer/ScheduleDrawer';
import { CalendarContent } from './CalendarContent';
import { CalendarToolbar } from './CalendarToolbar';
import { DayResourceView } from './DayResourceView';
import { MonthCountView } from './MonthCountView';
import { HolidaysDrawer } from '../holidays/HolidaysDrawer';
import { holidaysAt, holidaysForUser } from '../holidays/holidayUtils';
import { useCalendarView } from './useCalendarView';
import { useAppStore } from '../../store/useAppStore';
import { CalendarOooLayer } from '../ooo/CalendarOooLayer';
import { CalendarAvailabilityLayer } from './CalendarAvailabilityLayer';
import { AppointmentListView } from './list/AppointmentListView';
import { OooAllRecordsDrawer } from '../ooo/OooRecordsDrawers';
import { apptPerson, personKey, recordPerson, recordsOnDate, samePerson } from '../ooo/oooUtils';
import { useOooRecordActions } from '../ooo/useOooRecordActions';
import styles from './CalendarView.module.css';

export function CalendarView() {
  // A click on out-of-office time opens that record (the actions hook needs
  // the calendar's users, so it's wired through a ref).
  const editOooRef = useRef(null);
  const calendar = useCalendarView({ onOooSlot: (record) => editOooRef.current?.(record) });
  const oooRecords = useAppStore(s => s.oooRecords);
  // Out of Office: everyone's records, from a Month day's "Providers Out of
  // Office" link, with that day highlighted.
  const [oooAll, setOooAll] = useState(null); // { highlightDate? , highlightId? }
  const oooActions = useOooRecordActions({ users: calendar.users });
  useEffect(() => { editOooRef.current = oooActions.openEdit; });
  const showToast = useAppStore(s => s.showToast);
  const isList = calendar.layout === 'list';
  const isDay = !isList && calendar.currentView === 'day';
  const isMonth = !isList && calendar.currentView === 'month-grid';
  const isWeek = !isList && calendar.currentView === 'week';
  // Week and a one-user Month show that user's OOO time on the grid; Day
  // draws its own per-user columns.
  // { id, name }, kept stable while the same person is in view.
  const focusKey = calendar.currentView === 'week'
    ? calendar.viewUsers[0] || null
    : calendar.filterUser.length === 1 ? calendar.filterUser[0] : null;
  const { personFor } = calendar;
  const focusUser = useMemo(() => (focusKey ? personFor(focusKey) : null), [focusKey, personFor]);
  const [dayProvider, setDayProvider] = useState(null);
  // Holidays apply by location: the shown provider's, else (Month) the
  // Location filter's; with neither, Month shows every holiday but none
  // blocks booking.
  const holidayConfigs = useAppStore(s => s.holidayConfigs);
  const fetchHolidayConfigs = useAppStore(s => s.fetchHolidayConfigs);
  const platformUsers = useAppStore(s => (s.platformPeople?.length ? s.platformPeople : s.platformUsers));
  useEffect(() => { fetchHolidayConfigs(); }, [fetchHolidayConfigs]);
  const [showHolidays, setShowHolidays] = useState(false);
  // "Show available slots": shade what the user in view can't be booked for.
  const showAvailable = calendar.layout === 'availability';
  // List view: all provider groups open or closed.
  const [listGroups, setListGroups] = useState('expanded');

  // "View Appointments" on a reassignment notification: my appointments in
  // the List view, on the week of the first one moved to me, with the moved
  // ones highlighted for 3 seconds.
  const calendarFocus = useAppStore(s => s.calendarFocus);
  const clearCalendarFocus = useAppStore(s => s.clearCalendarFocus);
  const me = useAppStore(s => s.currentUserProfile);
  const [highlightIds, setHighlightIds] = useState(null);
  const { setLayout, setFilterUser, goToDate, calendarRef } = calendar;
  /* eslint-disable react-hooks/set-state-in-effect --
   * `calendarFocus` is a one-shot signal from the store (the notification
   * sets it); we consume it and clear it, as useCalendarView does with
   * pendingOpenAppointmentId.
   */
  useEffect(() => {
    if (!calendarFocus) return undefined;
    clearCalendarFocus();
    setLayout('list');
    if (me?.id) setFilterUser([String(me.id)]);
    setHighlightIds(new Set(calendarFocus.ids));
    // schedule-x owns the date and loads a beat after the page; wait for it.
    let tries = 0;
    let dateTimer;
    const moveDate = () => {
      if (!calendarFocus.date) return;
      if (calendarRef.current?.$app || tries++ > 30) goToDate(calendarFocus.date);
      else dateTimer = setTimeout(moveDate, 100);
    };
    moveDate();
    const fade = setTimeout(() => setHighlightIds(null), 3000);
    return () => { clearTimeout(dateTimer); clearTimeout(fade); };
  }, [calendarFocus]); // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */
  const segments = useAppStore(s => s.userAvailability);
  const fetchUserAvailability = useAppStore(s => s.fetchUserAvailability);
  useEffect(() => { if (showAvailable) fetchUserAvailability?.(); }, [showAvailable, fetchUserAvailability]);
  const scopedHolidays = useMemo(() => {
    if (focusUser) return holidaysForUser(holidayConfigs, platformUsers, focusUser, calendar.filterLocation);
    if (calendar.filterLocation.length) return holidaysAt(holidayConfigs, calendar.filterLocation);
    return holidayConfigs;
  }, [focusUser, holidayConfigs, platformUsers, calendar.filterLocation]);
  const holidayBlocks = !!focusUser || calendar.filterLocation.length > 0;

  // Day columns, one per person: the picked users, else everyone with an
  // appointment or an OOO record that day, else the signed-in user.
  const dayUsers = useMemo(() => {
    if (!isDay) return [];
    if (calendar.filterUser.length) return calendar.viewPeople;
    const [y, m, d] = calendar.selectedDate.split('-');
    const booked = calendar.filteredAppointments.filter(a => a.date === `${m}-${d}-${y}`).map(apptPerson);
    const away = recordsOnDate(oooRecords, calendar.selectedDate).map(recordPerson);
    const byKey = new Map();
    [...booked, ...away].filter(p => p.name).forEach((p) => {
      // A row without an id (older data) is shown as whoever has that name.
      const known = p.id ? personFor(p.id) : calendar.users.find(u => samePerson(u, p));
      const who = known && known.name ? known : p;
      byKey.set(personKey(who), who);
    });
    const people = [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
    return people.length ? people : [calendar.users.find(u => u.name === calendar.meName)].filter(Boolean);
  }, [isDay, calendar.filterUser, calendar.viewPeople, calendar.selectedDate, calendar.filteredAppointments, calendar.users, oooRecords, calendar.meName, personFor]);

  return (
    <div className={styles.wrapper}>
      <CalendarToolbar
        selectedDate={calendar.selectedDate}
        onToday={calendar.handleToday}
        onPickDate={calendar.goToDate}
        currentView={calendar.currentView}
        onViewChange={calendar.handleViewChange}
        layout={calendar.layout}
        onLayoutChange={calendar.setLayout}
        listGroups={listGroups}
        onListGroupsChange={setListGroups}
        onPrev={calendar.handlePrev}
        onNext={calendar.handleNext}
        users={calendar.users}
        filterUser={isWeek ? calendar.viewUsers : calendar.filterUser}
        onFilterUserChange={calendar.setFilterUser}
        filterLocation={calendar.filterLocation}
        onFilterLocationChange={calendar.setFilterLocation}
        apptTypesForFilter={calendar.apptTypesForFilter}
        filterType={calendar.filterType}
        onFilterTypeChange={calendar.setFilterType}
        filterStatus={calendar.filterStatus}
        onFilterStatusChange={calendar.setFilterStatus}
        onOpenOoo={() => setOooAll({})}
        onOpenHolidays={() => setShowHolidays(true)}
        onRefresh={() => calendar.fetchAppointments({ force: true })}
        onScheduleSelect={(key) => {
          if (key === 'appointment') {
            setDayProvider(null);
            calendar.setClickedAppointment(null);
            calendar.setSelectedSlot(null);
            calendar.setShowSchedule(true);
          } else if (key === 'ooo') {
            oooActions.openNew();
          } else if (key === 'reassign') {
            oooActions.openReassign(focusUser || undefined);
          } else {
            showToast('Coming soon');
          }
        }}
      />

      {isDay && (
        <DayResourceView
          date={calendar.selectedDate}
          users={dayUsers}
          appointments={calendar.filteredAppointments}
          oooRecords={oooRecords}
          holidays={holidayConfigs}
          people={platformUsers}
          holidayLocations={calendar.filterLocation}
          timezoneLabel={calendar.timezoneLabel}
          onSlotClick={(slot, person) => {
            setDayProvider(person);
            calendar.setClickedAppointment(null);
            calendar.setSelectedSlot(slot);
            calendar.setShowSchedule(true);
          }}
          onEventClick={(appt) => {
            setDayProvider(null);
            calendar.setClickedAppointment(appt);
            calendar.setShowSchedule(true);
          }}
          onEditOoo={oooActions.openEdit}
          onBlocked={showToast}
        />
      )}
      {isList && (
        <AppointmentListView
          appointments={calendar.filteredAppointments}
          view={calendar.currentView}
          selectedDate={calendar.selectedDate}
          users={calendar.users}
          groupsMode={listGroups}
          highlightIds={highlightIds}
          onViewDetails={(appt) => {
            setDayProvider(null);
            calendar.setClickedAppointment(appt);
            calendar.setShowSchedule(true);
          }}
        />
      )}
      {isWeek && calendar.viewUsers[0] && (
        <div className={styles.weekUserRow}><span aria-hidden="true" /><span>{focusUser?.name}</span></div>
      )}
      {/* Month: daily counts, like the legacy calendar (the chip list
          overflowed into "+N more"). */}
      {isMonth && (
        <MonthCountView
          date={calendar.selectedDate}
          appointments={calendar.filteredAppointments}
          oooRecords={oooRecords}
          holidays={scopedHolidays}
          holidayBlocks={holidayBlocks}
          focusUser={focusUser}
          onOpenDay={calendar.openDay}
          onAdd={(day) => {
            const [year, month, d] = day.split('-').map(Number);
            setDayProvider(calendar.filterUser.length === 1 ? personFor(calendar.filterUser[0]) : null);
            calendar.handleSlotClick({ year, month, day: d });
          }}
          onOpenOooDay={(date) => setOooAll({ highlightDate: date })}
          onOpenOooRecord={(r) => setOooAll({ highlightId: r.id })}
        />
      )}
      {/* schedule-x stays mounted in Day and Month views (it owns the date
          and the toolbar's navigation), just hidden behind our own grids. */}
      <div className={isWeek ? styles.calendarWrap : `${styles.calendarWrap} ${styles.calendarHidden}`}>
        <CalendarContent
          onSlotClick={calendar.handleSlotClick}
          onEventClick={calendar.handleEventClick}
          onRangeUpdate={calendar.handleRangeUpdate}
          calendarRef={calendar.calendarRef}
          eventsPluginRef={calendar.eventsPluginRef}
          dbAppointments={calendar.filteredAppointments}
        />
        {calendar.currentView === 'week' && showAvailable && (
          <CalendarAvailabilityLayer
            focusUser={focusUser}
            segments={segments}
            holidays={scopedHolidays}
            renderTick={`${calendar.renderTick}-${calendar.filteredAppointments.length}`}
          />
        )}
        {calendar.currentView === 'week' && (
          <CalendarOooLayer
            focusUser={focusUser}
            records={oooRecords}
            holidays={scopedHolidays}
            onHoliday={(h) => showToast(`${h.name} is a holiday here, so appointments can't be booked then.`)}
            renderTick={`${calendar.renderTick}-${calendar.filteredAppointments.length}`}
            onEdit={oooActions.openEdit}
          />
        )}
      </div>

      {showHolidays && <HolidaysDrawer onClose={() => setShowHolidays(false)} />}
      {oooAll && <OooAllRecordsDrawer highlightDate={oooAll.highlightDate} highlightId={oooAll.highlightId} onClose={() => setOooAll(null)} />}
      {oooActions.elements}
      {calendar.showSchedule && (
        <ScheduleDrawer
          selectedSlot={calendar.selectedSlot}
          existingAppointment={calendar.clickedAppointment}
          initialProvider={dayProvider || undefined}
          onClose={() => { setDayProvider(null); calendar.handleCloseDrawer(); }}
          onSave={() => calendar.fetchAppointments({ force: true })}
          timezoneLabel={calendar.timezoneLabel}
          source="calendar"
        />
      )}
    </div>
  );
}

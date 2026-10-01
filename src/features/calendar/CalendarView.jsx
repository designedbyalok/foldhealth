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
import { OooAllRecordsDrawer } from '../ooo/OooRecordsDrawers';
import { recordsOnDate } from '../ooo/oooUtils';
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
  const [oooAll, setOooAll] = useState(null); // { highlightDate? }
  const oooActions = useOooRecordActions({ users: calendar.users });
  useEffect(() => { editOooRef.current = oooActions.openEdit; });
  const showToast = useAppStore(s => s.showToast);
  const isDay = calendar.currentView === 'day';
  const isMonth = calendar.currentView === 'month-grid';
  // Week and a one-user Month show that user's OOO time on the grid; Day
  // draws its own per-user columns.
  const focusUser = calendar.currentView === 'week'
    ? calendar.viewUsers[0] || null
    : calendar.filterUser.length === 1 ? calendar.filterUser[0] : null;
  const [dayProvider, setDayProvider] = useState(null);
  // Holidays apply by location: the shown provider's, else (Month) the
  // Location filter's; with neither, Month shows every holiday but none
  // blocks booking.
  const holidayConfigs = useAppStore(s => s.holidayConfigs);
  const fetchHolidayConfigs = useAppStore(s => s.fetchHolidayConfigs);
  const platformUsers = useAppStore(s => s.platformUsers);
  useEffect(() => { fetchHolidayConfigs(); }, [fetchHolidayConfigs]);
  const [showHolidays, setShowHolidays] = useState(false);
  const scopedHolidays = useMemo(() => {
    if (focusUser) return holidaysForUser(holidayConfigs, platformUsers, focusUser);
    if (calendar.filterLocation.length) return holidaysAt(holidayConfigs, calendar.filterLocation);
    return holidayConfigs;
  }, [focusUser, holidayConfigs, platformUsers, calendar.filterLocation]);
  const holidayBlocks = !!focusUser || calendar.filterLocation.length > 0;

  // Day columns: the picked users, else everyone with an appointment or an
  // OOO record that day, else the signed-in user.
  const dayUsers = useMemo(() => {
    if (!isDay) return [];
    if (calendar.filterUser.length) return calendar.filterUser;
    const [y, m, d] = calendar.selectedDate.split('-');
    const booked = calendar.filteredAppointments.filter(a => a.date === `${m}-${d}-${y}`).map(a => a.primary_user);
    const away = recordsOnDate(oooRecords, calendar.selectedDate).map(r => r.userName);
    const names = [...new Set([...booked, ...away].filter(Boolean))].sort();
    return names.length ? names : [calendar.meName].filter(Boolean);
  }, [isDay, calendar.filterUser, calendar.selectedDate, calendar.filteredAppointments, oooRecords, calendar.meName]);

  return (
    <div className={styles.wrapper}>
      <CalendarToolbar
        calendarTitle={calendar.calendarTitle}
        currentView={calendar.currentView}
        onViewChange={calendar.handleViewChange}
        onToday={calendar.handleToday}
        onPrev={calendar.handlePrev}
        onNext={calendar.handleNext}
        users={calendar.users}
        filterUser={calendar.currentView === 'week' ? calendar.viewUsers : calendar.filterUser}
        onFilterUserChange={calendar.setFilterUser}
        filterLocation={calendar.filterLocation}
        onFilterLocationChange={calendar.setFilterLocation}
        apptTypesForFilter={calendar.apptTypesForFilter}
        filterType={calendar.filterType}
        onFilterTypeChange={calendar.setFilterType}
        filterStatus={calendar.filterStatus}
        onFilterStatusChange={calendar.setFilterStatus}
        timezone={calendar.timezone}
        onTimezoneChange={calendar.setTimezone}
        onOpenOoo={() => setOooAll({})}
        onOpenHolidays={() => setShowHolidays(true)}
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
          timezoneLabel={calendar.timezoneLabel}
          onSlotClick={(slot, userName) => {
            setDayProvider(userName);
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
      {calendar.currentView === 'week' && calendar.viewUsers[0] && (
        <div className={styles.weekUserRow}><span aria-hidden="true" /><span>{calendar.viewUsers[0]}</span></div>
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
            setDayProvider(calendar.filterUser.length === 1 ? calendar.filterUser[0] : null);
            calendar.handleSlotClick({ year, month, day: d });
          }}
          onEditOoo={oooActions.openEdit}
          onOpenOooDay={(date) => setOooAll({ highlightDate: date })}
        />
      )}
      {/* schedule-x stays mounted in Day and Month views (it owns the date
          and the toolbar's navigation), just hidden behind our own grids. */}
      <div className={isDay || isMonth ? `${styles.calendarWrap} ${styles.calendarHidden}` : styles.calendarWrap}>
        <CalendarContent
          onSlotClick={calendar.handleSlotClick}
          onEventClick={calendar.handleEventClick}
          onRangeUpdate={calendar.handleRangeUpdate}
          calendarRef={calendar.calendarRef}
          eventsPluginRef={calendar.eventsPluginRef}
          dbAppointments={calendar.filteredAppointments}
        />
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
      {oooAll && <OooAllRecordsDrawer highlightDate={oooAll.highlightDate} onClose={() => setOooAll(null)} />}
      {oooActions.elements}
      {calendar.showSchedule && (
        <ScheduleDrawer
          selectedSlot={calendar.selectedSlot}
          existingAppointment={calendar.clickedAppointment}
          initialProvider={dayProvider || undefined}
          onClose={() => { setDayProvider(null); calendar.handleCloseDrawer(); }}
          onSave={calendar.fetchAppointments}
          timezoneLabel={calendar.timezoneLabel}
          source="calendar"
        />
      )}
    </div>
  );
}

import { useMemo, useRef, useState } from 'react';
import { MenuPopover } from '../../components/MenuPopover/MenuPopover';
import { DatePickerPopover } from '../../components/DatePicker/DatePickerPopover';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Button } from '../../components/Button/Button';
import { FilterChip } from '../../components/FilterChip/FilterChip';
import { Toggle } from '../../components/Toggle/Toggle';
import { Select } from '../../components/Select/Select';
// Locations and statuses come from the ScheduleDrawer constants — the booking
// form is what writes these values, so sourcing the filter options from the
// same place keeps every chip option matchable against real rows.
import { APPOINTMENT_STATUSES } from '../../components/ScheduleDrawer/scheduleDrawerConstants';
import { useLocationOptions } from '../../components/ScheduleDrawer/useLocationOptions';
import { MONTH_NAMES, VIEW_LABELS, VIEWS } from './calendarUtils';
import { MONTH_NAMES as FULL_MONTH_NAMES } from '../../components/ScheduleDrawer/scheduleDrawerConstants';
import { periodRange } from './list/appointmentList';
import { OOO_ICON, peopleOptions, personKey } from '../ooo/oooUtils';
import { HolidayIcon } from '../../components/Icon/HolidayIcon';
import { CalendarRulesIcon } from '../../components/Icon/CalendarRulesIcon';
import { ListCollapseIcon, ListExpandIcon } from '../../components/Icon/ListCollapseIcon';
import styles from './CalendarView.module.css';

const LAYOUTS = [
  { key: 'calendar', icon: 'solar:calendar-minimalistic-linear', tip: 'Calendar' },
  { key: 'list', icon: 'solar:list-linear', tip: 'List' },
  { key: 'availability', icon: 'solar:clock-circle-linear', tip: 'Available Slots' },
];

// The less-used tools, behind •••. Calendar Rules, Automations and Settings
// don't open anything yet.
const MORE_MENU = [
  { key: 'rules', label: 'Calendar Rules', iconElement: <CalendarRulesIcon size={16} color="var(--neutral-400)" /> },
  { key: 'ooo', label: 'Out of Office Records', icon: OOO_ICON },
  { key: 'holidays', label: 'Holidays', iconElement: <HolidayIcon size={16} color="var(--neutral-400)" /> },
  { key: 'automations', label: 'Automations', icon: 'solar:bolt-linear' },
  { key: 'settings', label: 'Settings', icon: 'solar:settings-linear' },
];

// List view: every provider group collapsed or expanded (Figma 3016:573561).
const GROUP_MODES = [
  { key: 'collapsed', icon: <ListCollapseIcon />, ariaLabel: 'Collapse all' },
  { key: 'expanded', icon: <ListExpandIcon />, ariaLabel: 'Expand all' },
];

const PICKER_W = 282; // DatePickerPopover's single-month width

const SCHEDULE_MENU = [
  { key: 'appointment', label: 'Appointment' },
  { key: 'block-time', label: 'Block Time' },
  { key: 'group-appointment', label: 'Group Appointment' },
  { key: 'ooo', label: 'New Out of Office Record' },
  { key: 'reassign', label: 'Reassign Appointments' },
];

// What's on screen: "Sep 05, 2026" (Day), "Oct 26 – Nov 01, 2026" (Week),
// "October 2026" (Month).
function dateTitle(view, iso) {
  if (!iso) return '';
  const parts = (s) => s.split('-');
  const short = (s) => { const [, m, d] = parts(s); return `${MONTH_NAMES[Number(m) - 1]} ${d}`; };
  const { from, to } = periodRange(view, iso);
  const [fy, fm] = parts(from);
  const [ty] = parts(to);
  if (view === 'month-grid') return `${FULL_MONTH_NAMES[Number(fm) - 1]} ${fy}`;
  if (view === 'day') return `${short(from)}, ${fy}`;
  return fy === ty ? `${short(from)} – ${short(to)}, ${ty}` : `${short(from)}, ${fy} – ${short(to)}, ${ty}`;
}

// Figma 3016:571316: an idle filter reads "All Users"; picked, "Users : Amy".
const chipLabel = (noun, selected) => (selected.length ? noun : `All ${noun}`);

export function CalendarToolbar({
  selectedDate,
  currentView,
  onViewChange,
  layout = 'calendar',
  onLayoutChange,
  listGroups = 'expanded',
  onListGroupsChange,
  onToday,
  onPickDate,
  onPrev,
  onNext,
  users,
  filterUser,
  onFilterUserChange,
  filterLocation,
  onFilterLocationChange,
  apptTypesForFilter,
  filterType,
  onFilterTypeChange,
  filterStatus,
  onFilterStatusChange,
  onScheduleSelect,
  onOpenOoo,
  onOpenHolidays,
  onRefresh,
}) {
  // People by id; the chip speaks labels (a name, plus email when shared).
  const userOptions = useMemo(() => peopleOptions(users), [users]);
  const labelOf = useMemo(() => new Map(userOptions.map(o => [o.value, o.label])), [userOptions]);
  const keyOf = useMemo(() => new Map(userOptions.map(o => [o.label, o.value])), [userOptions]);
  const locationOptions = useLocationOptions();
  const users1 = filterUser.map(k => labelOf.get(k) || k);
  // The pill shows names only; the email that tells two same-named people
  // apart stays in the list.
  const userNames = filterUser.map(k => (users || []).find(u => personKey(u) === k)?.name || labelOf.get(k) || k);
  const usersSummary = userNames.length > 2 ? `${userNames[0]} +${userNames.length - 1}` : userNames.join(', ');
  // Week on the grid shows one user's calendar: pick one, and it always has
  // one. The List view takes any number.
  const oneUser = currentView === 'week' && layout !== 'list';
  const period = selectedDate ? periodRange(currentView, selectedDate) : null;
  // The date opens a calendar to jump anywhere, as in the availability week view.
  const [pickerRect, setPickerRect] = useState(null);
  const periodDays = useMemo(() => {
    if (!period) return [];
    const [y, m, d] = period.from.split('-').map(Number);
    const out = [];
    for (let i = 0; ; i++) {
      const day = new Date(y, m - 1, d + i);
      const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      if (iso > period.to) break;
      out.push(iso);
    }
    return out;
  }, [period?.from, period?.to]); // eslint-disable-line react-hooks/exhaustive-deps

  // The filter row can always be hidden; while it is, the Filter button
  // counts the filters still applied (Week's one user is the view itself,
  // so it doesn't count).
  const [showFilters, setShowFilters] = useState(true);
  const filtersSet = [filterLocation, filterType, filterStatus, oneUser ? [] : filterUser].filter(f => f.length > 0).length;
  const divider = <span className={styles.actionDivider} aria-hidden="true" />;
  const [moreOpen, setMoreOpen] = useState(false);
  const moreAnchor = useRef(null);

  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbarTop}>
        <div className={styles.toolbarLeft}>
          {/* The period on screen, between its arrows; it opens a calendar to
              jump anywhere. */}
          <div className={styles.dateNav}>
            <ActionButton icon="solar:alt-arrow-left-linear" tooltip="Previous" onClick={onPrev} />
            <button
              type="button"
              className={styles.dateTitle}
              aria-label={`${dateTitle(currentView, selectedDate)}, pick a different date`}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setPickerRect({ left: r.left, right: r.left + PICKER_W, top: r.top, bottom: r.bottom, width: PICKER_W, height: r.height });
              }}
            >
              {dateTitle(currentView, selectedDate)}
            </button>
            <DatePickerPopover
              open={!!pickerRect}
              anchorRect={pickerRect}
              value={selectedDate}
              highlightedDates={periodDays}
              onChange={(iso) => { if (iso) onPickDate(iso); setPickerRect(null); }}
              onClose={() => setPickerRect(null)}
            />
            <ActionButton icon="solar:alt-arrow-right-linear" tooltip="Next" onClick={onNext} />
          </div>
          <Select
            options={VIEWS.map(v => ({ value: v, label: VIEW_LABELS[v] }))}
            value={currentView}
            onChange={onViewChange}
            className={styles.viewSelect}
          />
          <Button variant="outline" onClick={onToday}>Today</Button>
        </div>

        <div className={styles.toolbarRight}>
          {/* Figma Eventus 17596:117364: the whole button opens the menu. */}
          <Button
            variant="outline"
            menuItems={SCHEDULE_MENU}
            onMenuSelect={onScheduleSelect}
            menuAriaLabel="Schedule"
            menuWidth={220}
          >
            Schedule
          </Button>
          {divider}
          {/* Available slots shade the Week and Day grids; Month has none. */}
          <Toggle
            items={LAYOUTS.filter(l => l.key !== 'availability' || currentView !== 'month-grid').map(l => ({ key: l.key, icon: l.icon, ariaLabel: l.tip }))}
            active={layout}
            onChange={onLayoutChange}
            size="S"
          />
          {layout === 'list' && (
            <>
              {divider}
              <Toggle items={GROUP_MODES} active={listGroups} onChange={onListGroupsChange} size="S" />
            </>
          )}
          {divider}
          <div className={styles.toolGroup}>
            {/* Search isn't wired up yet. */}
            <ActionButton icon="solar:magnifer-linear" tooltip="Search" />
            {divider}
            <ActionButton
              icon="custom:filter"
              tooltip={showFilters ? 'Hide filters' : 'Show filters'}
              active={showFilters}
              notification={!showFilters && filtersSet > 0}
              count={!showFilters && filtersSet ? String(filtersSet) : undefined}
              onClick={() => setShowFilters(o => !o)}
            />
            {divider}
            <ActionButton icon="solar:restart-linear" tooltip="Refresh" onClick={onRefresh} />
            {divider}
            <ActionButton
              icon="solar:menu-dots-linear"
              tooltip="More"
              active={moreOpen}
              onClick={(e) => { moreAnchor.current = e.currentTarget; setMoreOpen(o => !o); }}
            />
            {moreOpen && (
              <MenuPopover
                anchorRef={moreAnchor}
                width={220}
                ariaLabel="More calendar actions"
                items={MORE_MENU}
                onSelect={(key) => {
                  setMoreOpen(false);
                  if (key === 'ooo') onOpenOoo();
                  if (key === 'holidays') onOpenHolidays();
                }}
                onClose={() => setMoreOpen(false)}
              />
            )}
          </div>
        </div>
      </div>

      {showFilters && (
        <div className={styles.filterRow}>
          <FilterChip
            label={chipLabel('Locations', filterLocation)}
            popoverLabel="Locations"
            options={locationOptions}
            selected={filterLocation}
            onChange={onFilterLocationChange}
          />
          {/* `filterUser` holds people's ids; the chip shows their names, and
              two people with the same name are told apart by email. */}
          <FilterChip
            label={chipLabel('Users', users1)}
            popoverLabel="Users"
            options={userOptions.map(o => o.label)}
            selected={users1}
            activeSummary={userNames.length ? usersSummary : undefined}
            onChange={(labels) => onFilterUserChange(labels.map(l => keyOf.get(l) || l))}
            searchable
            singleSelect={oneUser}
            noClear={oneUser}
            noClearNeutral={false}
          />
          <FilterChip
            label={chipLabel('Appointment Types', filterType)}
            popoverLabel="Appointment Types"
            options={apptTypesForFilter.map(t => t.name)}
            selected={filterType}
            onChange={onFilterTypeChange}
            searchable
          />
          <FilterChip
            label={chipLabel('Status', filterStatus)}
            popoverLabel="Status"
            options={APPOINTMENT_STATUSES}
            selected={filterStatus}
            onChange={onFilterStatusChange}
          />
        </div>
      )}
    </div>
  );
}

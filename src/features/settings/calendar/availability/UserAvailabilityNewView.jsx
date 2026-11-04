import { Fragment, useEffect, useMemo, useState } from 'react';
import { Avatar } from '../../../../components/Avatar/Avatar';
import { Badge } from '../../../../components/Badge/Badge';
import { ActionButton } from '../../../../components/ActionButton/ActionButton';
import { FilterChip } from '../../../../components/FilterChip/FilterChip';
import { DateRangeFilter } from '../../../../components/DateRangeFilter/DateRangeFilter';
import { Toggle } from '../../../../components/Toggle/Toggle';
import { Tooltip } from '../../../../components/Tooltip/Tooltip';
import { Icon } from '../../../../components/Icon/Icon';
import { Link } from '../../../../components/Link/Link';
import { CollapsibleContent } from '../../../../components/Collapsible/Collapsible';
import { EmptyState } from '../../../../components/EmptyState/EmptyState';
import { WorklistShell } from '../../../../components/WorklistShell/WorklistShell';
import { DatePickerPopover } from '../../../../components/DatePicker/DatePickerPopover';
import { useAppStore } from '../../../../store/useAppStore';
import { recordsFor, oooStatus, formatDateTime } from '../../../ooo/oooUtils';
import { STATUS_LOOK, isoDay, cadenceText, slotText, timezoneAbbr, ALL_TYPES } from './availabilityUtils';
import { HolidayBadgeIcon } from '../../../../components/Icon/HolidayBadgeIcon';
import {
  dateSpan, hoursText, typesOf, primaryLocationOf, flagsOf, overlapIds, daysCovered,
  occursOn, weekDays, weekStart, dayHead, weekLabel,
} from './newViewUtils';
import styles from './UserAvailabilityNewView.module.css';

const STATUS_FILTER = { Active: 'active', Upcoming: 'upcoming' };
const SHOW_FILTER = ['Has OOO', 'Using practice availability'];
const VIEWS = [
  { key: 'provider', label: 'Provider' },
  { key: 'week', label: 'Week' },
];

/**
 * User Availability, new view. A provider's availability is a set of
 * segments (a location, a repeat, dates, hours per appointment type).
 *  - Provider: a table, one group per provider, their slots grouped by
 *    location (primary first); past slots always fold under "Show N past".
 *  - This Week: a WorklistShell row per user, Mon–Sun across, each day's time ranges
 *    with their location; OOO days greyed.
 * Filters (provider, location, status, appointment type, dates, OOO /
 * practice availability) open from the filter icon beside search.
 */
export function UserAvailabilityNewView({ users, loading, filtersOpen, onAdd, onEdit, onDelete, renderActions, view: fixedView, weekOf, onlyDay }) {
  const oooRecords = useAppStore(s => s.oooRecords);
  const fetchOooRecords = useAppStore(s => s.fetchOooRecords);
  const holidays = useAppStore(s => s.holidaysData);
  const fetchHolidays = useAppStore(s => s.fetchHolidays);
  useEffect(() => { fetchOooRecords?.(); if (!holidays) fetchHolidays?.(); }, [fetchOooRecords, fetchHolidays, holidays]);

  const [ownView, setView] = useState('provider');
  // A host can pin the view (e.g. only This Week) and hide the switch.
  const view = fixedView || ownView;
  const [providers, setProviders] = useState([]);
  const [locations, setLocations] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [types, setTypes] = useState([]);
  const [show, setShow] = useState([]);
  const [datePreset, setDatePreset] = useState(null);
  const [dateRange, setDateRange] = useState([]);
  const [ownWeekOffset, setWeekOffset] = useState(0);
  // A host that owns the date (the Calendar) passes the day to show the
  // week of, and the week's own navigation is hidden.
  const weekOffset = weekOf ? weeksFromNow(weekOf) : ownWeekOffset;

  // Each provider with their primary location, which segments overlap, and
  // any OOO that hasn't ended.
  const people = useMemo(() => users.map((u) => {
    const ooo = recordsFor(oooRecords, { id: u.id, name: u.name }).filter(r => oooStatus(r) !== 'Past');
    return { ...u, primary: primaryLocationOf(u.blocks), overlaps: overlapIds(u.blocks), ooo };
  }), [users, oooRecords]);

  const allLocations = useMemo(() => [...new Set(people.flatMap(u => u.blocks.map(b => b.location)))].sort(), [people]);
  const allTypes = useMemo(() => [...new Set(people.flatMap(u => u.blocks.flatMap(typesOf)))].sort(), [people]);

  const inRange = (b) => {
    if (datePreset !== 'Custom' || !dateRange[0] || !dateRange[1]) return true;
    return (b.startDate || '') <= dateRange[1] && (b.endDate || '9999-12-31') >= dateRange[0];
  };
  // Past segments always fold under "Show N past"; Status picks among the rest.
  const locationSet = new Set(locations);
  const typeSet = new Set(types);
  const matches = (b) => (!locations.length || locationSet.has(b.location))
    && (!types.length || typesOf(b).some(t => typeSet.has(t)))
    && inRange(b)
    && (b.status === 'expired' || !statuses.length || statuses.some(s => STATUS_FILTER[s] === b.status));
  const segmentFiltersOn = locations.length || types.length || datePreset || statuses.length;

  const providerSet = new Set(providers);
  const onlyOoo = show.includes('Has OOO');
  const onlyPractice = show.includes('Using practice availability');
  const shown = people
    .filter(u => !providers.length || providerSet.has(u.name))
    .filter(u => !onlyOoo || u.ooo.length > 0)
    .filter(u => !onlyPractice || u.blocks.length === 0)
    .map(u => ({ ...u, segments: u.blocks.filter(matches) }))
    .filter(u => !segmentFiltersOn || u.segments.some(b => b.status !== 'expired'));

  const filtersOn = providers.length || locations.length || types.length || show.length || datePreset || statuses.length;
  const clearAll = () => {
    setProviders([]); setLocations([]); setTypes([]); setShow([]); setStatuses([]); setDatePreset(null); setDateRange([]);
  };

  return (
    <div className={styles.root}>
      {!fixedView && (
        <div className={styles.toolbar}>
          <Toggle size="sm" items={VIEWS} value={view} onValueChange={setView} />
        </div>
      )}
      <CollapsibleContent open={!!filtersOpen}>
        <div className={styles.filterBar}>
          <FilterChip label="Provider" searchable options={people.filter(u => u.blocks.length).map(u => u.name)} selected={providers} onChange={setProviders} />
          <FilterChip label="Location" searchable options={allLocations} selected={locations} onChange={setLocations} />
          <FilterChip label="Status" options={Object.keys(STATUS_FILTER)} selected={statuses} onChange={setStatuses} />
          <FilterChip label="Appointment Type" searchable options={allTypes} selected={types} onChange={setTypes} />
          <DateRangeFilter preset={datePreset} range={dateRange} onChange={(p, r) => { setDatePreset(p); setDateRange(r || []); }} />
          <FilterChip label="Show" options={SHOW_FILTER} selected={show} onChange={setShow} />
          {filtersOn ? <Link variant="secondary" onClick={clearAll}>Clear all</Link> : null}
        </div>
      </CollapsibleContent>

      {loading ? (
        <div className={styles.loading}>Loading availability…</div>
      ) : shown.length === 0 ? (
        <div className={styles.empty}><EmptyState icon="solar:clock-circle-linear" title="No availability matches applied filters" /></div>
      ) : view === 'week' ? (
        <WeekGrid people={shown} holidays={holidays || []} offset={weekOffset} onOffset={setWeekOffset} hideNav={!!weekOf} onlyDay={onlyDay} renderActions={renderActions} onEdit={onEdit} onAdd={onAdd} />
      ) : (
        <ProviderTable people={shown} onAdd={onAdd} onEdit={onEdit} onDelete={onDelete} />
      )}
    </div>
  );
}

function Flags({ segment, overlaps }) {
  return (
    <span className={styles.flags}>
      {flagsOf(segment, overlaps).map(f => (
        <Tooltip key={f.key} label={f.label}>
          <span className={[styles.flag, f.warn ? styles.flagWarn : ''].join(' ')}><Icon name={f.icon} size={14} color="currentColor" /></span>
        </Tooltip>
      ))}
    </span>
  );
}

const tagFor = (loc, u) => (
  <span className={loc === u.primary ? styles.tagPrimary : styles.tagCovering}>{loc === u.primary ? 'Primary' : 'Covering'}</span>
);

/** Group slots by a key, in a given order of keys. */
function groupBy(list, keyOf, order) {
  const map = new Map();
  list.forEach((x) => { const k = keyOf(x); map.set(k, [...(map.get(k) || []), x]); });
  return [...map.entries()].sort((a, b) => order(a[0], b[0]));
}

/**
 * The Provider and Location tables. Each outer row (a provider, or a
 * location) spans its slots, grouped by the other dimension; each slot reads
 * dates and status, how it repeats, then hours · appointment types. Past
 * slots fold under "Show N past" at the foot of each outer row.
 *
 * @param {Array<{ key, cell, actions?, groups: Array<{ key, cell, slots, overlaps }> , past: same }>} props.rows
 */
function SlotTable({ outerLabel, innerLabel, rows, withActions }) {
  const [open, setOpen] = useState(() => new Set());
  const toggle = k => setOpen(s => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const cols = withActions ? 7 : 6;
  return (
    <div className={styles.scroll}>
      <table className={styles.table}>
        <colgroup>
          <col className={styles.colOuter} />
          <col className={styles.colInner} />
          <col className={styles.colDates} />
          <col />
          <col className={styles.colHours} />
          <col className={styles.colStatus} />
          {withActions && <col className={styles.colActions} />}
        </colgroup>
        <thead>
          <tr>
            <th className={styles.thFirst}>{outerLabel}</th>
            <th>{innerLabel}</th>
            <th>Dates</th>
            <th>Repeats</th>
            <th>Hours · Appointment Types</th>
            <th>Status</th>
            {withActions && <th aria-label="Actions" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const showPast = open.has(r.key);
            const groups = [...r.groups, ...(showPast ? r.past : [])];
            const pastCount = r.past.reduce((n, g) => n + g.slots.length, 0);
            const slotRows = groups.reduce((n, g) => n + g.slots.length, 0);
            const span = Math.max(1, slotRows) + (pastCount ? 1 : 0);
            const lines = [];
            if (!slotRows) {
              lines.push(
                <tr key={`${r.key}-none`} className={styles.row}>
                  <td rowSpan={span} className={`${styles.td} ${styles.outerTd}`}>{r.cell}</td>
                  <td colSpan={5} className={`${styles.td} ${styles.inherited}`}>
                    <Icon name="solar:clock-circle-linear" size={14} color="var(--neutral-300)" />
                    Follows the practice availability of their assigned location(s).
                  </td>
                  {withActions && <td rowSpan={span} className={`${styles.td} ${styles.actionsTd}`}>{r.actions}</td>}
                </tr>,
              );
            }
            groups.forEach((g, gi) => g.slots.forEach((sl, si) => {
              const first = gi === 0 && si === 0;
              const look = STATUS_LOOK[sl.status];
              lines.push(
                <tr key={`${r.key}-${g.key}-${sl.id}`} className={[styles.row, sl.status === 'expired' ? styles.rowPast : ''].join(' ')}>
                  {first && <td rowSpan={span} className={`${styles.td} ${styles.outerTd}`}>{r.cell}</td>}
                  {si === 0 && <td rowSpan={g.slots.length} className={`${styles.td} ${styles.innerTd}`}>{g.cell(g.slots)}</td>}
                  <td className={styles.td}>{dateSpan(sl)}</td>
                  <td className={styles.td}>{cadenceText(sl)}</td>
                  <td className={styles.td}>
                    <span className={styles.stack}>
                      <span>{hoursText(sl)}</span>
                      <span className={styles.sub}>{typesOf(sl).join(', ')}</span>
                    </span>
                  </td>
                  <td className={styles.td}>
                    <span className={styles.statusCell}>
                      <Badge tone={look.tone} size="sm" label={look.label} />
                      <Flags segment={sl} overlaps={g.overlaps?.has(sl.id)} />
                    </span>
                  </td>
                  {first && withActions && <td rowSpan={span} className={`${styles.td} ${styles.actionsTd}`}>{r.actions}</td>}
                </tr>,
              );
            }));
            if (pastCount) {
              lines.push(
                <tr key={`${r.key}-past`} className={styles.row}>
                  <td colSpan={5} className={`${styles.td} ${styles.pastTd}`}>
                    <Link variant="subtle" onClick={() => toggle(r.key)}>{showPast ? 'Hide past' : `Show ${pastCount} past`}</Link>
                  </td>
                </tr>,
              );
            }
            return <Fragment key={r.key}>{lines}</Fragment>;
          })}
          {!rows.length && <tr><td colSpan={cols} className={styles.td} /></tr>}
        </tbody>
      </table>
    </div>
  );
}

function ProviderTable({ people, onAdd, onEdit, onDelete }) {
  const rows = people.map((u) => {
    const order = (a, b) => (b === u.primary) - (a === u.primary) || a.localeCompare(b);
    const toGroups = list => groupBy(list, s => s.location, order).map(([loc, slots]) => ({
      key: loc,
      overlaps: u.overlaps,
      cell: () => (
        <span className={styles.stack}>
          <span className={styles.innerName}>{loc}{tagFor(loc, u)}</span>
          <span className={styles.sub}>{slots.length} slot{slots.length === 1 ? '' : 's'} · {daysCovered(slots)}</span>
        </span>
      ),
      slots,
    }));
    const current = u.segments.filter(s => s.status !== 'expired');
    const locs = new Set(current.map(s => s.location)).size;
    return {
      key: u.id || u.name,
      cell: (
        <span className={styles.person}>
          <Avatar variant="staff" size="M" initials={u.initials} userName={u.name} userId={u.id} />
          <span className={styles.stack}>
            <span className={styles.outerName}>{u.name}</span>
            <span className={styles.sub}>{u.email || u.role}</span>
            {u.blocks.length > 0 && <span className={styles.sub}>{current.length} slot{current.length === 1 ? '' : 's'} · {locs} location{locs === 1 ? '' : 's'}</span>}
          </span>
        </span>
      ),
      actions: (
        <span className={styles.actions}>
          <ActionButton icon="solar:add-linear" size="sm" tooltip="Add slot" onClick={() => onAdd(u)} />
          {u.blocks.length > 0 && (
            <>
              <span className={styles.divider} aria-hidden="true" />
              <ActionButton icon="solar:pen-linear" size="sm" tooltip="Edit availability" onClick={() => onEdit(u)} />
              <span className={styles.divider} aria-hidden="true" />
              <ActionButton icon="solar:trash-bin-minimalistic-linear" size="sm" tooltip="Delete availability" onClick={() => onDelete(u)} />
            </>
          )}
        </span>
      ),
      groups: toGroups(current),
      past: toGroups(u.segments.filter(s => s.status === 'expired')),
    };
  });
  return <SlotTable outerLabel="Provider" innerLabel="Location" rows={rows} withActions />;
}

// Like the live weekly view, in the shared WorklistShell table: a row per
// user with Monday–Sunday across (today in purple). Each day lists its time
// ranges (time, timezone, a rule, location, appointment type). Holidays read
// as on the calendar (green day, badge and name); an out-of-office day keeps
// its availability with a pink strip on top. Clicking a day edits the user's
// availability, or adds a slot when the day has none.
// Whole weeks (Mon–Sun) from this week to the one holding ISO day `iso`.
const weeksFromNow = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round((weekStart(new Date(y, m - 1, d)) - weekStart(new Date())) / (7 * 864e5));
};

const WEEK_PER_PAGE = 20;
const PICKER_W = 282; // DatePickerPopover's single-month width
function WeekGrid({ people, holidays, offset, onOffset, hideNav = false, onlyDay, renderActions, onEdit, onAdd }) {
  const [page, setPage] = useState(1);
  const [pickerRect, setPickerRect] = useState(null);
  // Users header sorts by name: A–Z, then Z–A, then back to the default order.
  const [nameSort, setNameSort] = useState(null);
  const [perPage, setPerPage] = useState(WEEK_PER_PAGE);
  // `onlyDay` (ISO) narrows the week to that one day.
  const days = weekDays(offset).filter(d => !onlyDay || isoDay(d) === onlyDay);
  const todayIso = isoDay(new Date());
  const holidayOn = Object.fromEntries((holidays || []).map(h => [h.date, h.name]));
  const lastPage = Math.max(1, Math.ceil(people.length / perPage));
  const pageNow = Math.min(page, lastPage);
  const sorted = nameSort
    ? [...people].sort((a, b) => (nameSort === 'asc' ? 1 : -1) * a.name.localeCompare(b.name))
    : people;
  const rows = sorted.slice((pageNow - 1) * perPage, pageNow * perPage);
  const columns = [
    // Same width as the List view's User column.
    { key: 'user', label: 'Users', sticky: 'left', left: 0, width: 240, sortKey: 'name', sortType: 'alpha' },
    ...days.map((d) => {
      const iso = isoDay(d);
      return {
        key: iso,
        // Today: purple, with a 3px primary bar along the top (the header's own bottom line kept).
        thStyle: iso === todayIso ? {
          background: 'var(--primary-25)',
          color: 'var(--primary-300)',
          boxShadow: 'inset 0 3px 0 var(--primary-300), inset 0 -0.5px 0 var(--neutral-150)',
        } : undefined,
        label: (
          <span className={styles.dayHeadCell}>
            {dayHead(d)}
            <span className={styles.dayHeadDate}>{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            {/* As on the calendar: a green strip along the bottom of the holiday's header. */}
            {holidayOn[iso] && (
              <span className={styles.holidayStrip} title={`Holiday: ${holidayOn[iso]}`}>
                <HolidayBadgeIcon size={12} color="var(--neutral-0)" starColor="var(--accent-green)" />
                <span className={styles.holidayStripText}>{holidayOn[iso]}</span>
              </span>
            )}
          </span>
        ),
      };
    }),
  ];
  const empty = (icon, label, muted) => (
    <span className={`${styles.dayEmpty} ${muted ? styles.dayEmptyMuted : ''}`}>
      <Icon name={icon} size={24} color={muted ? 'var(--neutral-150)' : 'var(--neutral-200)'} />
      {label}
    </span>
  );
  // The part of the day an out-of-office record covers: "All day" or its hours.
  const oooText = (r, d) => {
    const from = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const to = from + 86400000;
    const s = Math.max(from, new Date(r.startAt).getTime());
    const e = Math.min(to, new Date(r.endAt).getTime());
    if (s <= from && e >= to) return 'All day';
    const t = (ms) => new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(':00', '');
    return `${t(s)} – ${t(e)}`;
  };
  const renderRow = (u) => (
    <tr key={u.id || u.name} className={styles.wRow}>
      <td className={`${styles.wTd} ${styles.wUserTd}`} style={{ left: 0 }}>
        <span className={styles.gridUserTop}>
          {/* Avatar, name over role. */}
          <Avatar variant="staff" size="M" initials={u.initials} userName={u.name} userId={u.id} />
          <span className={styles.gridUserInfo}>
            <span className={styles.gridUserName}>{u.name}</span>
            {u.role && <span className={styles.gridUserRole}>{u.role}</span>}
          </span>
          {renderActions?.(u)}
        </span>
      </td>
      {days.map((d) => {
        const iso = isoDay(d);
        const [from, to] = [new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(), new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime()];
        const out = u.ooo.find(r => new Date(r.startAt).getTime() < to && new Date(r.endAt).getTime() > from);
        const holiday = holidayOn[iso];
        const oooLabel = out ? oooText(out, d) : null;
        const ranges = u.segments
          // Past slots too: a past week shows what was available then.
          .filter(s => occursOn(s, d) && !(holiday && s.skipHolidays))
          .flatMap(s => (s.slots || []).map((sl, k) => ({ key: `${s.id}-${k}`, s, sl })));
        // Opens on the slot clicked (or the day's first), scrolled to and highlighted.
        // Skip holidays is set for the user's whole availability: when it's on,
        // a holiday reads as not available, whether or not a slot falls that day.
        // Off, the day shows whatever runs (or "No schedule").
        const skipsHolidays = u.blocks.length > 0 && u.blocks.every(s => s.skipHolidays !== false);
        const skipped = !!holiday && !ranges.length && skipsHolidays;
        const open = () => (ranges.length ? onEdit?.(u, ranges[0].s.id) : onAdd?.(u));
        return (
          <td
            key={iso}
            className={[styles.wTd, styles.dayCell, iso === todayIso ? styles.todayCell : '', oooLabel === 'All day' ? styles.oooAllDay : ''].filter(Boolean).join(' ')}
            role="button"
            tabIndex={0}
            aria-label={`${u.name}, ${dayHead(d)}: ${ranges.length ? 'edit availability' : 'add availability'}`}
            onClick={open}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }}
          >
            <span className={styles.dayStack}>
              {out && (
                <Tooltip
                  variant="card"
                  // Below the strip, into the cell: above, it would cover the day headers.
                  placement="bottom"
                  align="left"
                  maxWidth={320}
                  className={styles.oooTipWrap}
                  label={(
                    <span className={styles.oooTip}>
                      <span className={styles.oooTipTitle}>Out of office</span>
                      <span>{formatDateTime(out.startAt)} – {formatDateTime(out.endAt)}</span>
                      {out.reason && <span className={styles.oooTipNote}>{out.reason}</span>}
                    </span>
                  )}
                >
                  <span className={styles.oooStrip} aria-label={oooLabel === 'All day' ? 'Out of office' : `Out of office: ${oooLabel}`}>
                  {/* Filled: the linear OOO icon reads too thin at this size. */}
                  <Icon name="solar:square-arrow-right-bold" size={12} color="currentColor" />
                  {oooLabel === 'All day' ? 'Out of office' : oooLabel}
                </span>
                </Tooltip>
              )}
              {ranges.length ? (
                // Out all day: what was scheduled still shows, quieter, since it doesn't apply.
                <span className={[styles.dayRanges, onlyDay ? styles.dayRangesRow : '', oooLabel === 'All day' ? styles.dayRangesOff : ''].filter(Boolean).join(' ')}>
                  {ranges.map(({ key, s, sl }) => (
                    <span key={key} className={styles.dayRange} onClick={(e) => { e.stopPropagation(); onEdit?.(u, s.id); }}>
                      <span className={styles.dayHead}>
                        <span className={styles.dayTime}>{slotText(sl)}</span>
                        {s.timezone && <span className={styles.dayZone}>({timezoneAbbr(s.timezone, d)})</span>}
                      </span>
                      <span className={styles.dayLoc}>{s.location}</span>
                      <span className={styles.dayType}>{sl.appointmentType || ALL_TYPES}</span>
                    </span>
                  ))}
                </span>
              ) : skipped
                ? <span className={styles.holidayNote}>User not available on Holidays</span>
                : empty('solar:clock-circle-linear', 'No schedule', true)}
            </span>
          </td>
        );
      })}
    </tr>
  );
  return (
    <div className={styles.weekWrap}>
      {!hideNav && (
        <div className={styles.weekNav}>
          <ActionButton icon="solar:alt-arrow-left-linear" size="sm" tooltip="Previous week" onClick={() => onOffset(offset - 1)} />
          {/* Opens a calendar to jump to any week. */}
          <button
            type="button"
            className={styles.weekLabel}
            aria-label={`Week of ${weekLabel(days)}, pick a different week`}
            onClick={(e) => {
              // Centred under the label (the label sits mid-bar), not hanging off its left edge.
              const r = e.currentTarget.getBoundingClientRect();
              const left = r.left + r.width / 2 - PICKER_W / 2;
              setPickerRect({ left, right: left + PICKER_W, top: r.top, bottom: r.bottom, width: PICKER_W, height: r.height });
            }}
          >
            {weekLabel(days)}
          </button>
          {/* One click: the week holding the picked date (Mon–Sun) is shown. This
              week is shaded, so it's clear where you are. */}
          <DatePickerPopover
            open={!!pickerRect}
            anchorRect={pickerRect}
            value={isoDay(days[0])}
            highlightedDates={days.map(isoDay)}
            onChange={(iso) => {
              if (iso) {
                const [y, m, d] = iso.split('-').map(Number);
                onOffset(Math.round((weekStart(new Date(y, m - 1, d)) - weekDays(0)[0]) / (7 * 86400000)));
              }
              setPickerRect(null);
            }}
            onClose={() => setPickerRect(null)}
          />
          <ActionButton icon="solar:alt-arrow-right-linear" size="sm" tooltip="Next week" onClick={() => onOffset(offset + 1)} />
          {/* Figma Care Programs 7843:26166, at the bar's right end. */}
          {offset !== 0 && (
            <Link variant="secondary" className={styles.backToToday} onClick={() => onOffset(0)}>
              <Icon name="solar:double-alt-arrow-left-linear" size={16} />
              Back to Today
            </Link>
          )}
        </div>
      )}
      <div className={`${styles.weekShell} ${days.some(d => holidayOn[isoDay(d)]) ? styles.weekHasHoliday : ''}`}>
        <WorklistShell
          header={null}
          columns={columns}
          rows={rows}
          renderRow={renderRow}
          minTableWidth={1180}
          sortKey={nameSort ? 'name' : null}
          sortDir={nameSort}
          onSort={() => { setNameSort(d => (d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc')); setPage(1); }}
          fixedLayout
          page={pageNow}
          perPage={perPage}
          totalItems={people.length}
          onPageChange={setPage}
          onPageSizeChange={(n) => { setPerPage(n); setPage(1); }}
        />
      </div>
    </div>
  );
}

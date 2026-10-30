import { useMemo, useRef, useState } from 'react';
import { Icon } from '../../components/Icon/Icon';
import { DownChevronIcon } from '../../components/Icon/DownChevronIcon';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { SearchBar } from '../../components/SearchBar/SearchBar';
import { MenuPopover } from '../../components/MenuPopover/MenuPopover';
import { FilterChip } from '../../components/FilterChip/FilterChip';
import { AssigneeChange } from '../../components/AssigneeChange/AssigneeChange';
import { Tooltip } from '../../components/Tooltip/Tooltip';
import { Badge } from '../../components/Badge/Badge';
import { HeaderCell } from '../../components/HeaderCell/HeaderCell';
import { useTableSort } from '../../components/HeaderCell/useTableSort';
import { initialsOf } from './CareGapDetailDrawer.utils';
import { displayAppointmentStatus } from '../../components/ScheduleDrawer/scheduleDrawerConstants';
import styles from './CareGapAppointmentsTab.module.css';

const VIEW_OPTIONS = ['Upcoming', 'Past', 'All'];
const EMPTY_FILTERS = { type: [], status: [], assignee: [] };
// Appointment Details statuses (and reminder Pending / Completed) → Badge tone.
const STATUS_TONE = {
  Scheduled: 'primary',
  'Checked In': 'success',
  'No Show': 'warning',
  Cancelled: 'error',
  Pending: 'warning',
  Completed: 'success',
};

// Appointments store dates as YYYY-MM-DD or MM/DD/YYYY depending on the
// writer; normalize to a local Date so Upcoming / Past can compare.
function parseDate(value) {
  const s = String(value || '').trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (m) return new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
  // Anything else the browser understands ("Sep 24, 2026", ISO timestamps).
  const d = s ? new Date(s) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}
// "8:30 am" / "10:30 AM" / "14:05" → [hours, minutes] (24h), or null.
function parseClock(value) {
  const m = /^(\d{1,2}):(\d{2})\s*([ap]m)?/i.exec(String(value || '').trim());
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ap = m[3]?.toLowerCase();
  if (ap === 'pm' && h !== 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  return [h, min];
}
const icsStamp = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}00`;
const icsText = (v) => String(v || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, m => `\\${m}`);

// Download: the appointment as a calendar file (.ics) the user can open in
// Outlook / Google / Apple Calendar. Floating local time; 30 min when no end.
function downloadIcs(row) {
  const a = row.raw;
  const start = row.date ? new Date(row.date) : new Date();
  const [sh, sm] = parseClock(a.time_start) || [9, 0];
  start.setHours(sh, sm, 0, 0);
  const end = new Date(start);
  const endClock = parseClock(a.time_end);
  if (endClock) end.setHours(endClock[0], endClock[1], 0, 0);
  else end.setMinutes(end.getMinutes() + 30);
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Fold Health//Care Gap//EN',
    'BEGIN:VEVENT',
    `UID:${a.id}@fold.health`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${icsText(row.title)}`,
    (row.reason || row.subtitle) ? `DESCRIPTION:${icsText(row.reason || row.subtitle)}` : null,
    a.location ? `LOCATION:${icsText(a.location)}` : null,
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${row.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'appointment'}.ics`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const ROW_ACTIONS = [
  { key: 'edit', icon: 'solar:pen-linear', label: 'Edit' },
  { key: 'download', icon: 'solar:download-minimalistic-linear', label: 'Download' },
  { key: 'delete', icon: 'solar:trash-bin-2-linear', label: 'Delete', danger: true },
];
const rowActionsFor = (row) => (row.kind === 'reminder' && row.status !== 'Completed'
  ? [ROW_ACTIONS[0], { key: 'complete', icon: 'solar:check-circle-linear', label: 'Mark as Done' }, ...ROW_ACTIONS.slice(1)]
  : ROW_ACTIONS);

const apptDateValue = (a) => a.date || a.appointment_date || a.start_date || a.start_time || a.starts_at || '';
// Time: the stored start time, or the clock part of a full timestamp.
const apptTime = (a) => {
  if (a.time_start) return a.time_start;
  const d = parseDate(a.start_time || a.starts_at);
  return d ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
};
const fmtDate = (d) => (d
  ? `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`
  : '');

/**
 * Care Gap drawer — Appt/Reminders tab (Figma 225:93430). A table of the
 * member's appointments with a View By (Upcoming / Past / All) switch,
 * search, and Type / Assignee filter chips. Rows carry the appointment
 * type, reason, date and time, and an assignee picker.
 */
export function CareGapAppointmentsTab({
  appointments = [],
  reminders = [],
  platformUsers = [],
  onAssigneeChange,
  onEdit,
  onDelete,
  onOpen,
  // Reminder rows (Type = Reminder) route to their own handlers.
  onOpenReminder,
  onDeleteReminder,
  onCompleteReminder,
  onReminderAssigneeChange,
  selectedId = null,
}) {
  const [view, setView] = useState('All');
  const [viewMenu, setViewMenu] = useState(null);
  const viewBtnRef = useRef(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [chipsOpen, setChipsOpen] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [rowMenu, setRowMenu] = useState(null); // { row, rect } | null
  const anyFilter = filters.type.length > 0 || filters.status.length > 0 || filters.assignee.length > 0;

  const rows = useMemo(() => [...appointments.map(a => ({
    id: a.id,
    kind: 'appointment',
    title: a.appointment_type_name || 'Appointment',
    subtitle: a.mode || '',
    reason: (a.reason_for_visit || '').trim(),
    type: 'Appointment',
    recurring: !!a.recurring,
    date: parseDate(apptDateValue(a)),
    dateTs: parseDate(apptDateValue(a))?.getTime() ?? null,
    time: apptTime(a),
    assignee: a.primary_user || '',
    // Same labels as the Appointment Details status dropdown.
    status: displayAppointmentStatus(a.status),
    raw: a,
  })), ...reminders.map(r => ({
    id: r.id,
    kind: 'reminder',
    title: r.title || 'Reminder',
    subtitle: '',
    reason: (r.note || '').trim(),
    type: 'Reminder',
    recurring: false,
    date: parseDate(r.date),
    dateTs: parseDate(r.date)?.getTime() ?? null,
    time: r.time || '',
    assignee: r.assignee || '',
    status: r.status || 'Pending',
    // Shape the .ics download expects.
    raw: { ...r, time_start: r.time, reason_for_visit: r.note },
  }))], [appointments, reminders]);

  const statusOptions = useMemo(
    () => [...new Set(rows.map(r => r.status).filter(Boolean))].sort((x, y) => x.localeCompare(y)),
    [rows],
  );
  const assigneeOptions = useMemo(
    () => [...new Set(rows.map(r => r.assignee).filter(Boolean))].sort((x, y) => x.localeCompare(y)),
    [rows],
  );

  const visible = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const q = search.trim().toLowerCase();
    return rows
      .filter(r => {
        if (view === 'Upcoming' && r.date && r.date < today) return false;
        if (view === 'Past' && (!r.date || r.date >= today)) return false;
        if (filters.type.length && !filters.type.includes(r.type)) return false;
        if (filters.status.length && !filters.status.includes(r.status)) return false;
        if (filters.assignee.length && !filters.assignee.includes(r.assignee)) return false;
        if (q && !`${r.title} ${r.subtitle} ${r.assignee}`.toLowerCase().includes(q)) return false;
        return true;
      })
      // Latest date on top, oldest at the bottom; undated rows go last.
      .toSorted((x, y) => {
        if (!x.date || !y.date) return (x.date ? 0 : 1) - (y.date ? 0 : 1);
        return y.date - x.date;
      });
  }, [rows, view, filters, search]);
  // Header sort (Date & Time, Status) overrides the default soonest-first
  // order; nothing is sorted until a header is clicked.
  const { sorted: sortedRows, sortKey, sortDir, requestSort } = useTableSort(visible);


  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <button
          ref={viewBtnRef}
          type="button"
          className={styles.viewBy}
          onClick={() => setViewMenu(viewMenu ? null : viewBtnRef.current?.getBoundingClientRect())}
        >
          View By: <span className={styles.viewByValue}>{view}</span>
          <DownChevronIcon size={14} color="var(--neutral-400)" />
        </button>
        <div className={styles.toolbarActions}>
          {searchOpen ? (
            <SearchBar
              className={styles.searchBar}
              placeholder="Search appointments"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onClose={() => { setSearchOpen(false); setSearch(''); }}
            />
          ) : (
            <ActionButton size="sm" icon="solar:magnifer-linear" tooltip="Search" onClick={() => setSearchOpen(true)} />
          )}
          <span className={styles.divider} />
          <ActionButton
            size="sm"
            icon="custom:filter"
            tooltip={chipsOpen ? 'Hide filters' : 'Filter'}
            iconColor={chipsOpen || anyFilter ? 'var(--primary-300)' : undefined}
            onClick={() => setChipsOpen(v => !v)}
          />
        </div>
      </div>

      {chipsOpen && (
        <div className={styles.chips}>
          <FilterChip size="S" label="Type" options={['Appointment', 'Reminder']} selected={filters.type} onChange={v => setFilters(f => ({ ...f, type: v }))} />
          <FilterChip size="S" label="Status" options={statusOptions} selected={filters.status} onChange={v => setFilters(f => ({ ...f, status: v }))} />
          <FilterChip size="S" label="Assignee" options={assigneeOptions} selected={filters.assignee} onChange={v => setFilters(f => ({ ...f, assignee: v }))} searchable />
          {anyFilter && (
            <button type="button" className={styles.clearAll} onClick={() => setFilters(EMPTY_FILTERS)}>
              <Icon name="solar:close-circle-linear" size={14} color="currentColor" />
              Clear All
            </button>
          )}
        </div>
      )}

      {visible.length === 0 ? (
        <div className={styles.empty}>
          <Icon name="solar:calendar-linear" size={36} color="var(--neutral-200)" />
          <p className={styles.emptyTitle}>
            {rows.length === 0 ? 'No appointments scheduled yet.' : `No ${view === 'All' ? '' : `${view.toLowerCase()} `}appointments or reminders.`}
          </p>
        </div>
      ) : (
        <table className={styles.table}>
          <colgroup>
            <col />
            <col className={styles.colType} />
            <col className={styles.colDate} />
            <col className={styles.colStatus} />
            <col className={styles.colAssignee} />
            <col className={styles.colActions} />
          </colgroup>
          <thead>
            <tr>
              <HeaderCell label="Title" className={styles.th} />
              <HeaderCell label="Type" className={styles.th} />
              <HeaderCell label="Date & Time" sortField="dateTs" sortType="date" activeKey={sortKey} activeDir={sortDir} onSort={requestSort} className={styles.th} />
              <HeaderCell label="Status" sortField="status" activeKey={sortKey} activeDir={sortDir} onSort={requestSort} className={styles.th} />
              <HeaderCell label="Assignee" className={styles.th} />
              <HeaderCell label="" className={styles.th} />
            </tr>
          </thead>
          <tbody>
            {sortedRows.map(r => (
              <tr
                key={r.id}
                className={[styles.row, r.id === selectedId ? styles.rowActive : ''].filter(Boolean).join(' ')}
                aria-selected={r.id === selectedId || undefined}
              >
                <td className={styles.td}>
                  <div className={styles.titleCell}>
                    <button
                      type="button"
                      className={styles.titleBtn}
                      onClick={() => (r.kind === 'reminder' ? onOpenReminder?.(r.raw) : onOpen?.(r.raw))}
                      aria-label={`Open ${r.title} details`}
                    >
                      {r.title}
                    </button>
                    {(r.subtitle || r.reason) && (
                      <span className={styles.subtitle}>
                        {r.subtitle}
                        {r.subtitle && r.reason && <span className={styles.subtitleDot}> • </span>}
                        {r.reason && (
                          <Tooltip label={r.reason} maxWidth={260}>
                            <span className={styles.reasonLink} tabIndex={0}>Reason</span>
                          </Tooltip>
                        )}
                      </span>
                    )}
                  </div>
                </td>
                <td className={styles.td}>
                  <div className={styles.typeCell}>
                    <span>{r.type}</span>
                    {r.recurring && (
                      <Tooltip label="Recurring">
                        <span className={styles.recurring}>
                          <Icon name="solar:repeat-linear" size={12} color="var(--primary-300)" />
                        </span>
                      </Tooltip>
                    )}
                  </div>
                </td>
                <td className={styles.td}>
                  <div className={styles.dateCell}>
                    <span>{fmtDate(r.date) || '—'}</span>
                    {r.time && <span>{r.time}</span>}
                  </div>
                </td>
                <td className={styles.td}>
                  <Badge size="S" tone={STATUS_TONE[r.status] || 'grey'} label={r.status} />
                </td>
                <td className={styles.td}>
                  <AssigneeChange
                    avatarOnly
                    unassigned={!r.assignee}
                    name={r.assignee || undefined}
                    initials={r.assignee ? initialsOf(r.assignee) : undefined}
                    ariaLabel={r.assignee || 'Assign'}
                    users={platformUsers}
                    pickerTitle={r.assignee ? 'Change assignee' : 'Assign to'}
                    onSelect={(u) => {
                      if (!u?.name || u.name === r.assignee) return;
                      if (r.kind === 'reminder') onReminderAssigneeChange?.(r.raw, u.name);
                      else onAssigneeChange?.(r.raw, u.name);
                    }}
                  />
                </td>
                <td className={[styles.td, styles.actionsTd].join(' ')}>
                  <ActionButton
                    icon="solar:menu-dots-linear"
                    size="sm"
                    tooltip="More actions"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setRowMenu(prev => (prev?.row.id === r.id ? null : { row: r, rect }));
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {rowMenu && (
        <MenuPopover
          anchorRect={rowMenu.rect}
          align="right"
          width={168}
          ariaLabel="Appointment actions"
          items={rowActionsFor(rowMenu.row)}
          onSelect={(key) => {
            const row = rowMenu.row;
            const isReminder = row.kind === 'reminder';
            setRowMenu(null);
            if (key === 'edit') (isReminder ? onOpenReminder : onEdit)?.(row.raw);
            else if (key === 'complete') onCompleteReminder?.(row.raw);
            else if (key === 'download') downloadIcs(row);
            else if (key === 'delete') (isReminder ? onDeleteReminder : onDelete)?.(row.raw);
          }}
          onClose={() => setRowMenu(null)}
        />
      )}

      {viewMenu && (
        <MenuPopover
          anchorRect={viewMenu}
          align="left"
          width={160}
          ariaLabel="View by"
          items={VIEW_OPTIONS.map(v => ({
            key: v,
            label: <span style={{ color: v === view ? 'var(--primary-300)' : undefined }}>{v}</span>,
          }))}
          onSelect={(key) => setView(key)}
          onClose={() => setViewMenu(null)}
        />
      )}
    </div>
  );
}

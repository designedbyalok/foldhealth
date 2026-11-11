import { useMemo, useRef, useState } from 'react';
import { Checkbox } from '../../../components/Checkbox/Checkbox';
import { useScrollbarOnScroll } from '../../../lib/useScrollbarOnScroll';
import { Avatar } from '../../../components/Avatar/Avatar';
import { Link } from '../../../components/Link/Link';
import { WorklistShell } from '../../../components/WorklistShell/WorklistShell';
import { profileCellClass, profileRowClass } from '../../../components/ProfileTable/profileTableClasses';
import { Badge } from '../../../components/Badge/Badge';
import { BadgeSelect } from '../../../components/BadgeSelect/BadgeSelect';
import { toast } from '../../../components/Toast/sonnerToast';
import { ActionButton } from '../../../components/ActionButton/ActionButton';
import { MenuPopover } from '../../../components/MenuPopover/MenuPopover';
import { Tooltip } from '../../../components/Tooltip/Tooltip';
import { Icon } from '../../../components/Icon/Icon';
import { CalendarCrossIcon } from '../../../components/Icon/CalendarCrossIcon';
import { CalendarRefreshIcon } from '../../../components/Icon/CalendarRefreshIcon';
import { BulkBar } from '../../../components/BulkBar/BulkBar';
import { Pagination } from '../../../components/Pagination/Pagination';
import { EmptyState } from '../../../components/EmptyState/EmptyState';
import { TruncatedText } from '../../../components/TruncatedText/TruncatedText';
import { useAppStore } from '../../../store/useAppStore';
import { apptPerson, describeRange, initialsOf, OOO_ICON, recordsFor } from '../../ooo/oooUtils';
import { apptSpan } from '../../ooo/reassignUtils';
import { ReassignAppointmentsDrawer } from '../../ooo/ReassignAppointmentsDrawer';
import {
  dateLabel, groupByProvider, inPeriod, lockedReason, modeLabel, periodRange, sortAppointments, sessionRows, STATUS_OPTIONS, statusBlockedReason, statusLabel, statusValue, timeRangeLabel,
} from './appointmentList';
import { BulkRescheduleDrawer } from './BulkRescheduleDrawer';
import { BulkEditAppointmentsDrawer } from './BulkEditAppointmentsDrawer';
import { CancelAppointmentsDrawer } from './CancelAppointmentsDrawer';
import { GroupAppointmentDrawer } from './GroupAppointmentDrawer';
import styles from './AppointmentListView.module.css';

const STATUS_TONE = {
  Proposed: 'info', Pending: 'warning', Booked: 'neutral', Cancelled: 'danger', 'No Show': 'neutral', 'Checked In': 'success', 'Checked Out': 'success', Declined: 'danger',
};

// Each column sized to its usual content: a type or session name ("Group
// Heart Health Workshop"), a member, a status badge, "In-person", a full
// location ("AstranaCare Centennial Hills"). Reason for Visit takes what's
// left, at least MIN_REASON; below that the table scrolls sideways.
const MIN_REASON = 200;
const COLUMNS = [
  // The checkbox and Appt Type stay put on the left and the "..." on the
  // right; the columns between scroll under them.
  { key: 'check', showCheckbox: true, width: 36, sticky: 'left', left: 0 },
  { key: 'type', label: 'Appt Type', width: 210, sticky: 'left', left: 36, thStyle: { boxShadow: 'inset -0.5px 0 0 var(--neutral-150)' } },
  { key: 'member', label: 'Member', width: 200 },
  { key: 'status', label: 'Status', width: 120 },
  { key: 'mode', label: 'Mode', width: 100 },
  { key: 'department', label: 'Department', width: 220 },
  // Wide enough for the longest, "11/16/2026, 11:30 AM–12:00 PM".
  { key: 'when', label: 'Date & Time', width: 240, sortKey: 'date', sortType: 'date' },
  { key: 'reason', label: 'Reason for Visit' },
  // View, Edit and "..." (Cancel), divided.
  { key: 'actions', label: 'Actions', width: 132, sticky: 'right', thStyle: { boxShadow: 'inset 0.5px 0 0 var(--neutral-150)' } },
];
const MIN_TABLE_WIDTH = COLUMNS.reduce((sum, c) => sum + (c.width || 0), 0) + MIN_REASON;

// What's left under "..." once View and Edit have their own buttons.
const ROW_MENU = [
  { key: 'cancel', label: 'Cancel Appointment', iconElement: <CalendarCrossIcon size={16} color="var(--status-error)" />, danger: true },
];

/**
 * The calendar's List view (VBC-25651, Figma 3023:575134): the period's
 * appointments (same filters as the calendar), grouped by provider. Rows
 * from one provider can be bulk Rescheduled, Reassigned, Edited (location,
 * reason, instructions), marked No Show or Cancelled; rows across providers
 * only marked No Show or Cancelled. No Show skips ones not yet started.
 * Checked-in, checked-out and cancelled ones can't be picked.
 *
 * @param {object[]} props.appointments – the calendar's filtered appointments
 * @param {'week'|'day'|'month-grid'} props.view
 * @param {string}   props.selectedDate – ISO day the calendar is on
 * @param {object[]} props.users        – staff, for Reassign
 * @param {Set} [props.highlightIds] – appointments to highlight (e.g. just
 *   reassigned to me); the caller clears it
 * @param {'expanded'|'collapsed'} [props.groupsMode] – every group open or closed;
 *   a group can still be toggled on its own after
 * @param {(appt) => void} props.onViewDetails
 */
export function AppointmentListView({ appointments, view, selectedDate, users, groupsMode = 'expanded', highlightIds, onViewDetails }) {
  const period = useMemo(() => periodRange(view, selectedDate), [view, selectedDate]);
  const [sort, setSort] = useState({ key: 'date', dir: 'asc' });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  // Groups toggled away from `groupsMode`; a new mode starts them over.
  const [flipped, setFlipped] = useState(() => new Set());
  const [seenMode, setSeenMode] = useState(groupsMode);
  if (seenMode !== groupsMode) { setSeenMode(groupsMode); setFlipped(new Set()); }
  const isOpen = (key) => (groupsMode === 'collapsed') === flipped.has(key);
  // Picks can span providers; Reschedule and Reassign need just one.
  const [selection, setSelection] = useState(() => new Set());
  const [action, setAction] = useState(null); // { kind: 'reschedule'|'reassign'|'edit'|'cancel', appts, provider }
  const [menu, setMenu] = useState(null); // { appt } or { session }
  // The group session whose details are open (its row id); members come from the live rows.
  const [openSession, setOpenSession] = useState(null);
  const menuAnchor = useRef(null);
  const scrollerRef = useRef(null);
  useScrollbarOnScroll(scrollerRef);
  const openQuickView = useAppStore(s => s.openQuickView);
  const oooRecords = useAppStore(s => s.oooRecords);
  // The provider's out of office record covering this appointment, if any.
  const oooDuring = (a) => {
    const { start, end } = apptSpan(a);
    return recordsFor(oooRecords, apptPerson(a)).find(r => start < new Date(r.endAt).getTime() && end > new Date(r.startAt).getTime()) || null;
  };
  const updateAppointment = useAppStore(s => s.updateAppointment);
  const setAppointmentsStatus = useAppStore(s => s.setAppointmentsStatus);

  // All or nothing: if any selected appointment hasn't started, none are marked.
  const markNoShow = async () => {
    if (selected.some(a => statusBlockedReason(a, 'No Show'))) {
      toast.error('Failed to mark as no show. Some appointments have not started.');
      return;
    }
    const ok = await setAppointmentsStatus(selected, 'No Show');
    if (!ok) { toast.error('Appointments could not be updated. Try again.'); return; }
    toast.success('Status Updated Successfully');
    clear();
  };

  // Cancelling asks for a reason; the rest save straight away.
  const changeStatus = async (a, next) => {
    if (next === statusLabel(a)) return;
    if (next === 'Cancelled') { setAction({ kind: 'cancel', appts: [a] }); return; }
    const blocked = statusBlockedReason(a, next);
    if (blocked) { toast.error(blocked); return; }
    const ok = await updateAppointment(a.id, { status: statusValue(next) });
    if (ok) toast.success('Status Updated Successfully');
    else toast.error('Status could not be updated. Try again.');
  };

  const rows = useMemo(
    () => sortAppointments((appointments || []).filter(a => !a.isReminder && inPeriod(a, period)), sort.key, sort.dir),
    [appointments, period, sort],
  );

  // A different period or filter is a different list: start over.
  const listKey = `${period.from}|${period.to}|${rows.map(a => a.id).join(',')}`;
  const [seenKey, setSeenKey] = useState(listKey);
  if (seenKey !== listKey) {
    setSeenKey(listKey);
    setPage(1);
    setSelection(s => {
      const ids = new Set([...s].filter(id => rows.some(a => a.id === id && !lockedReason(a))));
      return ids.size === s.size ? s : ids;
    });
  }

  // Pages hold whole providers, so a provider is never split across pages
  // and their count always matches the rows under them.
  const allGroups = useMemo(() => groupByProvider(rows), [rows]);
  const groups = allGroups.slice((page - 1) * perPage, page * perPage);
  const selected = rows.filter(a => selection.has(a.id));
  const selectedGroups = allGroups.filter(g => g.appointments.some(a => selection.has(a.id)));
  const selectedGroup = selectedGroups.length === 1 ? selectedGroups[0] : null;

  const clear = () => setSelection(new Set());
  const toggle = (ids, on) => setSelection((s) => {
    const next = new Set(s);
    ids.forEach(id => (on ? next.add(id) : next.delete(id)));
    return next;
  });

  const onSort = (key) => setSort(s => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));

  const startBulk = (kind) => {
    if (!selected.length || (kind !== 'cancel' && !selectedGroup)) return;
    setAction({ kind, appts: selected, provider: selectedGroup?.person });
  };

  // A checkbox that explains itself when it can't be used.
  const pick = (tip, checkbox, className = '') => (
    // Left-anchored: the checkboxes sit at the list's left edge, where a
    // centred tooltip would run under the nav.
    <Tooltip label={tip} maxWidth={240} align="left">
      <span className={`${tip ? styles.checkDisabled : styles.check} ${className}`}>{checkbox}</span>
    </Tooltip>
  );

  // A group session's status, for every member at once; cancelling asks for a reason.
  const changeSessionStatus = async (members, next) => {
    if (next === 'Cancelled') { setAction({ kind: 'cancel', appts: members }); return; }
    const ok = await setAppointmentsStatus(members, statusValue(next));
    if (ok) toast.success('Status Updated Successfully');
    else toast.error('Status could not be updated. Try again.');
  };

  // A click anywhere on a row opens it, unless it landed on one of its own
  // controls (checkbox, member link, status, menu) or in a menu they opened.
  const rowClick = (open) => (e) => {
    if (e.target.closest('button, a, input, [role="button"], [role="checkbox"], [role="menu"], [data-check-cell]')) return;
    open();
  };

  // A row's actions: View, Edit and "..." (Cancel). Off while a bulk
  // selection is open, as the rest of the row is.
  const rowActions = ({ onView, onEdit, editTip, onMore }) => (
    <span className={styles.rowActions}>
      <ActionButton icon="solar:eye-linear" size="sm" tooltip="View details" disabled={selection.size > 0} onClick={onView} />
      <span className={styles.headerDivider} aria-hidden="true" />
      <ActionButton icon="solar:pen-linear" size="sm" tooltip={editTip} disabled={selection.size > 0} onClick={onEdit} />
      <span className={styles.headerDivider} aria-hidden="true" />
      <ActionButton icon="solar:menu-dots-linear" size="sm" tooltip="More actions" tooltipLeft disabled={selection.size > 0} onClick={onMore} />
    </span>
  );

  // A group session: one row for everyone booked into it. The checkbox picks
  // all its members; the members link (and the row) opens its details.
  const renderSessionRow = (group, session) => {
    const ids = session.members.filter(a => !lockedReason(a)).map(a => a.id);
    const picked = ids.filter(id => selection.has(id)).length;
    const state = picked && picked === ids.length ? true : picked ? 'indeterminate' : false;
    const tip = ids.length ? '' : 'Nothing here can be rescheduled, reassigned or cancelled';
    const statuses = [...new Set(session.members.map(statusLabel))];
    const status = statuses.length === 1 ? statuses[0] : 'Mixed';
    const n = session.members.length;
    const open = () => setOpenSession(session.id);
    return (
      <tr key={session.id} className={`${profileRowClass} ${styles.row} ${state === true ? styles.rowPicked : ''}`} onClick={rowClick(open)}>
        <td className={`${profileCellClass} ${styles.checkCell} ${styles.stickyCheck}`} data-check-cell>
          {pick(tip, (
            <Checkbox
              checked={state}
              disabled={!!tip}
              onCheckedChange={() => toggle(ids, picked !== ids.length)}
              aria-label={`Select everyone in ${session.appointment_type_name}`}
            />
          ))}
        </td>
        <td className={`${profileCellClass} ${styles.stickyType}`}><TruncatedText text={session.appointment_type_name} /></td>
        <td className={profileCellClass}>
          <span className={styles.memberLine}>
            <Link variant="secondary" className={styles.memberLink} role="button" tabIndex={0} onClick={open} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }}>
              <Icon name="solar:users-group-rounded-linear" size={16} />
              <span className={styles.memberLinkText}>{n} {n === 1 ? 'Member' : 'Members'}</span>
            </Link>
          </span>
        </td>
        <td className={profileCellClass}>
          {/* One status for every member; "Mixed" until one is picked. A status
              some member can't take yet is greyed out, with why. */}
          <BadgeSelect
            value={status}
            options={STATUS_OPTIONS.map((st) => {
              const blocked = st === status ? null : session.members.find(a => statusBlockedReason(a, st));
              return blocked ? { value: st, disabled: true, tooltip: statusBlockedReason(blocked, st) } : st;
            })}
            onChange={(next) => changeSessionStatus(session.members, next)}
            tone={STATUS_TONE[status] || 'neutral'}
            size="S"
            align="left"
            disabled={selection.size > 0}
          />
        </td>
        {/* Members share one session, so the first one's mode is the session's. */}
        <td className={profileCellClass}><TruncatedText text={modeLabel(session.members[0])} /></td>
        <td className={profileCellClass}>{session.location ? <TruncatedText text={session.location} /> : null}</td>
        <td className={profileCellClass}><span className={styles.cellText}>{dateLabel(session.date)}, {timeRangeLabel(session)}</span></td>
        <td className={profileCellClass}>{session.reason_for_visit ? <TruncatedText text={session.reason_for_visit} /> : null}</td>
        <td className={`${profileCellClass} ${styles.actionCell} ${styles.stickyActions}`}>
          {/* No single edit drawer for a whole session: Edit opens Bulk Edit
              with its members. */}
          {rowActions({
            onView: open,
            onEdit: () => setAction({ kind: 'edit', appts: session.members, provider: group.person }),
            editTip: 'Edit appointment',
            onMore: (e) => { menuAnchor.current = e.currentTarget; setMenu({ session }); },
          })}
        </td>
      </tr>
    );
  };

  const renderRow = (group, a) => {
    if (a.isGroup) return renderSessionRow(group, a);
    const tip = lockedReason(a);
    const checked = selection.has(a.id);
    const status = statusLabel(a);
    const ooo = oooDuring(a);
    // Text cut off with "…" shows in full in a tooltip on hover.
    const cell = (content, extra = '') => (
      <td className={`${profileCellClass} ${extra}`}>
        {typeof content === 'string' ? <TruncatedText text={content} /> : <span className={styles.cellText}>{content}</span>}
      </td>
    );
    return (
      <tr key={a.id} className={`${profileRowClass} ${styles.row} ${checked ? styles.rowPicked : ''} ${highlightIds?.has(a.id) ? styles.rowHighlight : ''}`} onClick={rowClick(() => onViewDetails?.(a))}>
        <td className={`${profileCellClass} ${styles.checkCell} ${styles.stickyCheck}`} data-check-cell>
          {pick(tip, (
            <Checkbox
              checked={checked}
              disabled={!!tip}
              onCheckedChange={(v) => toggle([a.id], !!v)}
              aria-label={`Select ${a.patient_name || 'appointment'}`}
            />
          ))}
        </td>
        {cell(a.appointment_type_name, styles.stickyType)}
        <td className={profileCellClass}>
          {/* The member as a link (user icon + name) that opens their quick view. */}
          <span className={styles.memberLine}>
            <Link
              variant="secondary"
              className={styles.memberLink}
              role="button"
              tabIndex={0}
              onClick={() => openQuickView({ id: a.patient_id, memberId: a.patient_id, name: a.patient_name, initials: initialsOf(a.patient_name) })}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openQuickView({ id: a.patient_id, memberId: a.patient_id, name: a.patient_name, initials: initialsOf(a.patient_name) }); } }}
            >
              <Icon name="solar:user-linear" size={16} />
              <span className={styles.memberLinkText}>{a.patient_name || 'Member'}</span>
            </Link>
          </span>
        </td>
        <td className={profileCellClass}>
          <BadgeSelect
            value={status}
            // A status this appointment can't take yet is greyed out, with why.
            options={STATUS_OPTIONS.map((s) => {
              const why = s === status ? null : statusBlockedReason(a, s);
              return why ? { value: s, disabled: true, tooltip: why } : s;
            })}
            onChange={(next) => changeStatus(a, next)}
            tone={STATUS_TONE[status] || 'neutral'}
            size="S"
            align="left"
            // Bulk actions own the rows while anything is selected, so the
            // status badge and the row menu wait until it's cleared.
            disabled={selection.size > 0}
          />
        </td>
        {cell(modeLabel(a))}
        {cell(a.location)}
        <td className={profileCellClass}>
          <span className={styles.twoLine}>
            <span className={styles.cellText}>{dateLabel(a.date)}, {timeRangeLabel(a)}</span>
            {/* Only when the provider is away then; the dates are in the tooltip. */}
            {ooo && (
              <Tooltip label={`${a.primary_user || 'The provider'} is out of office ${describeRange(ooo.startAt, ooo.endAt).span}`} maxWidth={260} align="left">
                <span className={styles.oooNote}>
                  <Icon name={OOO_ICON} size={14} />
                  Provider OOO
                </span>
              </Tooltip>
            )}
          </span>
        </td>
        {cell(a.reason_for_visit)}
        <td className={`${profileCellClass} ${styles.actionCell} ${styles.stickyActions}`}>
          {/* The appointment drawer edits in place, so Edit opens it too. */}
          {rowActions({
            onView: () => onViewDetails?.(a),
            onEdit: () => onViewDetails?.(a),
            editTip: 'Edit appointment',
            onMore: (e) => { menuAnchor.current = e.currentTarget; setMenu({ appt: a }); },
          })}
        </td>
      </tr>
    );
  };

  return (
    <div className={styles.root}>
      <div ref={scrollerRef} className={`${styles.scroller} scrollbar-x-on-scroll`}>
        {!rows.length && (
          <div className={styles.empty}>
            <EmptyState icon="solar:calendar-mark-linear" title="No appointments match this period and these filters" />
          </div>
        )}
        {groups.map((group) => {
          const pickable = group.appointments.filter(a => !lockedReason(a)).map(a => a.id);
          const picked = pickable.filter(id => selection.has(id)).length;
          const blocked = !pickable.length ? 'Nothing here can be rescheduled, reassigned or cancelled' : '';
          const allState = picked && picked === pickable.length ? true : picked ? 'indeterminate' : false;
          const open = isOpen(group.key);
          // A group session counts once, as it's one row.
          const n = sessionRows(group.appointments).length;
          return (
            // Each provider is a section, as Tasks groups by status
            // (Figma Tasks 866:7982), over the standard worklist table.
            <section key={group.key} className={styles.group} style={{ minWidth: MIN_TABLE_WIDTH }}>
              <div className={styles.groupRow}>
                {/* Stays put while the table scrolls sideways under it. */}
                <span className={styles.groupLead}>
                  {pick(blocked, (
                    <Checkbox
                      checked={allState}
                      disabled={!!blocked}
                      onCheckedChange={() => toggle(pickable, picked !== pickable.length)}
                      aria-label={`Select ${group.person.name}'s appointments`}
                    />
                  ))}
                  <Avatar variant="provider" size="M" initials={initialsOf(group.person.name)} userName={group.person.name} userId={group.person.id} />
                  <button
                    type="button"
                    className={styles.groupToggle}
                    aria-expanded={open}
                    onClick={() => setFlipped((c) => { const next = new Set(c); if (next.has(group.key)) next.delete(group.key); else next.add(group.key); return next; })}
                  >
                    {group.person.name}
                    <span className={styles.groupCount}><Badge size="sm" label={String(n)} className={styles.countSquare} /></span>
                    <Icon name="solar:alt-arrow-down-linear" size={12} className={open ? styles.caretOpen : styles.caret} />
                  </button>
                </span>
              </div>
              {open && (
                <WorklistShell
                  embedded
                  embeddedNoScroll
                  header={null}
                  hideBulkBar
                  fixedLayout
                  minTableWidth={MIN_TABLE_WIDTH}
                  columns={COLUMNS}
                  sortKey={sort.key}
                  sortDir={sort.dir}
                  onSort={onSort}
                  rows={sessionRows(group.appointments)}
                  renderRow={(a) => renderRow(group, a)}
                  selectedIds={sessionRows(group.appointments)
                    .filter(r => (r.isGroup ? r.members.every(m => selection.has(m.id)) : selection.has(r.id)))
                    .map(r => r.id)}
                  selectAll={{ checked: allState, disabled: !!blocked, tooltip: blocked }}
                  onSelectAll={() => toggle(pickable, picked !== pickable.length)}
                />
              )}
            </section>
          );
        })}
      </div>

      {rows.length > 0 && (
        <Pagination
          currentPage={page}
          perPage={perPage}
          totalItems={allGroups.length}
          onPageChange={setPage}
          onPerPageChange={(n) => { setPerPage(n); setPage(1); }}
        />
      )}

      <BulkBar
        selectedIds={selected.map(a => a.id)}
        onClear={clear}
        // Picks across providers can only be cancelled or marked No Show;
        // one provider's can also be rescheduled, reassigned or edited.
        actions={selectedGroup ? [
          { label: 'Reschedule', iconElement: <CalendarRefreshIcon size={16} />, size: 'md', onClick: () => startBulk('reschedule') },
          { label: 'Reassign', icon: 'solar:user-linear', size: 'md', onClick: () => startBulk('reassign') },
          { divider: true },
          { label: 'Edit', icon: 'solar:pen-linear', size: 'md', onClick: () => startBulk('edit') },
        ] : [
          { label: 'Cancel', iconElement: <CalendarCrossIcon size={16} />, variant: 'soft', tone: 'danger', size: 'md', onClick: () => startBulk('cancel') },
        ]}
        moreActions={[
          { label: 'Mark as No Show', icon: 'solar:close-circle-linear', onClick: markNoShow },
          ...(selectedGroup ? [{ label: 'Cancel', iconElement: <CalendarCrossIcon size={16} />, variant: 'destructive', onClick: () => startBulk('cancel') }] : []),
        ]}
      />

      {menu?.session && (() => {
        // Members already past, cancelled or checked out stay as they are.
        const cancellable = menu.session.members.filter(a => !lockedReason(a));
        return (
          <MenuPopover
            anchorRef={menuAnchor}
            items={ROW_MENU.map(i => (i.key === 'cancel' && !cancellable.length ? { ...i, disabled: true, hint: lockedReason(menu.session.members[0]) } : i))}
            width={200}
            ariaLabel="Session actions"
            onSelect={(key) => {
              setMenu(null);
              if (key === 'cancel') setAction({ kind: 'cancel', appts: cancellable });
            }}
            onClose={() => setMenu(null)}
          />
        );
      })()}
      {menu?.appt && (
        <MenuPopover
          anchorRef={menuAnchor}
          items={ROW_MENU.map(i => (i.key === 'cancel' && lockedReason(menu.appt) ? { ...i, disabled: true, hint: lockedReason(menu.appt) } : i))}
          width={200}
          ariaLabel="Appointment actions"
          onSelect={(key) => {
            const a = menu.appt;
            setMenu(null);
            if (key === 'cancel') setAction({ kind: 'cancel', appts: [a] });
          }}
          onClose={() => setMenu(null)}
        />
      )}

      {openSession && (() => {
        const session = sessionRows(rows).find(r => r.id === openSession);
        return session ? (
          <GroupAppointmentDrawer
            session={session}
            members={session.members}
            statusTone={STATUS_TONE}
            onStatusChange={changeStatus}
            onSessionStatusChange={changeSessionStatus}
            onClose={() => setOpenSession(null)}
          />
        ) : null;
      })()}
      {action?.kind === 'cancel' && (
        <CancelAppointmentsDrawer appointments={action.appts} onDone={clear} onClose={() => setAction(null)} />
      )}
      {action?.kind === 'edit' && (
        <BulkEditAppointmentsDrawer provider={action.provider} appointments={action.appts} onDone={clear} onClose={() => setAction(null)} />
      )}
      {action?.kind === 'reschedule' && (
        <BulkRescheduleDrawer provider={action.provider} appointments={action.appts} onDone={clear} onClose={() => setAction(null)} />
      )}
      {action?.kind === 'reassign' && (
        <ReassignAppointmentsDrawer
          users={users}
          initialUser={action.provider}
          bulkAppointments={action.appts}
          onDone={clear}
          onClose={() => setAction(null)}
        />
      )}
    </div>
  );
}

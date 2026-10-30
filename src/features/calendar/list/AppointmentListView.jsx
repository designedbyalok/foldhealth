import { useMemo, useRef, useState } from 'react';
import { Checkbox } from '../../../components/ShadcnCheckbox/ShadcnCheckbox';
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
import { RingEmptyState } from '../../../components/RingEmptyState/RingEmptyState';
import { useAppStore } from '../../../store/useAppStore';
import { apptPerson, describeRange, initialsOf, OOO_ICON, recordsFor } from '../../ooo/oooUtils';
import { apptSpan } from '../../ooo/reassignUtils';
import { ReassignAppointmentsDrawer } from '../../ooo/ReassignAppointmentsDrawer';
import {
  dateLabel, groupByProvider, inPeriod, lockedReason, periodRange, sortAppointments, statusLabel, timeRangeLabel,
} from './appointmentList';
import { BulkRescheduleDrawer } from './BulkRescheduleDrawer';
import { CancelAppointmentsDialog } from './CancelAppointmentsDialog';
import styles from './AppointmentListView.module.css';

const ONE_PROVIDER = 'Select appointments from one provider at a time';

// What the Status badge can change an appointment to, and what each saves as.
const STATUS_OPTIONS = ['Scheduled', 'No Show', 'Checked In', 'Checked Out', 'Cancelled'];

const STATUS_TONE = { Scheduled: 'grey', 'Checked In': 'success', 'Checked Out': 'success', Cancelled: 'error', 'No Show': 'grey' };

const COLUMNS = [
  { key: 'check', showCheckbox: true, width: 36 },
  { key: 'member', label: 'Member', width: 250 },
  { key: 'type', label: 'Appt Type', width: 240 },
  { key: 'status', label: 'Status', width: 120 },
  { key: 'department', label: 'Department', width: 160 },
  { key: 'when', label: 'Date & Time', width: 210, sortKey: 'date', sortType: 'date' },
  { key: 'reason', label: 'Reason for Visit' },
  { key: 'actions', width: 40 },
];

const ROW_MENU = [
  { key: 'view', label: 'View Details', icon: 'solar:eye-linear' },
  { key: 'edit', label: 'Edit Appointment', icon: 'solar:pen-linear' },
  { key: 'cancel', label: 'Cancel Appointment', iconElement: <CalendarCrossIcon size={16} color="var(--status-error)" />, danger: true },
];

/**
 * The calendar's List view (VBC-25651, Figma 3023:575134): the period's
 * appointments (same filters as the calendar), grouped by provider. Rows
 * from one provider can be picked together for a bulk Reschedule, Reassign
 * or Cancel; checked-in, checked-out and cancelled ones can't be picked.
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
  // Picks are one provider's: { provider: groupKey, ids: Set }.
  const [selection, setSelection] = useState({ provider: null, ids: new Set() });
  const [action, setAction] = useState(null); // { kind: 'reschedule'|'reassign'|'cancel', appts, provider }
  const [menu, setMenu] = useState(null); // { appt, anchor }
  const menuAnchor = useRef(null);
  const openQuickView = useAppStore(s => s.openQuickView);
  const oooRecords = useAppStore(s => s.oooRecords);
  const allPatients = useAppStore(s => s.allPatients);
  // "F • 67Y • #10035" when the appointment links to a known patient.
  const memberMeta = (a) => {
    const p = a.patient_id ? (allPatients || []).find(x => String(x.id) === String(a.patient_id) || String(x.memberId) === String(a.patient_id)) : null;
    if (!p) return '';
    const gender = (p.gender || p.g || '')[0];
    return [gender, p.age != null ? `${p.age}Y` : null, p.memberId ? `#${p.memberId}` : null].filter(Boolean).join(' • ');
  };
  // The provider's out of office record covering this appointment, if any.
  const oooDuring = (a) => {
    const { start, end } = apptSpan(a);
    return recordsFor(oooRecords, apptPerson(a)).find(r => start < new Date(r.endAt).getTime() && end > new Date(r.startAt).getTime()) || null;
  };
  const updateAppointment = useAppStore(s => s.updateAppointment);
  const setAppointmentsStatus = useAppStore(s => s.setAppointmentsStatus);

  const markNoShow = async () => {
    if (!selected.length) return;
    const ok = await setAppointmentsStatus(selected, 'No Show');
    if (!ok) { toast.error('Appointments could not be updated. Try again.'); return; }
    toast.success('Status Updated Successfully');
    clear();
  };

  // Cancelling asks for a reason; the rest save straight away.
  const changeStatus = async (a, next) => {
    if (next === statusLabel(a)) return;
    if (next === 'Cancelled') { setAction({ kind: 'cancel', appts: [a] }); return; }
    const ok = await updateAppointment(a.id, { status: next });
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
      const ids = new Set([...s.ids].filter(id => rows.some(a => a.id === id && !lockedReason(a))));
      return ids.size === s.ids.size ? s : { provider: ids.size ? s.provider : null, ids };
    });
  }

  const pageRows = rows.slice((page - 1) * perPage, page * perPage);
  const groups = groupByProvider(pageRows);
  const allGroups = useMemo(() => groupByProvider(rows), [rows]);
  const selected = rows.filter(a => selection.ids.has(a.id));
  const selectedGroup = allGroups.find(g => g.key === selection.provider) || null;

  const clear = () => setSelection({ provider: null, ids: new Set() });
  const toggle = (group, ids, on) => setSelection((s) => {
    const next = new Set(s.provider === group.key ? s.ids : []);
    ids.forEach(id => (on ? next.add(id) : next.delete(id)));
    return { provider: next.size ? group.key : null, ids: next };
  });
  const blockedBy = (group) => (selection.provider && selection.provider !== group.key ? ONE_PROVIDER : '');

  const onSort = (key) => setSort(s => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));

  const startBulk = (kind) => {
    if (!selected.length || !selectedGroup) return;
    setAction({ kind, appts: selected, provider: selectedGroup.person });
  };

  // A checkbox that explains itself when it can't be used.
  const pick = (tip, checkbox, className = '') => (
    // Left-anchored: the checkboxes sit at the list's left edge, where a
    // centred tooltip would run under the nav.
    <Tooltip label={tip} maxWidth={240} align="left">
      <span className={`${tip ? styles.checkDisabled : styles.check} ${className}`}>{checkbox}</span>
    </Tooltip>
  );

  const renderRow = (group, a) => {
    const tip = lockedReason(a) || blockedBy(group);
    const checked = selection.ids.has(a.id);
    const status = statusLabel(a);
    const ooo = oooDuring(a);
    const cell = (content, extra = '') => <td className={`${profileCellClass} ${extra}`}><span className={styles.cellText}>{content}</span></td>;
    return (
      <tr key={a.id} className={`${profileRowClass} ${styles.row} ${checked ? styles.rowPicked : ''} ${highlightIds?.has(a.id) ? styles.rowHighlight : ''}`}>
        <td className={`${profileCellClass} ${styles.checkCell}`}>
          {pick(tip, (
            <Checkbox
              checked={checked}
              disabled={!!tip}
              onCheckedChange={(v) => toggle(group, [a.id], !!v)}
              aria-label={`Select ${a.patient_name || 'appointment'}`}
            />
          ))}
        </td>
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
            {memberMeta(a) && <span className={styles.memberMeta}>({memberMeta(a)})</span>}
          </span>
        </td>
        {cell(a.appointment_type_name)}
        <td className={profileCellClass}>
          <BadgeSelect
            value={status}
            options={STATUS_OPTIONS}
            onChange={(next) => changeStatus(a, next)}
            tone={STATUS_TONE[status] || 'grey'}
            size="S"
            align="left"
          />
        </td>
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
        <td className={`${profileCellClass} ${styles.actionCell}`}>
          <ActionButton
            icon="solar:menu-dots-linear"
            size="sm"
            tooltip="More actions"
            onClick={(e) => { menuAnchor.current = e.currentTarget; setMenu({ appt: a }); }}
          />
        </td>
      </tr>
    );
  };

  return (
    <div className={styles.root}>
      <div className={styles.scroller}>
        {!rows.length && (
          <div className={styles.empty}>
            <RingEmptyState icon="solar:calendar-linear" label="No appointments match this period and these filters" />
          </div>
        )}
        {groups.map((group) => {
          const full = allGroups.find(g => g.key === group.key) || group;
          const pickable = full.appointments.filter(a => !lockedReason(a)).map(a => a.id);
          const picked = pickable.filter(id => selection.ids.has(id)).length;
          const blocked = blockedBy(group) || (!pickable.length ? 'Nothing here can be rescheduled, reassigned or cancelled' : '');
          const allState = picked && picked === pickable.length ? true : picked ? 'indeterminate' : false;
          const open = isOpen(group.key);
          const n = full.appointments.length;
          return (
            // Each provider is a section, as Tasks groups by status
            // (Figma Tasks 866:7982), over the standard worklist table.
            <section key={group.key} className={styles.group}>
              <div className={styles.groupRow}>
                {pick(blocked, (
                  <Checkbox
                    checked={allState}
                    disabled={!!blocked}
                    onCheckedChange={() => toggle(group, pickable, picked !== pickable.length)}
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
                  <span className={styles.groupCount}><Badge tone="grey" size="S" label={`${n} ${n === 1 ? 'Appointment' : 'Appointments'}`} /></span>
                  <Icon name="solar:alt-arrow-down-linear" size={12} className={open ? styles.caretOpen : styles.caret} />
                </button>
              </div>
              {open && (
                <WorklistShell
                  embedded
                  embeddedNoScroll
                  header={null}
                  hideBulkBar
                  fixedLayout
                  minTableWidth={1200}
                  columns={COLUMNS}
                  sortKey={sort.key}
                  sortDir={sort.dir}
                  onSort={onSort}
                  rows={group.appointments}
                  renderRow={(a) => renderRow(group, a)}
                  selectedIds={group.appointments.filter(a => selection.ids.has(a.id)).map(a => a.id)}
                  selectAll={{ checked: allState, disabled: !!blocked, tooltip: blocked }}
                  onSelectAll={() => toggle(group, pickable, picked !== pickable.length)}
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
          totalItems={rows.length}
          onPageChange={setPage}
          onPerPageChange={(n) => { setPerPage(n); setPage(1); }}
        />
      )}

      <BulkBar
        selectedIds={selected.map(a => a.id)}
        onClear={clear}
        actions={[
          { label: 'Reschedule', iconElement: <CalendarRefreshIcon size={16} />, size: 'md', onClick: () => startBulk('reschedule') },
          { label: 'Reassign', icon: 'solar:user-linear', size: 'md', onClick: () => startBulk('reassign') },
          { label: 'Mark as No Show', icon: 'solar:close-circle-linear', size: 'md', onClick: markNoShow },
        ]}
        moreActions={[
          // Edit is a later ticket.
          { label: 'Edit', icon: 'solar:pen-linear', onClick: () => {} },
          { label: 'Cancel', iconElement: <CalendarCrossIcon size={16} />, variant: 'destructive', onClick: () => startBulk('cancel') },
        ]}
      />

      {menu && (
        <MenuPopover
          anchorRef={menuAnchor}
          items={ROW_MENU.map(i => (i.key === 'cancel' && lockedReason(menu.appt) ? { ...i, disabled: true, hint: lockedReason(menu.appt) } : i))}
          width={200}
          ariaLabel="Appointment actions"
          onSelect={(key) => {
            const a = menu.appt;
            setMenu(null);
            if (key === 'view') onViewDetails(a);
            if (key === 'cancel') setAction({ kind: 'cancel', appts: [a] });
          }}
          onClose={() => setMenu(null)}
        />
      )}

      {action?.kind === 'cancel' && (
        <CancelAppointmentsDialog appointments={action.appts} onDone={clear} onClose={() => setAction(null)} />
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

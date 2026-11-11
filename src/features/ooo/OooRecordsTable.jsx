import { useEffect, useMemo, useRef } from 'react';
import { WorklistShell } from '../../components/WorklistShell/WorklistShell';
import { Avatar } from '../../components/Avatar/Avatar';
import { Badge } from '../../components/Badge/Badge';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Icon } from '../../components/Icon/Icon';
import { UserSwitchIcon } from '../../components/Icon/UserSwitchIcon';
import { TruncatedText } from '../../components/TruncatedText/TruncatedText';
import { Tooltip } from '../../components/Tooltip/Tooltip';
import { useAppStore } from '../../store/useAppStore';
import { useScrollbarOnScroll } from '../../lib/useScrollbarOnScroll';
import { openTasksByCard } from './openWork';
import { appointmentsToReassign, canDelete, canEdit, capFirst, coveringPeople, formatDateTime, initialsOf, oooStatus, recordsOnDate, STATUS_TONE } from './oooUtils';
import styles from './OooRecordsTable.module.css';

// Start and end in their own columns, each on one line. The user column is
// 300px on the full page, 280px in a drawer. Reason takes what's left (the table scrolls sideways below its minimum width).
const columnsFor = (wide, showUser) => [
  ...(showUser ? [{ key: 'user', label: 'User', sticky: 'left', left: 0, width: wide ? 300 : 280 }] : []),
  // Just wide enough for the longest status badge ("Upcoming").
  { key: 'status', label: 'Status', width: 112 },
  { key: 'start', label: 'Start Date & Time', width: 184 },
  { key: 'end', label: 'End Date & Time', width: 184 },
  { key: 'coveredBy', label: 'Covered By', width: 200 },
  { key: 'reason', label: 'Reason' },
  // When it was added and last changed, each over who did it.
  { key: 'created', label: 'Created', width: 184 },
  { key: 'updated', label: 'Last Updated', width: 184 },
  // The edge line is an inset shadow, not a border: with collapsed borders a
  // border stays at the column's spot in the table and only lines up when
  // scrolled all the way right.
  { key: 'actions', label: 'Actions', sticky: 'right', width: 156, thStyle: { boxShadow: 'inset 0.5px 0 0 var(--neutral-150)' } },
];

/** A date and time over the person, like Care Plan Library's Last Update. */
function StampCell({ at, by }) {
  if (!at) return '–';
  return (
    <span className={styles.stamp}>
      <span className={styles.stampAt}>{formatDateTime(at)}</span>
      {by && <span className={styles.stampBy}>{by}</span>}
    </span>
  );
}

/**
 * Who covers: the first covering provider as a grey badge, the rest as
 * "+N". Covering is per location, so hovering lists each provider with the
 * locations they cover.
 */
function CoveredByCell({ coverage }) {
  const people = coveringPeople(coverage);
  if (!people.length) return '-';
  const [first, ...rest] = people;
  const list = (
    <span className={styles.coverList}>
      {people.map(p => (
        <span key={p.name}>{p.name}{p.locations.length > 0 && ` • ${p.locations.join(', ')}`}</span>
      ))}
    </span>
  );
  return (
    <Tooltip label={list} placement="bottom" align="start">
      <span className={styles.coverCell}>
        <Badge tone="neutral" size="sm" icon="solar:user-linear" className={styles.coverBadge} label={<span className={styles.coverName}>{first.name}</span>} />
        {rest.length > 0 && <Badge tone="neutral" size="sm" label={`+${rest.length}`} />}
      </span>
    </Tooltip>
  );
}

/**
 * Out of Office records in the shared WorklistShell table: Start, End, Covered By, Reason,
 * Status and Actions, with a sticky User column when it lists several
 * users. Past records are read-only; an ongoing one can be edited but not
 * deleted. The Reassign action keeps the scheduler's to-do: it's enabled,
 * with a dot, while the provider still has open work in those dates
 * (upcoming appointments, open tasks), and opens the record at Reassign
 * Open Work.
 *
 * @param {object}   props
 * @param {object[]} props.records
 * @param {boolean}  [props.showUser]      – Add the User column
 * @param {boolean}  [props.oneLineDates]  – Full-page layout: the user column takes a share of the row
 * @param {string}   [props.highlightDate] – ISO date; rows out that day are tinted and outlined
 * @param {string}   [props.highlightId]   – One record to tint and outline instead
 * @param {boolean}  [props.loading]
 * @param {React.ReactNode} [props.emptyState]
 * @param {boolean}  [props.embedded]      – Grow with the content inside a scrolling parent
 * @param {object}   [props.pagination]    – { page, perPage, totalItems, onPageChange, onPageSizeChange }
 * @param {function} props.onEdit          – (record) => void
 * @param {function} props.onDelete        – (record) => void
 * @param {function} [props.onReassign]    – (record) => void
 */
export function OooRecordsTable({ records, showUser = false, oneLineDates = false, highlightDate, highlightId, loading, emptyState, embedded = false, pagination, onEdit, onDelete, onReassign }) {
  const columns = useMemo(() => columnsFor(oneLineDates, showUser), [showUser, oneLineDates]);
  const highlighted = new Set(highlightId ? [highlightId] : highlightDate ? recordsOnDate(records, highlightDate).map(r => r.id) : []);
  // A single highlighted record scrolls into view (it keeps its place in the list).
  const onPage = !!highlightId && (records || []).some(r => r.id === highlightId);
  useEffect(() => {
    if (!onPage) return;
    document.querySelector(`[data-ooo-record="${highlightId}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [onPage, highlightId]);
  const wrapRef = useRef(null);
  useScrollbarOnScroll(wrapRef);
  const now = new Date();
  // Under the name, the role as User Availability shows it: the user's
  // first clinical role, or Staff.
  const platformUsers = useAppStore(s => (s.platformPeople?.length ? s.platformPeople : s.platformUsers));
  const roleOf = useMemo(() => {
    const byName = new Map((platformUsers || []).map(u => [String(u.name || '').trim().toLowerCase(), u.clinicalRoles?.[0]]));
    return (r) => byName.get(String(r.userName || '').trim().toLowerCase()) || 'Staff';
  }, [platformUsers]);

  // Appointments feed the Reassignment column; load them once if this page
  // is the first to need them (e.g. Settings opened before the calendar).
  const appointments = useAppStore(s => s.appointments);
  const fetchAppointments = useAppStore(s => s.fetchAppointments);
  const askedRef = useRef(false);
  useEffect(() => {
    if (!askedRef.current && !(appointments || []).length) { askedRef.current = true; fetchAppointments?.(); }
  }, [appointments, fetchAppointments]);
  // Open tasks count too: Reassign opens the record's Reassign Open Work.
  const tasks = useAppStore(s => s.tasks);
  const fetchTasks = useAppStore(s => s.fetchTasks);
  useEffect(() => { fetchTasks?.(); }, [fetchTasks]);

  const renderRow = (r) => {
    const status = oooStatus(r, now);
    const editable = canEdit(r, now);
    const deletable = canDelete(r, now);
    // Open work still with the user in these dates: upcoming appointments and
    // open tasks (care programs load only once Reassign Open Work opens).
    const left = status === 'Past' ? 0 : appointmentsToReassign(r, appointments, now).length
      + Object.values(openTasksByCard(tasks, { id: r.userId, name: r.userName }, r.endAt)).reduce((n, l) => n + l.length, 0);
    return (
      <tr key={r.id} data-ooo-record={r.id} className={[styles.row, highlighted.has(r.id) ? styles.rowHighlight : ''].filter(Boolean).join(' ')}>
        {showUser && (
          <td className={`${styles.membersTd} ${styles.stickyLeft}`} style={{ left: 0 }}>
            <span className={styles.userCell}>
              <Avatar variant="staff" size="M" initials={initialsOf(r.userName)} ooo={null} />
              <span className={styles.userText}>
                <span className={styles.userName}>{r.userName}</span>
                <span className={styles.userSub}>{roleOf(r)}</span>
              </span>
            </span>
          </td>
        )}
        <td className={styles.td}><Badge tone={STATUS_TONE[status]} size="sm" label={status} /></td>
        <td className={styles.td}>{formatDateTime(r.startAt)}</td>
        <td className={styles.td}>{formatDateTime(r.endAt)}</td>
        <td className={styles.td}><CoveredByCell coverage={r.coverage} /></td>
        <td className={styles.td}><TruncatedText text={capFirst(r.reason) || '–'} /></td>
        <td className={styles.td}><StampCell at={r.createdAt} by={r.createdBy} /></td>
        <td className={styles.td}><StampCell at={r.updatedAt || r.createdAt} by={r.updatedBy || r.createdBy} /></td>
        <td className={`${styles.td} ${styles.stickyRight}`}>
          <span className={`${styles.actionsCell} ${styles.actionsGap}`}>
            {/* Enabled only where appointments still need moving, and then
                marked with a dot so the to-do stands out down the column. */}
            {onReassign && (
              <>
                <ActionButton
                  tooltip={left ? `Reassign ${left} Open Item${left === 1 ? '' : 's'}` : status === 'Past' ? 'Past records can\'t be reassigned' : 'No open work to reassign'}
                  tooltipLeft
                  tooltipBelow
                  disabled={!left}
                  dot={!!left}
                  aria-label={left ? `Reassign ${left} open item${left === 1 ? '' : 's'}` : 'Reassign open work'}
                  onClick={() => left && onReassign(r)}
                >
                  <UserSwitchIcon size={16} color={left ? 'var(--neutral-300)' : 'var(--neutral-150)'} />
                </ActionButton>
                <span className={styles.actionDivider} aria-hidden="true" />
              </>
            )}
            {/* Both glyphs at 16px (Solar's pen fills its frame, so the trash
                at the default 20px read bigger). Tooltips open leftward, as
                the column sits at the table's right edge; a disabled action
                says why. */}
            <ActionButton
              tooltip={editable ? 'Edit' : 'Past records can\'t be edited'}
              tooltipLeft
              tooltipBelow
              disabled={!editable}
              aria-label="Edit Out of Office record"
              onClick={() => editable && onEdit(r)}
            >
              <Icon name="solar:pen-linear" size={16} color={editable ? 'var(--neutral-300)' : 'var(--neutral-150)'} />
            </ActionButton>
            <span className={styles.actionDivider} aria-hidden="true" />
            <ActionButton
              tooltip={deletable ? 'Delete' : status === 'Ongoing' ? 'Ongoing records can\'t be deleted' : 'Past records can\'t be deleted'}
              tooltipLeft
              tooltipBelow
              disabled={!deletable}
              aria-label="Delete Out of Office record"
              onClick={() => deletable && onDelete(r)}
            >
              <Icon name="solar:trash-bin-minimalistic-linear" size={16} color={deletable ? 'var(--neutral-300)' : 'var(--neutral-150)'} />
            </ActionButton>
          </span>
        </td>
      </tr>
    );
  };

  return (
    // The wrapper only sets the first column's left inset (header and cells).
    // With no records, only the empty state shows (no column headers).
    <div ref={wrapRef} className={[embedded ? styles.wrapEmbedded : styles.wrap, 'scrollbar-x-on-scroll', !loading && !records?.length ? styles.empty : ''].filter(Boolean).join(' ')}>
    <WorklistShell
      header={null}
      columns={columns}
      rows={records}
      renderRow={renderRow}
      loading={loading}
      emptyState={emptyState}
      embedded={embedded}
      // Every fixed column plus at least 160px for Reason before it scrolls
      // sideways (on the full page the User column is 22% of the table).
      minTableWidth={showUser ? (oneLineDates ? 1692 : 1644) : 1364}
      page={pagination?.page}
      perPage={pagination?.perPage}
      totalItems={pagination?.totalItems}
      onPageChange={pagination?.onPageChange}
      onPageSizeChange={pagination?.onPageSizeChange}
    />
    </div>
  );
}

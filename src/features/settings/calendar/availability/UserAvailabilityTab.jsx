import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { SectionTitleBar } from '../../../../components/SectionTitleBar/SectionTitleBar';
import { WorklistShell } from '../../../../components/WorklistShell/WorklistShell';
import { Avatar } from '../../../../components/Avatar/Avatar';
import { Badge } from '../../../../components/Badge/Badge';
import { Button } from '../../../../components/Button/Button';
import { ActionButton } from '../../../../components/ActionButton/ActionButton';
import { MenuPopover } from '../../../../components/MenuPopover/MenuPopover';
import { SearchBar } from '../../../../components/SearchBar/SearchBar';
import { SearchIconButton } from '../../../../components/SearchIconButton/SearchIconButton';
import { EmptyState } from '../../../../components/EmptyState/EmptyState';
import { Link } from '../../../../components/Link/Link';
import { Icon } from '../../../../components/Icon/Icon';
import { Banner } from '../../../../components/Banner/Banner';
// Used by the old view's action cell (commented out below).
// import { Tooltip } from '../../../../components/Tooltip/Tooltip';
import { AddIconMinimalist } from '../../../../components/Icon/AddIconMinimalist';
import { ConfirmDialog } from '../../../../components/ConfirmDialog/ConfirmDialog';
import { toast } from '../../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../../store/useAppStore';
import { OooUserRecordsDrawer } from '../../../ooo/OooRecordsDrawers';
import { OOO_ICON } from '../../../ooo/oooUtils';
import { UserAvailabilityDrawer } from './UserAvailabilityDrawer';
// The list, or This Week (providers by day, from the redesign view).
import { UserAvailabilityNewView } from './UserAvailabilityNewView';
import { UserPickerPopover } from '../../../../components/UserPickerPopover/UserPickerPopover';
import { DateRangePopover } from '../../../../components/DateRangePopover/DateRangePopover';
import { fmtDay } from '../../../../components/DateRangeFilter/dateRangePresets';
import { SegmentedControl } from '../../../../components/SegmentedControl/SegmentedControl';
import { FilterChip } from '../../../../components/FilterChip/FilterChip';
import {
  blockStatus, STATUS_LOOK, cadenceText, formatDate, slotText, slotTextTz, ALL_TYPES,
} from './availabilityUtils';
import styles from './UserAvailability.module.css';

const PER_PAGE = 15;
const SHOWN_BLOCKS = 2;
const NOTICE_KEY = 'fold-user-availability-notice-dismissed';
const noticeDismissed = () => { try { return localStorage.getItem(NOTICE_KEY) === '1'; } catch { return false; } };
const COLLAPSE_MS = 180;
const STATUS_ORDER = { active: 0, upcoming: 1, expired: 2 };

// // Every column has room for its content; below the table's minimum width
// // it scrolls sideways (User and Actions stay pinned).
// const COLUMNS = [
//   { key: 'user', label: 'User', sticky: 'left', left: 0, width: 240 },
//   { key: 'status', label: 'Status', width: 112 },
//   { key: 'location', label: 'Location', width: 180 },
//   { key: 'repeats', label: 'Cadence', width: 240 },
//   { key: 'dates', label: 'Dates', width: 210 },
//   { key: 'hours', label: 'Hours', width: 240 },
//   { key: 'actions', label: 'Actions', sticky: 'right', width: 152 },
// ];

// Figma 2981:10929: status leads, then location, start & end date, how it
// repeats, and each time range with its appointment types.
const COLUMNS = [
  { key: 'user', label: 'User', sticky: 'left', left: 0, width: 240, sortKey: 'name', sortType: 'alpha' },
  { key: 'status', label: 'Status', width: 120 },
  { key: 'location', label: 'Location', width: 170 },
  { key: 'dates', label: 'Start & End Date', width: 200, sortKey: 'startDate', sortType: 'date' },
  // Repeats fits its longest text on the page, up to 224px (see repeatsWidth);
  // Details takes the rest.
  { key: 'repeats', label: 'Repeats', width: 224 },
  { key: 'details', label: 'Details' },
  { key: 'actions', label: 'Actions', sticky: 'right', width: 105 },
];
const REPEATS_MAX = 224;
const REPEATS_MIN = 96;
const CELL_PADDING_X = 24;
let measureCtx = null;
// Width of the widest Repeats line (pattern or days) at the cell's type size.
function repeatsWidth(lines) {
  if (!lines.length) return REPEATS_MAX;
  measureCtx ||= document.createElement('canvas').getContext('2d');
  const body = getComputedStyle(document.body);
  measureCtx.font = `400 ${body.getPropertyValue('--font-base').trim() || '14px'} ${body.fontFamily}`;
  const widest = Math.max(...lines.map(t => measureCtx.measureText(t).width));
  return Math.min(REPEATS_MAX, Math.max(REPEATS_MIN, Math.ceil(widest) + CELL_PADDING_X + 2));
}
const STATUS_FILTER = { Active: 'active', Upcoming: 'upcoming', Past: 'expired' };
// The List opens on what's current: Active and Upcoming (Past is a pick away).
const DEFAULT_STATUSES = ['Active', 'Upcoming'];
const isDefaultStatus = (v) => v.length === DEFAULT_STATUSES.length && DEFAULT_STATUSES.every(k => v.includes(k));

const ROW_MENU = [
  { key: 'add', icon: 'solar:add-linear', label: 'Add availability' },
  // Parked: Clone availability from the row menu (source first, then pick
  // who it's for). The drawer still supports it via `cloneFrom`; uncomment
  // to bring it back. Cloning lives in the drawer's "Clone from another user".
  // { key: 'clone', icon: 'solar:copy-linear', label: 'Clone availability' },
  { key: 'ooo', icon: OOO_ICON, label: 'View OOO records' },
  { divider: true },
  { key: 'delete', icon: 'solar:trash-bin-minimalistic-linear', label: 'Delete availability', danger: true },
];

// Clone and Delete (and the Edit button) only make sense for someone with availability of
// their own; everyone else just gets View OOO records (+ adds).
const OWN_ONLY = ['add', 'clone', 'delete'];

// This Week puts every action in the ⋯ menu, Edit first.
const WEEK_MENU = [{ key: 'edit', icon: 'solar:pen-linear', label: 'Edit availability' }, ...ROW_MENU];
const weekMenuFor = (hasBlocks) => (hasBlocks ? WEEK_MENU : WEEK_MENU.filter(m => ['add', 'ooo'].includes(m.key)));

function RowMenu({ onSelect, hasBlocks, items }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  return (
    <span ref={ref}>
      <ActionButton icon="solar:menu-dots-linear" tooltip="More options" tooltipLeft onClick={() => setOpen(v => !v)} />
      {open && (
        <MenuPopover
          anchorRef={ref}
          ariaLabel="User availability actions"
          items={items || (hasBlocks ? ROW_MENU : ROW_MENU.filter(m => !m.divider && !OWN_ONLY.includes(m.key)))}
          width={200}
          onSelect={(key) => { setOpen(false); onSelect(key); }}
          onClose={() => setOpen(false)}
        />
      )}
    </span>
  );
}

/**
 * Settings → Calendar → User availability (Figma 2981:10929): each user's
 * availability blocks (status, location, start & end date, how it repeats,
 * time ranges with their appointment types). Active blocks lead; the rest
 * fold under "Show N More". Filters open from the icon beside search. Users
 * without their own availability take their locations' practice hours.
 *
 * `embedded` shows just the Week view, without the settings title bar, for
 * the Calendar's Available Slots layout, on the week of `weekOf` (ISO day),
 * or just the day `onlyDay`. There the Calendar's own filter chips apply:
 * `filterUsers` (names), `filterLocations` and `filterTypes`, and its search,
 * `searchQuery`.
 */
export function UserAvailabilityTab({ tabs, activeTab, onTabChange, embedded = false, weekOf, onlyDay, filterUsers, filterLocations, filterTypes, searchQuery }) {
  const platformUsers = useAppStore(s => s.platformUsers);
  const taskProfiles = useAppStore(s => s.taskProfiles);
  const usersFetched = useAppStore(s => s.platformUsersDidFetch);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  const blocks = useAppStore(s => s.userAvailability);
  const blocksFetched = useAppStore(s => s.userAvailabilityFetched);
  const fetchUserAvailability = useAppStore(s => s.fetchUserAvailability);
  useEffect(() => { fetchPlatformUsers?.(); fetchUserAvailability(); }, [fetchPlatformUsers, fetchUserAvailability]);

  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [layout, setLayout] = useState(embedded ? 'week' : 'list');
  const [fLocations, setFLocations] = useState([]);
  const [fStatuses, setFStatuses] = useState(DEFAULT_STATUSES);
  const [fTypes, setFTypes] = useState([]);
  const [fUsers, setFUsers] = useState([]);
  // 'Fixed Slot' (has an end date) / 'Rolling Slot' (none).
  const [fSpans, setFSpans] = useState([]);
  // [fromISO, toISO]: keeps slots that run on any day in it.
  const [fRange, setFRange] = useState([]);
  // { key: 'name' | 'startDate', dir: 'asc' | 'desc' } or null for the default order.
  const [sort, setSort] = useState(null);
  const sortDir = sort?.key === 'startDate' ? sort.dir : null;
  const [showNotice, setShowNotice] = useState(() => !noticeDismissed());
  const dismissNotice = () => {
    setShowNotice(false);
    try { localStorage.setItem(NOTICE_KEY, '1'); } catch { /* storage blocked: hide for now only */ }
  };
  const [searchOpen, setSearchOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(PER_PAGE);
  const [expanded, setExpanded] = useState(() => new Set());
  const [editing, setEditing] = useState(null); // { user }, { cloneFrom }, or {} for a new one
  const [oooUser, setOooUser] = useState(null);
  const saveUserAvailability = useAppStore(s => s.saveUserAvailability);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const deleteAvailability = async () => {
    setDeleteBusy(true);
    const ok = await saveUserAvailability(deleting, []);
    setDeleteBusy(false);
    if (ok) {
      toast.success(`Availability deleted for ${deleting.name}`);
      setDeleting(null);
    }
  };

  const users = useMemo(() => {
    // The filters apply in both views. In Week, the default Status (Active,
    // Upcoming) isn't applied, so a past week still shows what ran then.
    const listView = layout === 'list';
    const locs = embedded ? filterLocations || [] : fLocations;
    const stats = listView || !isDefaultStatus(fStatuses) ? fStatuses : [];
    const types = embedded ? filterTypes || [] : fTypes;
    const range = fRange;
    const people = embedded ? filterUsers || [] : fUsers;
    const spans = fSpans;
    const locSet = new Set(locs);
    const typeSet = new Set(types);
    const peopleSet = new Set(people);
    const spanSet = new Set(spans);
    const emails = Object.fromEntries((taskProfiles || []).map(p => [p.name, p.email]));
    const byName = new Map();
    (blocks || []).forEach(b => { const k = b.userName?.toLowerCase(); if (k) byName.set(k, [...(byName.get(k) || []), b]); });
    const q = (embedded ? searchQuery || '' : query).trim().toLowerCase();
    return (platformUsers || [])
      .map(u => ({
        ...u,
        email: emails[u.name] || u.email,
        role: u.clinicalRoles?.[0] || 'Staff',
        blocks: (byName.get(u.name.toLowerCase()) || [])
          .map(b => ({ ...b, status: blockStatus(b) }))
          .sort((a, b) => sortDir
            ? (sortDir === 'asc' ? 1 : -1) * a.startDate.localeCompare(b.startDate)
            : STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.startDate.localeCompare(b.startDate)),
      }))
      .filter(u => !q || u.name.toLowerCase().includes(q) || String(u.email || '').toLowerCase().includes(q))
      // User narrows people, not slots: everyone picked stays listed.
      .filter(u => !people.length || peopleSet.has(u.name))
      // Filters narrow each user's blocks; with any on, users left with none drop out.
      .map(u => ({
        ...u,
        blocks: u.blocks.filter(b => (!locs.length || locSet.has(b.location))
          // No status picked shows every slot (This Week always does: a past
          // week shows what was available then).
          && (!stats.length || stats.some(k => STATUS_FILTER[k] === b.status))
          // In the Calendar a slot open to every type matches any type picked.
          && (!types.length || (b.slots || []).some(sl => typeSet.has(sl.appointmentType || ALL_TYPES) || (embedded && !sl.appointmentType)))
          && (!spans.length || spanSet.has(b.endDate ? 'Fixed Slot' : 'Rolling Slot'))
          && (range.length !== 2 || (b.startDate <= range[1] && (b.endDate || '9999-12-31') >= range[0]))),
      }))
      // The default Active + Upcoming doesn't count as narrowing: users on
      // practice hours stay listed.
      .filter(u => !(locs.length || (stats.length && !isDefaultStatus(stats)) || types.length || range.length || spans.length) || u.blocks.length)
      // People with their own availability first, then by name.
      // Sorted by date, a user ranks by their first slot (now leading their rows).
      // Sorted by name, it's purely alphabetical.
      .sort((a, b) => (sort?.key === 'name'
        ? (sort.dir === 'asc' ? 1 : -1) * a.name.localeCompare(b.name)
        : (b.blocks.length > 0) - (a.blocks.length > 0)
          || (sortDir && a.blocks.length && (sortDir === 'asc' ? 1 : -1) * a.blocks[0].startDate.localeCompare(b.blocks[0].startDate))
          || a.name.localeCompare(b.name)));
  }, [platformUsers, taskProfiles, blocks, query, layout, fLocations, fStatuses, fTypes, fRange, fUsers, fSpans, sort, sortDir, embedded, filterUsers, filterLocations, filterTypes, searchQuery]);
  // For the User filter: keyed by name (what fUsers holds), with role for the second line.
  const pickerUsers = useMemo(() => (platformUsers || [])
    .filter(u => u.name)
    .map(u => ({ name: u.name, role: u.clinicalRoles?.[0] || 'Staff', initials: u.initials }))
    .sort((a, b) => a.name.localeCompare(b.name)), [platformUsers]);
  const allLocations = useMemo(() => [...new Set((blocks || []).map(b => b.location).filter(Boolean))].sort(), [blocks]);
  const allTypes = useMemo(() => [...new Set((blocks || []).flatMap(b => (b.slots || []).map(sl => sl.appointmentType || ALL_TYPES)))].sort(), [blocks]);
  const filtersOn = fLocations.length || !isDefaultStatus(fStatuses) || fTypes.length || fRange.length || fUsers.length || fSpans.length;

  const lastPage = Math.max(1, Math.ceil(users.length / perPage));
  const pageNow = Math.min(page, lastPage);
  const rows = users.slice((pageNow - 1) * perPage, pageNow * perPage);
  const columns = useMemo(() => {
    const lines = rows.flatMap(u => (u.blocks || []).flatMap(b => cadenceText(b).split(' • ')));
    const w = repeatsWidth(lines);
    return COLUMNS.map(c => (c.key === 'repeats' ? { ...c, width: w } : c));
  }, [rows]);

  // Show more opens at once and eases the rows in; Show less eases them out
  // first, then removes them.
  const [closing, setClosing] = useState(() => new Set());
  const toggle = (id) => {
    if (!expanded.has(id)) {
      setExpanded(s => new Set(s).add(id));
      return;
    }
    setClosing(s => new Set(s).add(id));
    setTimeout(() => {
      setExpanded(s => { const n = new Set(s); n.delete(id); return n; });
      setClosing(s => { const n = new Set(s); n.delete(id); return n; });
    }, COLLAPSE_MS);
  };

  const tools = (
    <>
      <SegmentedControl size="sm" items={[{ key: 'list', label: 'List' }, { key: 'week', label: 'Week' }]} value={layout} onValueChange={setLayout} />
      <span className={styles.toolDivider} aria-hidden="true" />
      {searchOpen ? (
        <SearchBar
          placeholder="Search users"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          onClose={() => { setSearchOpen(false); setQuery(''); setPage(1); }}
        />
      ) : (
        <SearchIconButton tooltipBelow onClick={() => setSearchOpen(true)} />
      )}
      {/* Search | Filter */}
      <span className={styles.toolDivider} aria-hidden="true" />
      <ActionButton icon="custom:filter" tooltip={filtersOpen ? 'Hide filters' : 'Filters'} tooltipBelow active={filtersOpen || !!filtersOn} onClick={() => setFiltersOpen(o => !o)} />
      <span className={styles.toolDivider} aria-hidden="true" />
      <Button variant="outline" leadingIconElement={<AddIconMinimalist size={16} color="currentColor" />} onClick={() => setEditing({})}>Add new</Button>
    </>
  );

  const userCell = (u, span) => (
    <td rowSpan={span} className={`${styles.td} ${styles.userTd} ${styles.stickyLeft}`} style={{ left: 0 }}>
      <span className={styles.user}>
        <Avatar variant="staff" size="M" initials={u.initials} userName={u.name} userId={u.id} />
        <span className={styles.userText}>
          <span className={styles.userName}>{u.name}</span>
          <span className={styles.userSub}>{u.role}</span>
        </span>
      </span>
    </td>
  );
  // Edit opens the drawer on what they have; ⋯ holds Add, OOO records and
  // Delete. With no availability yet, + replaces Edit.
  const onRowAction = (u, key) => {
    if (key === 'edit') setEditing({ user: u });
    else if (key === 'add') setEditing({ user: u, addBlock: true });
    else if (key === 'ooo') setOooUser(u);
    else if (key === 'delete') setDeleting(u);
  };
  // Edit (or +) and the ⋯ menu.
  const rowActions = (u) => (
    <>
        {u.blocks.length > 0 ? (
          <ActionButton tooltip="Edit availability" tooltipLeft onClick={() => setEditing({ user: u })}>
            <Icon name="solar:pen-linear" size={16} color="var(--neutral-300)" />
          </ActionButton>
        ) : (
          <ActionButton icon="solar:add-linear" tooltip="Add availability" tooltipLeft onClick={() => setEditing({ user: u, addBlock: true })} />
        )}
        <span className={styles.actionDivider} aria-hidden="true" />
        <RowMenu
          hasBlocks={u.blocks.length > 0}
          onSelect={(key) => onRowAction(u, key)}
        />
    </>
  );
  const actionCell = (u, span) => (
    <td rowSpan={span} className={`${styles.td} ${styles.actionTd} ${styles.stickyRight}`}>
      <span className={styles.actions}>{rowActions(u)}</span>
    </td>
  );

  // Old view's action cell (+ | edit | ⋯), kept for reference.
//   // + adds an availability block: the drawer opens on a fresh one, after
//   // any the user already has. The pen opens the drawer on what they have.
//   const actionCell = (u, span) => (
//     <td rowSpan={span} className={`${styles.td} ${styles.actionTd} ${styles.stickyRight}`}>
//       <span className={styles.actions}>
//         <ActionButton icon="solar:add-linear" size="L" tooltip="Add availability" tooltipLeft onClick={() => setEditing({ user: u, addBlock: true })} />
//         <span className={styles.actionDivider} aria-hidden="true" />
//         {/* The pen's glyph fills its whole box, so it's drawn at 16px to read
//             the same size as the + and ⋯ beside it. With no availability there's
//             nothing to edit: shown disabled, with the reason on hover. */}
//         {u.blocks.length > 0 ? (
//           <ActionButton size="L" tooltip="Edit availability" tooltipLeft onClick={() => setEditing({ user: u })}>
//             <Icon name="solar:pen-linear" size={16} color="var(--neutral-300)" />
//           </ActionButton>
//         ) : (
//           <Tooltip label="No availability to edit yet" variant="light" placement="bottom" align="right">
//             <ActionButton size="L" state="disabled" style={{ pointerEvents: 'none' }}>
//               <Icon name="solar:pen-linear" size={16} color="var(--neutral-150)" />
//             </ActionButton>
//           </Tooltip>
//         )}
//         <span className={styles.actionDivider} aria-hidden="true" />
//         <RowMenu
//           hasBlocks={u.blocks.length > 0}
//           onSelect={(key) => {
//             if (key === 'ooo') setOooUser(u);
//             else if (key === 'delete') setDeleting(u);
//             // Parked with the menu item above.
//             // else if (key === 'clone') setEditing({ cloneFrom: u });
//           }}
//         />
//       </span>
//     </td>
//   );
//
  // Old view's rows (one row per time range), kept for reference.
//   const renderRow = (u) => {
//     if (!u.blocks.length) {
//       return (
//         <tr key={u.id || u.name} className={[styles.row, styles.rowEmpty].join(' ')}>
//           {userCell(u, 1)}
//           <td colSpan={5} className={`${styles.td} ${styles.inheritedTd}`}>
//             <span className={styles.inherited}>
//               <Icon name="solar:clock-circle-linear" size={16} color="var(--neutral-200)" />
//               No User Availability is configured for this provider. They currently follows availability schedule for their assigned practice.
//             </span>
//           </td>
//           {actionCell(u, 1)}
//         </tr>
//       );
//     }
//     const open = expanded.has(u.id || u.name);
//     const isClosing = closing.has(u.id || u.name);
//     const shown = open ? u.blocks : u.blocks.slice(0, SHOWN_BLOCKS);
//     const more = u.blocks.length - SHOWN_BLOCKS;
//     // Each time range is its own table row: the block's location, cadence,
//     // dates and status span them; only spacing separates a block's ranges.
//     const slotsOf = (blk) => (blk.slots.length ? blk.slots : [null]);
//     const span = shown.reduce((n, blk) => n + slotsOf(blk).length, 0) + (more > 0 ? 1 : 0);
//     return (
//       <Fragment key={u.id || u.name}>
//         {shown.map((b, i) => {
//           const look = STATUS_LOOK[b.status];
//           const slots = slotsOf(b);
//           const lastBlock = i === shown.length - 1 && !(more > 0);
//           return slots.map((s, k) => {
//             const firstOfBlock = k === 0;
//             const lastOfBlock = k === slots.length - 1;
//             return (
//               <tr
//                 key={`${b.id}-${k}`}
//                 className={[
//                   styles.row,
//                   b.status === 'expired' ? styles.rowExpired : '',
//                   lastOfBlock ? (lastBlock ? '' : styles.rowInGroup) : styles.rowSlot,
//                   !firstOfBlock ? styles.rowSlotNext : '',
//                   i >= SHOWN_BLOCKS ? (isClosing ? styles.rowHide : styles.rowReveal) : '',
//                 ].filter(Boolean).join(' ')}
//               >
//                 {i === 0 && firstOfBlock && userCell(u, span)}
//                 {firstOfBlock && (
//                   <>
//                     <td rowSpan={slots.length} className={styles.td}><Badge tone={look.tone} size="S" label={look.label} /></td>
//                     <td rowSpan={slots.length} className={styles.td}><span className={styles.cellText}>{b.location}</span></td>
//                     <td rowSpan={slots.length} className={styles.td}><span className={styles.cellText}>{cadenceText(b)}</span></td>
//                     <td rowSpan={slots.length} className={styles.td}><span className={styles.cellText}>{formatRange(b.startDate, b.endDate)}</span></td>
//                   </>
//                 )}
//                 <td className={styles.td}>
//                   {s && (
//                     <span className={styles.slot}>
//                       <span className={styles.slotTime}>{slotText(s)}</span>
//                       <span className={styles.slotType}>{s.appointmentType || ALL_TYPES}</span>
//                     </span>
//                   )}
//                 </td>
//                 {i === 0 && firstOfBlock && actionCell(u, span)}
//               </tr>
//             );
//           });
//         })}
//         {more > 0 && (
//           <tr className={styles.moreRow}>
//             <td colSpan={5} className={styles.moreTd}>
//               <Link variant="secondary" onClick={() => toggle(u.id || u.name)}>
//                 <span className={styles.moreLink}>
//                   {open && !isClosing ? 'Show less' : `Show ${more} more`}
//                   <span className={[styles.moreChevron, open && !isClosing ? styles.moreChevronOpen : ''].join(' ')}>
//                     <Icon name="solar:alt-arrow-down-linear" size={14} />
//                   </span>
//                 </span>
//               </Link>
//             </td>
//           </tr>
//         )}
//       </Fragment>
//     );
//   };

  // Figma 2981:10929: one row per block. Status, location, start & end date,
  // how it repeats (pattern, then the days in grey), and its time ranges as
  // boxes (time, then appointment type). The first two blocks show; the rest
  // fold under "Show N More".
  const renderRow = (u) => {
    if (!u.blocks.length) {
      return (
        <tr key={u.id || u.name} className={[styles.row, styles.rowEmpty].join(' ')}>
          {userCell(u, 1)}
          <td colSpan={5} className={`${styles.td} ${styles.inheritedTd}`}>
            <span className={styles.inherited}>
              No User Availability configured. They follow the availability schedule for their assigned practice.
            </span>
          </td>
          {actionCell(u, 1)}
        </tr>
      );
    }
    const id = u.id || u.name;
    const open = expanded.has(id);
    const isClosing = closing.has(id);
    const shown = open ? u.blocks : u.blocks.slice(0, SHOWN_BLOCKS);
    const more = u.blocks.length - SHOWN_BLOCKS;
    const span = shown.length + (more > 0 ? 1 : 0);
    return (
      <Fragment key={id}>
        {shown.map((b, i) => {
          const look = STATUS_LOOK[b.status];
          const [pattern, days] = cadenceText(b).split(' • ');
          const lastBlock = i === shown.length - 1 && !(more > 0);
          return (
            <tr
              key={b.id}
              className={[
                styles.row,
                b.status === 'expired' ? styles.rowExpired : '',
                lastBlock ? '' : styles.rowInGroup,
                i >= SHOWN_BLOCKS ? (isClosing ? styles.rowHide : styles.rowReveal) : '',
              ].filter(Boolean).join(' ')}
            >
              {i === 0 && userCell(u, span)}
              <td className={styles.td}><Badge tone={look.tone} size="sm" label={look.label} /></td>
              <td className={styles.td}><span className={styles.cellText}>{b.location}</span></td>
              <td className={`${styles.td} ${styles.datesTd}`}>
                <span className={styles.cellText}>{formatDate(b.startDate)} – {b.endDate ? formatDate(b.endDate) : 'Ongoing'}</span>
              </td>
              <td className={styles.td}>
                <span className={styles.repeats}>
                  <span className={styles.cellText}>{pattern}</span>
                  {days && <span className={styles.repeatDays}>{days}</span>}
                </span>
              </td>
              <td className={`${styles.td} ${styles.detailsTd}`}>
                <span className={styles.ranges}>
                  {(b.slots || []).map((sl, k) => (
                    <span key={k} className={styles.slot}>
                      <span className={styles.slotTime}>{slotTextTz(sl, b.timezone)}</span>
                      <span className={styles.slotType}>{sl.appointmentType || ALL_TYPES}</span>
                    </span>
                  ))}
                </span>
              </td>
              {i === 0 && actionCell(u, span)}
            </tr>
          );
        })}
        {more > 0 && (
          <tr className={styles.moreRow}>
            <td colSpan={5} className={styles.moreTd}>
              <Link variant="secondary" onClick={() => toggle(id)}>
                <span className={styles.moreLink}>
                  {open && !isClosing ? 'Show Less' : `Show ${more} More`}
                  <span className={[styles.moreChevron, open && !isClosing ? styles.moreChevronOpen : ''].join(' ')}>
                    <Icon name="solar:alt-arrow-down-linear" size={12} />
                  </span>
                </span>
              </Link>
            </td>
          </tr>
        )}
      </Fragment>
    );
  };

  const loading = !usersFetched || !blocksFetched;

  return (
    <div className={styles.wrapper}>
      {!embedded && <SectionTitleBar tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} actions={[]} rightExtras={tools} />}
      {showNotice && !embedded && (
        <div className={styles.notice}>
          <Banner size="sm" onClose={dismissNotice} className={styles.noticeBar}>
            Availability updates may take a few minutes to process. You can continue using Fold while processing completes. We'll notify you once the provider's availability has been updated successfully.
          </Banner>
        </div>
      )}
      {filtersOpen && (
        <div className={styles.filterBar}>
          {/* Users as in Figma Eventus 16978:128250: checkbox, avatar, name over role. */}
          <FilterChip
            label="User"
            active={fUsers.length > 0}
            activeSummary={fUsers.length ? (fUsers.length === 1 ? fUsers[0] : `${fUsers[0]} +${fUsers.length - 1}`) : undefined}
            onClear={() => { setFUsers([]); setPage(1); }}
            renderPopover={({ anchorRect, onClose }) => (
              <UserPickerPopover
                multiple
                anchorRect={anchorRect}
                users={pickerUsers}
                selected={fUsers}
                onSelect={(next) => { setFUsers(next); setPage(1); }}
                onClose={onClose}
              />
            )}
          />
          <FilterChip label="Location" searchable options={allLocations} selected={fLocations} onChange={(v) => { setFLocations(v); setPage(1); }} />
          {/* Like Employer Impact's Time Frame: the default reads as a neutral, set value
              (no ✕); once changed it's an active filter, and clearing it goes back to the default. */}
          <FilterChip
            label="Status"
            options={Object.keys(STATUS_FILTER)}
            selected={fStatuses}
            noClear={isDefaultStatus(fStatuses)}
            onChange={(v) => { setFStatuses(v.length ? v : DEFAULT_STATUSES); setPage(1); }}
          />
          <FilterChip label="Appointment Type" searchable options={allTypes} selected={fTypes} onChange={(v) => { setFTypes(v); setPage(1); }} />
          <FilterChip label="Slot Type" options={['Fixed Slot', 'Rolling Slot']} selected={fSpans} onChange={(v) => { setFSpans(v); setPage(1); }} />
          {/* Availability looks ahead, so just a custom range (no "Last 7 days" presets). */}
          <FilterChip
            label="Date Range"
            active={fRange.length === 2}
            activeSummary={fRange.length === 2 ? `${fmtDay(fRange[0])} – ${fmtDay(fRange[1])}` : undefined}
            onClear={() => { setFRange([]); setPage(1); }}
            renderPopover={({ anchorRect, onClose }) => (
              <DateRangePopover
                anchorRect={anchorRect}
                label="Date Range"
                selected={fRange}
                onChange={(next) => { if (next.length === 2) { setFRange(next); setPage(1); onClose(); } }}
                onClose={onClose}
              />
            )}
          />
          {filtersOn ? <Link variant="secondary" onClick={() => { setFLocations([]); setFStatuses(DEFAULT_STATUSES); setFTypes([]); setFRange([]); setFUsers([]); setFSpans([]); }}>Clear all</Link> : null}
        </div>
      )}
      {layout === 'week' ? (
        <UserAvailabilityNewView
          view="week"
          weekOf={embedded ? weekOf : undefined}
          onlyDay={embedded ? onlyDay : undefined}
          users={users}
          loading={!usersFetched || !blocksFetched}
          onEdit={(u, focusId) => setEditing({ user: u, focusId })}
          onAdd={(u) => setEditing({ user: u, addBlock: true })}
          renderActions={(u) => (
            <span className={styles.weekActions}>
              <RowMenu items={weekMenuFor(u.blocks.length > 0)} onSelect={(key) => onRowAction(u, key)} />
            </span>
          )}
        />
      ) : (
      <div className={styles.tableWrap}>
        <WorklistShell
          header={null}
          columns={columns}
          sortKey={sort?.key || null}
          sortDir={sort?.dir || null}
          // asc, then desc, then back to the default order.
          onSort={(key) => {
            setSort(cur => (cur?.key !== key ? { key, dir: 'asc' } : cur.dir === 'asc' ? { key, dir: 'desc' } : null));
            setPage(1);
          }}
          rows={rows}
          renderRow={renderRow}
          loading={loading}
          emptyState={(
            <div className={styles.empty}>
              <EmptyState icon="solar:clock-circle-linear" title={query ? 'No users match this search' : filtersOn ? 'No availability matches applied filters' : 'No users yet'} />
            </div>
          )}
          // Sized to fit a 1440px screen; narrower ones scroll sideways.
          minTableWidth={1188}
          fixedLayout
          page={pageNow}
          perPage={perPage}
          totalItems={users.length}
          onPageChange={setPage}
          onPageSizeChange={(n) => { setPerPage(n); setPage(1); }}
        />
      </div>
      )}

      {editing && (
        <UserAvailabilityDrawer
          user={editing.user || null}
          addBlock={!!editing.addBlock}
          focusBlockId={editing.focusId || null}
          cloneFrom={editing.cloneFrom || null}
          users={users}
          variant="new"
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (() => {
        // Every slot goes, past ones (hidden in the list) and filtered-out ones too.
        const total = (blocks || []).filter(b => b.userName?.toLowerCase() === deleting.name.toLowerCase()).length;
        return (
        <ConfirmDialog
          variant="destructive"
          title="Delete availability?"
          description={`${total === 1 ? 'The' : `All ${total}`} availability slot${total === 1 ? '' : 's'} for ${deleting.name} will be deleted and they will follow the availability schedule of their assigned practice.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          loading={deleteBusy}
          onCancel={() => setDeleting(null)}
          onConfirm={deleteAvailability}
        />
        );
      })()}
      {oooUser && (
        <OooUserRecordsDrawer
          user={{ id: oooUser.id, name: oooUser.name, email: oooUser.email, role: oooUser.role }}
          onClose={() => setOooUser(null)}
        />
      )}
    </div>
  );
}

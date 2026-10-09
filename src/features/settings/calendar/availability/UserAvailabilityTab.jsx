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
import { RingEmptyState } from '../../../../components/RingEmptyState/RingEmptyState';
import { Link } from '../../../../components/Link/Link';
import { Icon } from '../../../../components/Icon/Icon';
import { InfoBar } from '../../../../components/InfoBar/InfoBar';
import { AddIconMinimalist } from '../../../../components/Icon/AddIconMinimalist';
import { ConfirmDialog } from '../../../../components/ConfirmDialog/ConfirmDialog';
import { toast } from '../../../../components/Toast/sonnerToast';
import { useAppStore } from '../../../../store/useAppStore';
import { OooUserRecordsDrawer } from '../../../ooo/OooRecordsDrawers';
import { OOO_ICON } from '../../../ooo/oooUtils';
import { UserAvailabilityDrawer } from './UserAvailabilityDrawer';
import {
  blockStatus, STATUS_LOOK, cadenceText, formatRange, slotText, ALL_TYPES,
} from './availabilityUtils';
import styles from './UserAvailability.module.css';

const PER_PAGE = 15;
const SHOWN_BLOCKS = 2;
const NOTICE_KEY = 'fold-user-availability-notice-dismissed';
const noticeDismissed = () => { try { return localStorage.getItem(NOTICE_KEY) === '1'; } catch { return false; } };
const COLLAPSE_MS = 180;
const STATUS_ORDER = { active: 0, upcoming: 1, expired: 2 };

// Every column has room for its content; below the table's minimum width
// it scrolls sideways (User and Actions stay pinned).
const COLUMNS = [
  { key: 'user', label: 'User', sticky: 'left', left: 0, width: 240 },
  { key: 'status', label: 'Status', width: 112 },
  { key: 'location', label: 'Location', width: 180 },
  { key: 'repeats', label: 'Cadence', width: 240 },
  { key: 'dates', label: 'Dates', width: 210 },
  { key: 'hours', label: 'Hours', width: 240 },
  { key: 'actions', label: 'Actions', sticky: 'right', width: 152 },
];

const ROW_MENU = [
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
const OWN_ONLY = ['clone', 'delete'];

function RowMenu({ onSelect, hasBlocks }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  return (
    <span ref={ref}>
      <ActionButton icon="solar:menu-dots-linear" size="L" tooltip="More options" tooltipLeft onClick={() => setOpen(v => !v)} />
      {open && (
        <MenuPopover
          anchorRef={ref}
          ariaLabel="User availability actions"
          items={hasBlocks ? ROW_MENU : ROW_MENU.filter(m => !m.divider && !OWN_ONLY.includes(m.key))}
          width={200}
          onSelect={(key) => { setOpen(false); onSelect(key); }}
          onClose={() => setOpen(false)}
        />
      )}
    </span>
  );
}

/**
 * Settings → Calendar → User availability: each user's availability blocks
 * (location, repeat pattern, dates, hours per appointment type, status).
 * Active blocks lead; the rest fold under "Show more". Users without their
 * own availability take their locations' practice hours.
 */
export function UserAvailabilityTab({ tabs, activeTab, onTabChange }) {
  const platformUsers = useAppStore(s => s.platformUsers);
  const taskProfiles = useAppStore(s => s.taskProfiles);
  const usersFetched = useAppStore(s => s.platformUsersDidFetch);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  const blocks = useAppStore(s => s.userAvailability);
  const blocksFetched = useAppStore(s => s.userAvailabilityFetched);
  const fetchUserAvailability = useAppStore(s => s.fetchUserAvailability);
  useEffect(() => { fetchPlatformUsers?.(); fetchUserAvailability(); }, [fetchPlatformUsers, fetchUserAvailability]);

  const [query, setQuery] = useState('');
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
    const emails = Object.fromEntries((taskProfiles || []).map(p => [p.name, p.email]));
    const byName = new Map();
    (blocks || []).forEach(b => { const k = b.userName?.toLowerCase(); if (k) byName.set(k, [...(byName.get(k) || []), b]); });
    const q = query.trim().toLowerCase();
    return (platformUsers || [])
      .map(u => ({
        ...u,
        email: emails[u.name] || u.email,
        role: u.clinicalRoles?.[0] || 'Staff',
        blocks: (byName.get(u.name.toLowerCase()) || [])
          .map(b => ({ ...b, status: blockStatus(b) }))
          .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.startDate.localeCompare(b.startDate)),
      }))
      .filter(u => !q || u.name.toLowerCase().includes(q) || String(u.email || '').toLowerCase().includes(q))
      // People with their own availability first, then by name.
      .sort((a, b) => (b.blocks.length > 0) - (a.blocks.length > 0) || a.name.localeCompare(b.name));
  }, [platformUsers, taskProfiles, blocks, query]);

  const lastPage = Math.max(1, Math.ceil(users.length / perPage));
  const pageNow = Math.min(page, lastPage);
  const rows = users.slice((pageNow - 1) * perPage, pageNow * perPage);

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
      <span className={styles.toolDivider} aria-hidden="true" />
      <Button variant="secondary" size="L" leadingIconElement={<AddIconMinimalist size={16} color="currentColor" />} onClick={() => setEditing({})}>Add new</Button>
    </>
  );

  const userCell = (u, span) => (
    <td rowSpan={span} className={`${styles.td} ${styles.userTd} ${styles.stickyLeft}`} style={{ left: 0 }}>
      <span className={styles.user}>
        <Avatar variant="staff" size="M" initials={u.initials} userName={u.name} userId={u.id} />
        <span className={styles.userText}>
          <span className={styles.userName}>{u.name}</span>
          <span className={styles.userSub}>{u.email || u.role}</span>
        </span>
      </span>
    </td>
  );
  // + adds an availability block: the drawer opens on a fresh one, after
  // any the user already has. The pen opens the drawer on what they have.
  const actionCell = (u, span) => (
    <td rowSpan={span} className={`${styles.td} ${styles.actionTd} ${styles.stickyRight}`}>
      <span className={styles.actions}>
        <ActionButton icon="solar:add-linear" size="L" tooltip="Add availability" tooltipLeft onClick={() => setEditing({ user: u, addBlock: true })} />
        <span className={[styles.actionDivider, u.blocks.length ? '' : styles.actionDividerHidden].join(' ')} aria-hidden="true" />
        {/* No availability, nothing to edit: an empty slot keeps the ⋯ lined up.
            The pen's glyph fills its whole box, so it's drawn at 16px to read
            the same size as the + and ⋯ beside it. */}
        {u.blocks.length > 0 ? (
          <ActionButton size="L" tooltip="Edit availability" tooltipLeft onClick={() => setEditing({ user: u })}>
            <Icon name="solar:pen-linear" size={16} color="var(--neutral-300)" />
          </ActionButton>
        ) : <span className={styles.actionSlot} aria-hidden="true" />}
        <span className={styles.actionDivider} aria-hidden="true" />
        <RowMenu
          hasBlocks={u.blocks.length > 0}
          onSelect={(key) => {
            if (key === 'ooo') setOooUser(u);
            else if (key === 'delete') setDeleting(u);
            // Parked with the menu item above.
            // else if (key === 'clone') setEditing({ cloneFrom: u });
          }}
        />
      </span>
    </td>
  );

  const renderRow = (u) => {
    if (!u.blocks.length) {
      return (
        <tr key={u.id || u.name} className={[styles.row, styles.rowEmpty].join(' ')}>
          {userCell(u, 1)}
          <td colSpan={5} className={`${styles.td} ${styles.inheritedTd}`}>
            <span className={styles.inherited}>
              <Icon name="solar:clock-circle-linear" size={16} color="var(--neutral-200)" />
              No User Availability is configured for this provider. They currently follows availability schedule for their assigned practice.
            </span>
          </td>
          {actionCell(u, 1)}
        </tr>
      );
    }
    const open = expanded.has(u.id || u.name);
    const isClosing = closing.has(u.id || u.name);
    const shown = open ? u.blocks : u.blocks.slice(0, SHOWN_BLOCKS);
    const more = u.blocks.length - SHOWN_BLOCKS;
    // Each time range is its own table row: the block's location, cadence,
    // dates and status span them; only spacing separates a block's ranges.
    const slotsOf = (blk) => (blk.slots.length ? blk.slots : [null]);
    const span = shown.reduce((n, blk) => n + slotsOf(blk).length, 0) + (more > 0 ? 1 : 0);
    return (
      <Fragment key={u.id || u.name}>
        {shown.map((b, i) => {
          const look = STATUS_LOOK[b.status];
          const slots = slotsOf(b);
          const lastBlock = i === shown.length - 1 && !(more > 0);
          return slots.map((s, k) => {
            const firstOfBlock = k === 0;
            const lastOfBlock = k === slots.length - 1;
            return (
              <tr
                key={`${b.id}-${k}`}
                className={[
                  styles.row,
                  b.status === 'expired' ? styles.rowExpired : '',
                  lastOfBlock ? (lastBlock ? '' : styles.rowInGroup) : styles.rowSlot,
                  !firstOfBlock ? styles.rowSlotNext : '',
                  i >= SHOWN_BLOCKS ? (isClosing ? styles.rowHide : styles.rowReveal) : '',
                ].filter(Boolean).join(' ')}
              >
                {i === 0 && firstOfBlock && userCell(u, span)}
                {firstOfBlock && (
                  <>
                    <td rowSpan={slots.length} className={styles.td}><Badge tone={look.tone} size="S" label={look.label} /></td>
                    <td rowSpan={slots.length} className={styles.td}><span className={styles.cellText}>{b.location}</span></td>
                    <td rowSpan={slots.length} className={styles.td}><span className={styles.cellText}>{cadenceText(b)}</span></td>
                    <td rowSpan={slots.length} className={styles.td}><span className={styles.cellText}>{formatRange(b.startDate, b.endDate)}</span></td>
                  </>
                )}
                <td className={styles.td}>
                  {s && (
                    <span className={styles.slot}>
                      <span className={styles.slotTime}>{slotText(s)}</span>
                      <span className={styles.slotType}>{s.appointmentType || ALL_TYPES}</span>
                    </span>
                  )}
                </td>
                {i === 0 && firstOfBlock && actionCell(u, span)}
              </tr>
            );
          });
        })}
        {more > 0 && (
          <tr className={styles.moreRow}>
            <td colSpan={5} className={styles.moreTd}>
              <Link variant="secondary" onClick={() => toggle(u.id || u.name)}>
                <span className={styles.moreLink}>
                  {open && !isClosing ? 'Show less' : `Show ${more} more`}
                  <span className={[styles.moreChevron, open && !isClosing ? styles.moreChevronOpen : ''].join(' ')}>
                    <Icon name="solar:alt-arrow-down-linear" size={14} />
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
      <SectionTitleBar tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} actions={[]} rightExtras={tools} />
      {showNotice && (
        <div className={styles.notice}>
          <InfoBar variant="inline" onClose={dismissNotice} className={styles.noticeBar}>
            Availability updates may take a few minutes to process. You can continue using Fold while processing completes. We'll notify you once the provider's availability has been updated successfully.
          </InfoBar>
        </div>
      )}
      <div className={styles.tableWrap}>
        <WorklistShell
          header={null}
          columns={COLUMNS}
          rows={rows}
          renderRow={renderRow}
          loading={loading}
          emptyState={(
            <div className={styles.empty}>
              <RingEmptyState icon="solar:calendar-linear" label={query ? 'No users match this search' : 'No users yet'} />
            </div>
          )}
          // Wide enough that no column squeezes its text into the next; on
          // smaller screens the table scrolls sideways instead.
          minTableWidth={1380}
          page={pageNow}
          perPage={perPage}
          totalItems={users.length}
          onPageChange={setPage}
          onPageSizeChange={(n) => { setPerPage(n); setPage(1); }}
        />
      </div>

      {editing && (
        <UserAvailabilityDrawer
          user={editing.user || null}
          addBlock={!!editing.addBlock}
          cloneFrom={editing.cloneFrom || null}
          users={users}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          variant="destructive"
          title="Delete availability?"
          description={`${deleting.blocks.length} availability block${deleting.blocks.length === 1 ? '' : 's'} for ${deleting.name} will be deleted and they will follow the availability schedule of their assigned practice.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          loading={deleteBusy}
          onCancel={() => setDeleting(null)}
          onConfirm={deleteAvailability}
        />
      )}
      {oooUser && (
        <OooUserRecordsDrawer
          user={{ id: oooUser.id, name: oooUser.name, email: oooUser.email, role: oooUser.role }}
          onClose={() => setOooUser(null)}
        />
      )}
    </div>
  );
}

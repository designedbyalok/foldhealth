import { useState } from 'react';
import { MetaLine } from '../../../components/ActivityLog/ActivityLog';
import { Link } from '../../../components/Link/Link';
import { CollapsibleContent } from '../../../components/Collapsible/Collapsible';
import { historyTimelineStyles as ht } from '../../../components/HistoryTimeline/HistoryTimeline';
import { Badge } from '../../../components/Badge/Badge';
import { Icon } from '../../../components/Icon/Icon';
import { Avatar } from '../../../components/Avatar/Avatar';
import { WorklistShell } from '../../../components/WorklistShell/WorklistShell';
import { useAppStore } from '../../../store/useAppStore';
import { TIMER_ACCESS, initialsOf } from './careProgramBillingData';
import styles from './CareProgramBilling.module.css';

const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const PER_PAGE = 15;
const CHANGE_COLUMNS = [
  { key: 'name', label: 'Role/user name' },
  { key: 'change', label: 'Granted/revoked', width: 180, align: 'center' },
];

/**
 * The names behind an entry's counts (Figma 2892:33081): one row per role or
 * user, with whether it was added or removed. Pages after 15.
 */
function ChangesTable({ rows }) {
  const [page, setPage] = useState(1);
  const platformUsers = useAppStore(s => s.platformUsers);
  const roleByName = Object.fromEntries((platformUsers || []).map(u => [u.name, u.clinicalRoles?.[0]]));
  const pageRows = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  return (
    <div className={styles.historyTable}>
      <WorklistShell
        embedded
        header={null}
        columns={CHANGE_COLUMNS}
        rows={pageRows}
        minTableWidth={400}
        {...(rows.length > PER_PAGE ? { page, perPage: PER_PAGE, totalItems: rows.length, onPageChange: setPage } : {})}
        renderRow={(r) => (
          <tr key={r.id} className={styles.row}>
            <td className={styles.td}>
              <span className={styles.member}>
                {r.kind === 'role'
                  ? <Avatar type="icon" variant="others" iconName="solar:user-linear" size="M" />
                  : <Avatar variant="staff" size="M" initials={initialsOf(r.name)} userName={r.name} />}
                <span className={styles.optionText}>
                  <span className={styles.optionName}>{r.name}</span>
                  {r.kind === 'user' && roleByName[r.name] && <span className={styles.optionMeta}>{roleByName[r.name]}</span>}
                </span>
              </span>
            </td>
            <td className={`${styles.td} ${styles.historyChangeTd}`}>
              {r.added
                ? <Badge tone="success" size="sm" label="Granted" />
                : <Badge tone="danger" size="sm" label="Revoked" />}
            </td>
          </tr>
        )}
      />
    </div>
  );
}

/**
 * One Timer Access history entry (Figma 2891:54): meta line, title, the
 * access change as "from → to", then counts of users / roles added and
 * removed, with the names behind "View Details" (a table of each role / user).
 *
 * @param {object} props.entry – an ActivityLog entry carrying `change`
 *   ({ from?, to?, added?, removed? })
 */
export function TimerHistoryBody({ entry }) {
  const [open, setOpen] = useState(false);
  const { change: h } = entry;
  const added = h.added || { users: [], roles: [] };
  const removed = h.removed || { users: [], roles: [] };
  const badges = [
    added.users.length > 0 && { tone: 'success', icon: 'solar:add-square-linear', label: `${count(added.users.length, 'user')} granted` },
    added.roles.length > 0 && { tone: 'success', icon: 'solar:add-square-linear', label: `${count(added.roles.length, 'role')} granted` },
    removed.users.length > 0 && { tone: 'error', icon: 'solar:minus-square-linear', label: `${count(removed.users.length, 'user')} revoked` },
    removed.roles.length > 0 && { tone: 'error', icon: 'solar:minus-square-linear', label: `${count(removed.roles.length, 'role')} revoked` },
  ].filter(Boolean);
  // Added first (roles, then users), then removed.
  const rows = [
    ...added.roles.map(n => ({ id: `ar:${n}`, kind: 'role', name: n, added: true })),
    ...added.users.map(n => ({ id: `au:${n}`, kind: 'user', name: n, added: true })),
    ...removed.roles.map(n => ({ id: `rr:${n}`, kind: 'role', name: n, added: false })),
    ...removed.users.map(n => ({ id: `ru:${n}`, kind: 'user', name: n, added: false })),
  ];

  return (
    // "View details" shows on hover (or keyboard focus) of the entry, and stays while open.
    <div className={`${styles.historyEntry} ${open ? styles.historyEntryOpen : ''}`}>
      <MetaLine entry={entry} />
      <div className={ht.headlineRow}>
        <span className={ht.headline}>{entry.title}</span>
      </div>
      {/* The access option on its own line, as the updates show it. */}
      {h.kind === 'created' && h.to && <div className={styles.historyAccess}>{TIMER_ACCESS[h.to]}</div>}
      {h.kind === 'updated' && h.from && h.to && (
        <div className={styles.historyAccess}>
          {TIMER_ACCESS[h.from]}
          <Icon name="solar:arrow-right-linear" size={16} color="currentColor" />
          {TIMER_ACCESS[h.to]}
        </div>
      )}
      {badges.length > 0 && (
        <div className={styles.historyBadges}>
          {badges.map(b => <Badge key={b.label} tone={b.tone} size="xs" icon={b.icon} label={b.label} />)}
          <span className={`${styles.historyDot} ${styles.historyReveal}`} aria-hidden="true">•</span>
          <Link
            className={styles.historyReveal}
            variant="secondary"
            style={{ fontSize: 'var(--font-xs)', fontWeight: 400 }}
            onClick={() => setOpen(o => !o)}
            aria-expanded={open}
          >
            <span className={styles.historyViewLink}>
              View details
              <Icon name="solar:alt-arrow-down-linear" size={12} className={open ? styles.historyChevronOpen : styles.historyChevron} />
            </span>
          </Link>
        </div>
      )}
      {/* Eases open and shut under the badges. */}
      {badges.length > 0 && (
        <CollapsibleContent open={open}>
          <ChangesTable rows={rows} />
        </CollapsibleContent>
      )}
    </div>
  );
}

import { useContext, useEffect, useMemo, useState } from 'react';
import { Avatar } from '../Avatar/Avatar';
import { Badge } from '../Badge/Badge';
import { AvatarOooLookup } from '../Avatar/AvatarOooLookup';
import { Tooltip } from '../Tooltip/Tooltip';
import { Button } from '../Button/Button';
import { CloseButton } from '../CloseButton/CloseButton';
import { SearchBar } from '../SearchBar/SearchBar';
import { useAppStore } from '../../store/useAppStore';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../Dialog/Dialog';
import styles from './SelectAssigneeModal.module.css';

/**
 * SelectAssigneeModal: centred "pick one person" dialog.
 * Matches Figma SNP-Story 2632:134826.
 *
 * The roster is the platform user list (Supabase `profiles`), so any surface
 * that needs "assign this to someone" gets the same people and the same
 * search behaviour.
 *
 * @param {object}   props
 * @param {boolean}  props.open
 * @param {function} props.onClose
 * @param {function} props.onConfirm            – (user) => void, user = { id, name, initials, clinicalRoles }
 * @param {string}   [props.title='Select Assignee']
 * @param {string}   [props.confirmLabel='Confirm']
 * @param {React.ReactNode} [props.children]   – extra choices under the list
 *                                               (e.g. which sub-programs change)
 * @param {boolean}  [props.confirmDisabled]     – keep Confirm off while those
 *                                               choices are incomplete
 * @param {function} [props.outOfOffice]         – (user) => { startAt, endAt,
 *   coveredBy: string[] } | null. As when booking: people who are out can't be
 *   picked; they're listed last under Not Available with an Out of Office badge
 *   (dates on hover) and who covers them, and searching for one puts whoever
 *   covers them on top, under Suggested. Defaults to the app's Out of Office
 *   records (AvatarOooLookup), so every picker behaves this way.
 */
const mdY = (v) => new Date(v).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
export function SelectAssigneeModal({
  open,
  onClose,
  onConfirm,
  title = 'Select Assignee',
  confirmLabel = 'Confirm',
  children,
  confirmDisabled = false,
  outOfOffice: outOfOfficeProp,
}) {
  const lookup = useContext(AvatarOooLookup);
  const outOfOffice = useMemo(() => outOfOfficeProp || ((u) => {
    const r = lookup?.({ id: u.id || null, name: u.name });
    if (!r) return null;
    const coveredBy = [...new Set((r.coverage || []).map(c => String(c?.userName || '').trim()).filter(Boolean))];
    return { startAt: r.startAt, endAt: r.endAt, coveredBy };
  }), [outOfOfficeProp, lookup]);
  const platformUsers = useAppStore(s => s.platformUsers);
  const platformUsersDidFetch = useAppStore(s => s.platformUsersDidFetch);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);

  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => { if (open) fetchPlatformUsers(); }, [open, fetchPlatformUsers]);

  // Reset on the way out rather than in an effect, so a stale query or pick
  // never carries into the next opening. Every dismissal path routes here.
  const close = () => { setQuery(''); setSelectedId(null); onClose?.(); };

  const roleOf = (u) => (u.clinicalRoles || []).join(', ');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return platformUsers;
    return platformUsers.filter(u =>
      u.name.toLowerCase().includes(q) || roleOf(u).toLowerCase().includes(q));
  }, [platformUsers, query]);

  // Who's out (can't be picked), and, while searching, who covers them.
  const q = query.trim();
  const away = filtered.filter(u => outOfOffice(u));
  const covering = new Map(); // covering name → names they cover
  if (q) {
    away.forEach(u => (outOfOffice(u).coveredBy || []).forEach((n) => {
      covering.set(n, [...(covering.get(n) || []), u.name]);
    }));
  }
  const suggested = platformUsers.filter(u => covering.has(u.name) && !outOfOffice(u));
  const available = filtered.filter(u => !outOfOffice(u) && !covering.has(u.name));

  const selected = platformUsers.find(u => u.id === selectedId) || null;

  const pickRow = (u, note) => {
    const isSelected = u.id === selectedId;
    return (
      <button
        key={u.id}
        type="button"
        role="radio"
        aria-checked={isSelected}
        className={[styles.row, isSelected ? styles.rowSelected : ''].filter(Boolean).join(' ')}
        onClick={() => setSelectedId(u.id)}
      >
        <span className={[styles.radio, isSelected ? styles.radioChecked : ''].filter(Boolean).join(' ')} />
        <Avatar variant="staff" size="M" initials={u.initials} />
        <span className={styles.info}>
          <span className={styles.name}>{u.name}</span>
          {roleOf(u) && <span className={styles.role}>{roleOf(u)}</span>}
          {note && <span className={styles.note}>{note}</span>}
        </span>
      </button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent
        className={`max-w-[420px] gap-0 overflow-hidden rounded-xl ${styles.dialogShell}`}
        overlayClassName="bg-black/25"
        hideClose
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">
          Choose a person to assign this to.
        </DialogDescription>

        <div className={styles.header}>
          <span className={styles.headerTitle}>{title}</span>
          <CloseButton onClick={close} />
        </div>

        <div className={styles.body}>
          <SearchBar
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search"
            fullWidth
          />

          <div className={styles.list} role="radiogroup" aria-label={title}>
            {!platformUsersDidFetch && platformUsers.length === 0 ? (
              <p className={styles.empty}>Loading people…</p>
            ) : filtered.length === 0 && suggested.length === 0 ? (
              <p className={styles.empty}>No people match “{query}”.</p>
            ) : (
              <>
                {suggested.length > 0 && <div className={styles.group}>Suggested</div>}
                {suggested.map(u => pickRow(u, `Covering for ${covering.get(u.name).join(', ')}`))}
                {suggested.length > 0 && available.length > 0 && <div className={styles.group}>All Users</div>}
                {available.map(u => pickRow(u))}
                {away.length > 0 && <div className={styles.group}>Not Available</div>}
                {away.map((u) => {
                  const out = outOfOffice(u);
                  return (
                    <div key={u.id} className={`${styles.row} ${styles.rowDisabled}`} aria-disabled="true">
                      <span className={styles.radio} />
                      <Avatar variant="staff" size="M" initials={u.initials} userName={u.name} userId={u.id} />
                      <span className={styles.info}>
                        <span className={styles.nameRow}>
                          <span className={`${styles.name} ${styles.muted}`}>{u.name}</span>
                          <Tooltip label={`Out of office ${mdY(out.startAt)} - ${mdY(out.endAt)}`} placement="top" align="left">
                            <Badge tone="magenta" size="sm" label="Out of Office" />
                          </Tooltip>
                        </span>
                        <span className={`${styles.role} ${styles.muted}`}>{roleOf(u) || 'Staff'}</span>
                      </span>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {children}

          <div className={styles.footer}>
            <Button variant="outline" fullWidth onClick={close}>Cancel</Button>
            <Button
              fullWidth
              disabled={!selected || confirmDisabled}
              onClick={() => { if (selected) { onConfirm?.(selected); close(); } }}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

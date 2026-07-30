import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../store/useAppStore';
import { Avatar } from '../../components/Avatar/Avatar';
import { Icon } from '../../components/Icon/Icon';
import { ROLE_LABEL } from './assignment/astranaStaff';
import styles from './RoleAssigneePicker.module.css';

// Map from engine role (worklist internal) → clinical_roles vocabulary
// admins pick from in Settings → Users. A profile whose clinical_roles
// includes the mapped label is eligible for that column's assignee slot.
const ENGINE_TO_CLINICAL = {
  support:   'Support',
  coder:     'Coder',
  reviewer:  'QA',
  reviewer2: 'Compliance',
};

/**
 * Shared searchable role-assignee picker — used by both the HCC worklist role
 * cells and the DiagPanel assignee chip so the two surfaces behave identically.
 * Lists platform users from Supabase profiles who carry the column's
 * HCC role in profiles.clinical_roles (Support / Coder / QA / Compliance).
 * Filters by a search box; picking one dispatches hccReassignRole.
 *
 * The caller renders its own trigger via the `trigger` render-prop, so each
 * surface keeps its native look (name cell / "Assign" pill / dashed avatar).
 *
 * @param {object} p
 * @param {string} p.role                 engine role key (support|coder|reviewer|reviewer2)
 * @param {string} p.memberId
 * @param {string} p.dosDate
 * @param {string} [p.currentName]        highlight the current assignee (reassign mode)
 * @param {'left'|'right'} [p.align]      popover edge to anchor to the trigger
 * @param {string} [p.reason]             audit reason recorded on (re)assign
 * @param {(args:{ref,isOpen:boolean,onClick:Function})=>React.ReactNode} p.trigger
 */
export function RoleAssigneePicker({
  role, memberId, dosDate, currentName = null, trigger,
  align = 'left', reason = 'Assigned via worklist',
}) {
  const btnRef = useRef(null);
  const searchRef = useRef(null);
  const [pos, setPos] = useState(null);
  const [query, setQuery] = useState('');
  const reassign = useAppStore(s => s.hccReassignRole);
  const showToast = useAppStore(s => s.showToast);
  // Platform users from profiles — one-shot fetch, guarded in the store.
  const platformUsers = useAppStore(s => s.platformUsers);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  useEffect(() => { fetchPlatformUsers(); }, [fetchPlatformUsers]);

  const requiredRole = ENGINE_TO_CLINICAL[role];
  // Strict role scoping: only users whose profiles.clinical_roles includes
  // the column's HCC role are eligible. No fallback to the legacy mock —
  // if nobody has the role, the list stays empty and the picker shows an
  // explanatory hint so the admin knows they need to assign the role first
  // (Settings → Users). Engine roles that don't map to an HCC role (there
  // aren't any today) accept every user by design.
  const eligible = platformUsers.filter(u =>
    !requiredRole || u.clinicalRoles?.includes(requiredRole),
  );
  const baseUsers = eligible.map(u => ({
    id: u.id,
    name: u.name,
    initials: u.initials,
    rolesLabel: requiredRole || (u.clinicalRoles?.[0] || ''),
  }));

  const q = query.trim().toLowerCase();
  const users = q
    ? baseUsers.filter(u =>
        u.name.toLowerCase().includes(q) || (u.rolesLabel || '').toLowerCase().includes(q))
    : baseUsers;

  const open = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    setQuery('');
    const left = align === 'right'
      ? Math.max(8, r.right - 280)
      : Math.min(r.left, window.innerWidth - 300);
    setPos({ top: r.bottom + 4, left });
  };
  const close = () => setPos(null);

  useEffect(() => {
    if (!pos) return undefined;
    searchRef.current?.focus();
    const onDoc = (e) => {
      if (!btnRef.current?.contains(e.target) && !e.target.closest?.(`.${styles.menu}`)) close();
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [pos]);

  const onPick = async (u) => {
    if (!memberId || !dosDate) {
      showToast?.('Cannot assign — missing patient or DOS context.');
      close();
      return;
    }
    // Toast follows the reassign outcome. Historically the success toast
    // fired unconditionally, which masked silent no-ops (member missing
    // from local state, unresolvable staffId) AND silent Supabase failures
    // — production users saw "assigned" without the row updating, or the
    // row updated locally but reverted on the next reload. hccReassignRole
    // now returns { ok, reason? } after awaiting the DB write, so we can
    // surface the actual result.
    close();
    const outcome = await reassign(memberId, dosDate, role, u.id, 'current-user', reason, u.name);
    if (outcome?.ok) {
      showToast?.(`${u.name} assigned as ${ROLE_LABEL[role] || role}.`);
      return;
    }
    const why = outcome?.reason === 'member-not-found'
      ? 'record is not in the current worklist'
      : outcome?.reason === 'unresolvable-assignee'
        ? 'could not resolve the selected user'
        : outcome?.reason === 'persistence-failed'
          ? 'the database write failed and the change was reverted'
          : 'unexpected error';
    showToast?.(`Couldn’t assign ${u.name} — ${why}. Try again.`);
  };

  return (
    <>
      {trigger({ ref: btnRef, isOpen: !!pos, onClick: (e) => { e.stopPropagation(); pos ? close() : open(); } })}
      {pos && createPortal(
        <div className={styles.menu} style={{ top: pos.top, left: pos.left }} onClick={(e) => e.stopPropagation()}>
          <div className={styles.title}>{currentName ? 'Change' : 'Assign'} {ROLE_LABEL[role] || role}</div>
          <div className={styles.search}>
            <Icon name="solar:magnifer-linear" size={14} color="var(--neutral-300)" />
            <input
              ref={searchRef}
              type="text"
              className={styles.input}
              placeholder="Search users…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className={styles.list}>
            {users.length === 0 ? (
              <div className={styles.empty}>
                {q
                  ? 'No users match your search.'
                  : requiredRole
                    ? `No users assigned the "${requiredRole}" role. Assign the role in Settings → Users to make them selectable here.`
                    : 'No users found.'}
              </div>
            ) : users.map(u => (
              <button
                key={u.id}
                type="button"
                className={[styles.item, currentName === u.name ? styles.itemActive : ''].filter(Boolean).join(' ')}
                onClick={() => onPick(u)}
              >
                <Avatar variant="assignee" initials={u.initials} />
                <span className={styles.name}>{u.name}</span>
                <span className={styles.role}>{u.rolesLabel}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

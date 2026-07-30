import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../components/Icon/Icon';
import { Avatar } from '../../components/Avatar/Avatar';
import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';
import { Select } from '../../components/Select/Select';
import { useAppStore } from '../../store/useAppStore';
import { ROLE_LABEL, ROLES } from './assignment/astranaStaff';
import { dosKey } from './assignment/dosState';
import styles from './BulkChangeAssigneesDialog.module.css';

// Engine role key → clinical_roles vocabulary admins pick from in
// Settings → Users. Mirrors ENGINE_TO_CLINICAL in RoleAssigneePicker so
// both surfaces filter the same way — the bulk dialog is a many-at-once
// version of the row picker.
const ENGINE_TO_CLINICAL = {
  support:   'Support',
  coder:     'Coder',
  reviewer:  'QA',
  reviewer2: 'Compliance',
};

/**
 * BulkChangeAssigneesDialog — centered modal matching Figma 1399:5871.
 *
 * Opens from the HCC worklist's BulkBar "Change Assignee" action when one
 * or more rows are selected. Lets the user pick a role (Support / Coder /
 * Reviewer / Reviewer 2) and a single candidate from that role's pool (configured
 * Care Team members + Astrana roster), then applies the assignment to
 * every selected DOS (one per selected member's first DOS — the bulk
 * batch).
 *
 * Per the Figma copy ("Existing assignees for the selected role will be
 * replaced with the selected user. Assignees whose tasks are already
 * completed will not be changed."), members whose role is already in a
 * terminal state for that role are skipped — only active or new buckets
 * are updated.
 *
 * Props:
 *  - open          (boolean)             dialog visibility
 *  - selectedIds   (string[])            HCC member ids being bulk-updated
 *  - onClose       (function)            close + cancel
 *  - onApplied     (function({count}))   fires after a successful apply
 */
// Statuses the engine treats as terminal — a role bucket in any of these
// states is "completed work" per the Figma info banner ("Assignees whose
// tasks are already completed will not be changed") and the bulk update
// must skip it.
const TERMINAL_STATUSES = new Set(['Completed', 'Reject', 'Insufficient']);

// Map engine role key → the legacy member field that holds that role's
// status. Used as a fallback when the engine dosState entry is missing.
const STATUS_FIELD_BY_ROLE = {
  support:   'supS',
  coder:     'cdrS',
  reviewer:  'r1s',
  reviewer2: 'r2s',
};

export function BulkChangeAssigneesDialog({ open, selectedIds, onClose, onApplied }) {
  const hccMembers = useAppStore(s => s.hccMembers);
  const hccCareTeams = useAppStore(s => s.hccCareTeams);
  const hccDosAssignments = useAppStore(s => s.hccDosAssignments);
  const hccReassignRole = useAppStore(s => s.hccReassignRole);
  const showToast = useAppStore(s => s.showToast);
  const platformUsers = useAppStore(s => s.platformUsers);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  useEffect(() => { fetchPlatformUsers(); }, [fetchPlatformUsers]);

  const [role, setRole] = useState('support');
  const [search, setSearch] = useState('');
  const [pickedId, setPickedId] = useState(null); // staff id or '__unassigned'

  // Reset when the dialog opens / closes.
  useEffect(() => {
    if (open) {
      setRole('support');
      setSearch('');
      setPickedId(null);
    }
  }, [open]);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Candidate pool — platform users (Settings → Users / profiles) whose
  // clinical_roles include the selected role's HCC clinical role. Mirrors
  // the row picker's strict scoping (see RoleAssigneePicker.jsx). Care
  // Team members for that role float to the top with a "Team: <name>"
  // annotation so admins can spot their roster.
  const candidates = useMemo(() => {
    const teamType = ROLE_LABEL[role];
    const requiredRole = ENGINE_TO_CLINICAL[role];
    if (!requiredRole) return [];

    // 1. Care Team members for this role — collect names → team name.
    const teamMemberMap = new Map(); // userId → teamName
    (hccCareTeams || [])
      .filter(t => t.kind === 'hcc' && t.teamType === teamType)
      .forEach(t => (t.members || []).forEach(m => {
        if (!teamMemberMap.has(m.userId)) teamMemberMap.set(m.userId, t.name);
      }));

    // 2. Filter platform users to role-matched, then order Care-Team members first.
    const ranked = (platformUsers || [])
      .filter(u => u.clinicalRoles?.includes(requiredRole))
      .map(u => {
        const teamName = teamMemberMap.get(u.id) || teamMemberMap.get(u.name);
        return {
          id: u.id,
          name: u.name,
          initials: u.initials,
          rolesLabel: requiredRole,
          teamName,
          rank: teamName ? 1 : 2,
        };
      });
    ranked.sort((a, b) => a.rank - b.rank);
    return ranked;
  }, [hccCareTeams, platformUsers, role]);

  // Filter by search query (name or role label match).
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.rolesLabel || '').toLowerCase().includes(q),
    );
  }, [candidates, search]);

  // Check whether the selected role on this member is already in a
  // terminal state (Completed / Reject / Insufficient). Prefers the
  // engine's dosState since that's the source of truth; falls back to
  // the legacy member field when the engine hasn't seeded a record yet.
  const isRoleCompleted = (member, dos) => {
    const dosEntry = (member.dos_list || []).find(d => d.date === dos);
    const key = dosKey(member.id, dos, dosEntry?.provider, dosEntry?.pos);
    const engineStatus = hccDosAssignments?.[key]?.[role]?.status;
    if (engineStatus) return TERMINAL_STATUSES.has(engineStatus);
    const legacyStatus = member[STATUS_FIELD_BY_ROLE[role]];
    return TERMINAL_STATUSES.has(legacyStatus);
  };

  const handleApply = async () => {
    if (!pickedId || !selectedIds?.length) return;
    if (pickedId === '__unassigned') return;
    const pickedUser = candidates.find(c => c.id === pickedId);
    if (!pickedUser) return;
    let skipped = 0;
    const jobs = [];
    selectedIds.forEach(memberId => {
      const member = hccMembers.find(m => m.id === memberId);
      const dos = member?.dos_list?.[0]?.date || member?.dos;
      if (!member || !dos) return;
      // Honor the info-banner rule: members whose role is already complete
      // are not touched. The engine treats Completed / Reject /
      // Insufficient as terminal — none of those should be reassigned.
      if (isRoleCompleted(member, dos)) {
        skipped++;
        return;
      }
      // Pass the picked user's display name so the worklist row's role
      // column updates even for Account-pool users not in the Astrana
      // roster (hccStaffById would return null for those).
      jobs.push(
        hccReassignRole(memberId, dos, role, pickedUser.id, 'You', 'Bulk reassign', pickedUser.name)
          .then(outcome => ({ member, outcome })),
      );
    });
    // Close immediately — the rows already flipped optimistically. The
    // toast waits for the actual DB outcomes: counting fired requests as
    // "updated" let a success toast mask writes that never persisted
    // (RLS / missing row / network), which reverted on the next reload.
    onClose?.();
    const results = await Promise.all(jobs);
    const updated = results.filter(r => r.outcome?.ok).length;
    const failed = results.filter(r => !r.outcome?.ok);
    onApplied?.({ updated, skipped, role: ROLE_LABEL[role] });
    const roleLabel = ROLE_LABEL[role];
    if (failed.length) {
      const names = failed.slice(0, 3).map(r => r.member.name).join(', ');
      const more = failed.length > 3 ? ` +${failed.length - 3} more` : '';
      showToast(
        `Reassigned ${updated} of ${updated + failed.length} ${roleLabel} role${updated + failed.length === 1 ? '' : 's'}`
        + ` — couldn't save ${names}${more}; those rows were reverted.`,
      );
    } else if (updated && skipped) {
      showToast(`Reassigned ${updated} ${roleLabel} role${updated === 1 ? '' : 's'} to ${pickedUser.name} · ${skipped} skipped (already completed)`);
    } else if (updated) {
      showToast(`Reassigned ${updated} ${roleLabel} role${updated === 1 ? '' : 's'} to ${pickedUser.name}`);
    } else if (skipped) {
      showToast(`No changes — all ${skipped} selected ${roleLabel} role${skipped === 1 ? '' : 's'} already completed`);
    }
  };

  if (!open) return null;

  const roleOptions = ROLES.map(r => ({ value: r, label: ROLE_LABEL[r] }));

  return createPortal(
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-change-title"
      >
        <div className={styles.header}>
          <h2 id="bulk-change-title" className={styles.title}>Bulk Change Assignees</h2>
          <p className={styles.subtitle}>
            You're about to update assignee for the selected{' '}
            <strong>{selectedIds.length} patient{selectedIds.length === 1 ? '' : 's'}</strong>.
          </p>
        </div>

        <div className={styles.infoBanner}>
          <Icon name="solar:info-circle-linear" size={14} color="var(--status-info, #145ECC)" />
          <span>
            Existing assignees for the selected role will be replaced with the selected user.
            Assignees whose tasks are already completed will not be changed.
          </span>
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>Select Role</span>
          <Select
            options={roleOptions}
            value={role}
            onChange={(v) => { setRole(v); setPickedId(null); }}
          />
        </div>

        <div className={styles.searchWrap}>
          <Icon name="solar:magnifer-linear" size={16} color="var(--neutral-300)" className={styles.searchIcon} />
          <Input
            placeholder={`Search ${ROLE_LABEL[role]} User`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.list} role="radiogroup">
          {/* Unassigned option — placeholder avatar */}
          <CandidateRow
            id="__unassigned"
            initials=""
            name="Unassigned"
            roles=""
            isUnassigned
            checked={pickedId === '__unassigned'}
            onSelect={() => setPickedId('__unassigned')}
          />
          {visible.length === 0 ? (
            <div className={styles.empty}>
              {search.trim()
                ? `No users match "${search}"`
                : `No users assigned the "${ENGINE_TO_CLINICAL[role]}" role. Assign the role in Settings → Users to make them selectable here.`}
            </div>
          ) : visible.map(c => (
            <CandidateRow
              key={c.id}
              id={c.id}
              initials={c.initials}
              name={c.name}
              roles={c.teamName
                ? `${c.rolesLabel || ROLE_LABEL[role]} · Team: ${c.teamName}`
                : c.rolesLabel}
              checked={pickedId === c.id}
              onSelect={() => setPickedId(c.id)}
            />
          ))}
        </div>

        <div className={styles.footer}>
          <Button variant="secondary" size="M" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="M"
            disabled={!pickedId || pickedId === '__unassigned'}
            onClick={handleApply}
          >
            Apply Changes
          </Button>
        </div>
      </div>
    </>,
    document.body,
  );
}

function CandidateRow({ id, initials, name, roles, checked, isUnassigned, onSelect }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      className={[styles.row, checked ? styles.rowChecked : ''].filter(Boolean).join(' ')}
      onClick={onSelect}
    >
      <span className={[styles.radio, checked ? styles.radioChecked : ''].filter(Boolean).join(' ')}>
        {checked && <span className={styles.radioDot} />}
      </span>
      {isUnassigned ? (
        <span className={styles.unassignedAvatar} aria-hidden="true">
          <Icon name="solar:user-rounded-linear" size={18} color="var(--neutral-300)" />
        </span>
      ) : (
        <Avatar variant="provider" initials={initials} />
      )}
      <div className={styles.rowText}>
        <span className={styles.rowName}>{name}</span>
        {roles && <span className={styles.rowRoles}>{roles}</span>}
      </div>
    </button>
  );
}

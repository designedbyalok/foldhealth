import { useEffect, useMemo, useState } from 'react';
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription } from '../../../components/ConfirmDialog/AlertDialogPrimitives';
import { Button } from '../../../components/Button/Button';
import { Textarea } from '../../../components/Textarea/Textarea';
import { Avatar } from '../../../components/Avatar/Avatar';
import { Select } from '../../../components/Select/Select';
import { useAppStore } from '../../../store/useAppStore';
import { staffForRole, ROLE_LABEL } from '../assignment/astranaStaff';
import styles from './RecordsRequestDialog.module.css';

// UI role → the Astrana engine role a picker's roster should filter on.
// ASTRANA_STAFF is the single source the assignment engine picks from,
// and it's what the Review Progress popover surfaces — using it here
// keeps the "last assignee" the picker seeds identical to what the
// reviewer saw in the popover.
const ROLE_TO_ENGINE = {
  coder: 'coder',
  support: 'support',
  qa: 'reviewer',
};

// Base role options a requester can pick. QA is only surfaced when the
// current user is Compliance (see COMPLIANCE_ROLE_OPTIONS below).
const BASE_ROLE_OPTIONS = [
  { value: 'coder',   label: 'Coder' },
  { value: 'support', label: 'Support Team' },
];
const COMPLIANCE_ROLE_OPTIONS = [
  { value: 'coder',   label: 'Coder' },
  { value: 'qa',      label: 'QA' },
  { value: 'support', label: 'Support Team' },
];

const initialsOf = (name) => (name || '').split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase();

/**
 * Modal shown when QA / Compliance picks `Record Requested` in the
 * DosStatusMenu. Forces a role selection (Coder or Support Team) before
 * the transition commits and optionally captures a comment (≤150 chars)
 * that the destination role will see in the Comments tab. Layout mirrors
 * Figma ICD-Import 5723-171525.
 */
export function RecordsRequestDialog({ onCancel, onConfirm, lastAssignees }) {
  const [role, setRole] = useState('coder');
  const [comment, setComment] = useState('');
  const [mentions, setMentions] = useState([]);
  const [attachments, setAttachments] = useState([]);
  // Assigned-to picker — defaults to the first user we can pick per role
  // (the "last assigned" reviewer once the roster is loaded). The user
  // can swap this if the default reviewer is out; the selected assignee
  // rides along on the confirm payload for the request.
  const [assigneeId, setAssigneeId] = useState('');
  // Roster for @-mention autocomplete inside the Textarea's richText
  // editor. Same source as CommentComposer — profiles rows + a fallback
  // fixture — so mentioning the same colleague in this dialog resolves
  // to the same profile id downstream.
  const platformUsers = useAppStore(s => s.platformUsers);
  const currentUserProfile = useAppStore(s => s.currentUserProfile);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  useEffect(() => { fetchPlatformUsers?.(); }, [fetchPlatformUsers]);
  const mentionUsers = useMemo(() => {
    const base = (platformUsers || []).map(u => ({
      ...u,
      realProfile: true,
      initials: u.initials || (u.name || '').split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase(),
    }));
    if (!currentUserProfile?.name) return base;
    if (base.some(u => u.id === currentUserProfile.id || u.name === currentUserProfile.name)) return base;
    const initials = currentUserProfile.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    return [{ id: currentUserProfile.id, name: currentUserProfile.name, initials, realProfile: true }, ...base];
  }, [platformUsers, currentUserProfile]);

  // Compliance users get QA as an extra request path. Everyone else
  // sees the base Coder / Support Team pair. Uses hccUserRole (the
  // localStorage-backed HCC role switcher the worklist reads) as the
  // primary signal, and falls back to the profile's clinical_roles
  // when hccUserRole isn't set.
  const hccUserRole = useAppStore(s => s.hccUserRole);
  const isCompliance = useMemo(() => (
    hccUserRole === 'Compliance'
    || !!currentUserProfile?.clinicalRoles?.includes('Compliance')
  ), [hccUserRole, currentUserProfile]);
  const roleOptions = isCompliance ? COMPLIANCE_ROLE_OPTIONS : BASE_ROLE_OPTIONS;

  // Roster for the Assigned-to picker — read from the Astrana engine
  // roster (staffForRole) so the names line up 1:1 with what the
  // Review Progress popover shows and what the assignment engine picks
  // from. Active-only, so nobody on leave surfaces as available.
  const roleUsers = useMemo(() => {
    const engineRole = ROLE_TO_ENGINE[role];
    if (!engineRole) return [];
    return staffForRole(engineRole)
      .filter(s => s.active !== false)
      .map(s => ({
        id: s.id,
        name: s.name,
        initials: s.initials || initialsOf(s.name),
        roleLabel: ROLE_LABEL[engineRole],
        // No availability field on the profile yet — treat everyone
        // as Available so the dropdown reads truthfully rather than
        // blank.
        available: true,
      }));
  }, [role]);

  const assignee = useMemo(
    () => roleUsers.find(u => u.id === assigneeId) || null,
    [roleUsers, assigneeId],
  );

  // Seed the default assignee whenever the role flips (or the roster
  // finishes loading) and the current pick isn't valid for the newly-
  // selected role. The seed prefers the record's LAST known assignee
  // for that role (via `lastAssignees` — coder / support / qa map from
  // member.cdr / member.sup / member.r1) so the picker opens on the
  // person who most recently touched this record; if that name doesn't
  // resolve to a platform user we fall back to the first eligible one.
  useEffect(() => {
    if (!roleUsers.length) { setAssigneeId(''); return; }
    if (assigneeId && roleUsers.some(u => u.id === assigneeId)) return;
    const lastName = lastAssignees?.[role];
    const seed = (lastName && roleUsers.find(u => u.name === lastName)) || roleUsers[0];
    setAssigneeId(seed.id);
  }, [roleUsers, assigneeId, role, lastAssignees]);

  // Rich options for the shared Select — each row shows an M-size
  // avatar, the name + role subtitle stacked, and an Available /
  // Unavailable trailing tag. `triggerLabel` renders the compact pill
  // (avatar + name + green tag) in the closed field.
  const assigneeOptions = useMemo(() => roleUsers.map(u => ({
    value: u.id,
    searchText: `${u.name} ${u.roleLabel || ''}`.trim(),
    triggerLabel: (
      <span className={styles.assigneeTriggerLabel}>
        <Avatar variant="assignee" type="initial" size="XS" initials={u.initials} />
        <span className={styles.assigneeName}>{u.name}</span>
        <span className={u.available ? styles.assigneeAvailable : styles.assigneeUnavailable}>
          {u.available ? '(Available)' : '(Unavailable)'}
        </span>
      </span>
    ),
    label: (
      <span className={styles.assigneeOption}>
        <Avatar variant="assignee" type="initial" size="M" initials={u.initials} />
        <span className={styles.assigneeOptionText}>
          <span className={styles.assigneeOptionName}>{u.name}</span>
          {u.roleLabel && (
            <span className={styles.assigneeOptionRole}>{u.roleLabel}</span>
          )}
        </span>
        <span className={u.available ? styles.assigneeAvailable : styles.assigneeUnavailable}>
          {u.available ? 'Available' : 'Unavailable'}
        </span>
      </span>
    ),
  })), [roleUsers]);

  // Comment is REQUIRED — the destination role needs context on what to
  // retrieve / revisit, so an empty note used to leave them guessing. The
  // shared Textarea's richText mode owns the label + mandatory dot +
  // formatting toolbar + attachment + mention picker; we just read plain
  // text via onChange's second arg to gate the CTA.
  const canSubmit = role != null && !!assignee && comment.trim().length > 0;
  return (
    <AlertDialog open onOpenChange={(open) => { if (!open) onCancel?.(); }}>
      <AlertDialogContent className={styles.dialog}>
        <div className={styles.header}>
          <AlertDialogTitle className={styles.title}>
            Request Records?
          </AlertDialogTitle>
          <AlertDialogDescription className={styles.subtitle}>
            Select who you'd like to request the records from.
          </AlertDialogDescription>
        </div>

        {/* Inline radio row — Coder first per Figma; toggling flips the
            Assigned-to roster to that role's users. Compliance users
            also see QA in the row. */}
        <div className={styles.radioRow} role="radiogroup" aria-label="Request records from">
          {roleOptions.map((opt) => {
            const active = role === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={opt.label}
                className={[styles.radioOption, active ? styles.radioOptionActive : ''].filter(Boolean).join(' ')}
                onClick={() => setRole(opt.value)}
              >
                <span className={[styles.radio, active ? styles.radioActive : ''].filter(Boolean).join(' ')}>
                  {active && <span className={styles.radioDot} />}
                </span>
                <span className={styles.radioLabel}>{opt.label}</span>
              </button>
            );
          })}
        </div>

        {/* Assigned to — shared Select with rich rows (M avatar + name
            + role subtitle + Available/Unavailable). Portals its menu
            (z-index 9800 > alert-dialog 9750) so it lifts above the
            modal instead of hiding behind it. */}
        <Select
          label="Assignee"
          placeholder="Select assignee"
          options={assigneeOptions}
          value={assigneeId}
          onChange={setAssigneeId}
          searchable
          searchPlaceholder="Search users…"
          wrapperClassName={styles.assigneeSelectWrapper}
          className={styles.assigneeSelect}
          emptyText={roleUsers.length === 0
            ? `No active users in the "${ROLE_LABEL[ROLE_TO_ENGINE[role]] || ''}" pool.`
            : 'No matches'}
        />

        <Textarea
          title="Comment"
          mandatory
          richText
          attachment
          mentions
          mentionUsers={mentionUsers}
          placeholder="Add a Comment"
          onChange={(_html, plain) => setComment(plain ?? '')}
          onMentionsChange={setMentions}
          onAttachmentFiles={(files) => setAttachments(prev => [...prev, ...Array.from(files)])}
        />

        <div className={styles.actions}>
          <Button variant="secondary" size="L" fullWidth onClick={onCancel}>Cancel</Button>
          <Button
            variant="primary"
            size="L"
            fullWidth
            disabled={!canSubmit}
            onClick={() => onConfirm({
              destinationRole: role,
              assignee: assignee ? { id: assignee.id, name: assignee.name, initials: assignee.initials } : null,
              note: comment.trim(),
              mentions,
              attachments,
            })}
          >
            Request Record
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNativeDialog } from '../../hooks/useNativeDialog';
import { Icon } from '../../components/Icon/Icon';
import { Avatar } from '../../components/Avatar/Avatar';
import { Button } from '../../components/Button/Button';
import { Input } from '../../components/Input/Input';
import { useAppStore } from '../../store/useAppStore';
// Reuses the HCC bulk-change dialog's CSS so both worklists' bulk flows
// read as one system: the HEDIS variant just drops role selection since
// HEDIS gaps have a single assignee rather than a per-role pool.
import styles from '../hcc/BulkChangeAssigneesDialog.module.css';

/**
 * BulkChangeHedisAssigneeDialog: centred modal that opens from the HEDIS
 * worklist BulkBar's "Change Assignee" action when one or more rows are
 * selected. Picks one user from the platform roster and applies them as
 * the assignee for every open gap on every selected member.
 *
 * Gaps already `Completed` or in a `Closed - *` state are skipped so the
 * update mirrors the row-picker's rule (only in-flight work reassigns).
 *
 * Props:
 *  - open         (boolean)             dialog visibility
 *  - selectedIds  (string[])            HEDIS member ids being bulk-updated
 *  - onClose      (function)            close + cancel
 *  - onApplied    (function({count}))   fires after a successful apply
 */
const TERMINAL_GAP_STATUSES = new Set(['Completed']);

function isGapReassignable(gap) {
  const status = gap?.status;
  if (!status) return true;
  if (TERMINAL_GAP_STATUSES.has(status)) return false;
  if (String(status).startsWith('Closed')) return false;
  return true;
}

export function BulkChangeHedisAssigneeDialog({ open, selectedIds, onClose, onApplied }) {
  const dialogRef = useNativeDialog(open);
  const hedisMembers = useAppStore(s => s.hedisMembers);
  const updateGapAssignee = useAppStore(s => s.updateGapAssignee);
  const showToast = useAppStore(s => s.showToast);
  const platformUsers = useAppStore(s => s.platformUsers);
  const fetchPlatformUsers = useAppStore(s => s.fetchPlatformUsers);
  useEffect(() => { fetchPlatformUsers(); }, [fetchPlatformUsers]);

  const [search, setSearch] = useState('');
  const [pickedId, setPickedId] = useState(null); // user id or '__unassigned'

  useEffect(() => {
    if (open) { setSearch(''); setPickedId(null); }
  }, [open]);

  const candidates = useMemo(() => (
    (platformUsers || []).map(u => ({ id: u.id, name: u.name, initials: u.initials }))
  ), [platformUsers]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(c => (c.name || '').toLowerCase().includes(q));
  }, [candidates, search]);

  const handleApply = () => {
    if (!pickedId || !selectedIds?.length) return;
    const nextName = pickedId === '__unassigned'
      ? null
      : candidates.find(c => c.id === pickedId)?.name;
    if (pickedId !== '__unassigned' && !nextName) return;

    let updated = 0;
    let skipped = 0;
    for (const memberId of selectedIds) {
      const member = (hedisMembers || []).find(m => m.id === memberId);
      if (!member) continue;
      for (const g of (member.gaps || [])) {
        if (!isGapReassignable(g)) { skipped++; continue; }
        updateGapAssignee(memberId, g.code, nextName);
        updated++;
      }
    }
    onClose?.();
    onApplied?.({ updated, skipped });
    const targetLabel = nextName || 'Unassigned';
    if (updated && skipped) {
      showToast(`Reassigned ${updated} gap${updated === 1 ? '' : 's'} to ${targetLabel} · ${skipped} skipped (already closed)`);
    } else if (updated) {
      showToast(`Reassigned ${updated} gap${updated === 1 ? '' : 's'} to ${targetLabel}`);
    } else if (skipped) {
      showToast(`No changes: all ${skipped} gap${skipped === 1 ? '' : 's'} are already closed`);
    }
  };

  if (!open) return null;

  return createPortal(
      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby="bulk-hedis-assignee-title"
        onCancel={(e) => { e.preventDefault(); onClose?.(); }}
      >
        <div className={styles.header}>
          <h2 id="bulk-hedis-assignee-title" className={styles.title}>Bulk Change Assignee</h2>
          <p className={styles.subtitle}>
            You&apos;re about to update the assignee for every open gap on the selected{' '}
            <strong>{selectedIds.length} patient{selectedIds.length === 1 ? '' : 's'}</strong>.
          </p>
        </div>

        <div className={styles.infoBanner}>
          <Icon name="solar:info-circle-linear" size={14} color="var(--status-info, #145ECC)" />
          <span>
            The picked user replaces the current assignee on every open gap.
            Gaps that are already Completed or Closed will not be changed.
          </span>
        </div>

        <div className={styles.searchWrap}>
          <Icon name="solar:magnifer-linear" size={16} color="var(--neutral-300)" className={styles.searchIcon} />
          <Input
            placeholder="Search user"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.list} role="radiogroup">
          <CandidateRow
            id="__unassigned"
            initials=""
            name="Unassigned"
            isUnassigned
            checked={pickedId === '__unassigned'}
            onSelect={() => setPickedId('__unassigned')}
          />
          {visible.length === 0 ? (
            <div className={styles.empty}>
              {search.trim() ? `No users match "${search}"` : 'No platform users loaded.'}
            </div>
          ) : visible.map(c => (
            <CandidateRow
              key={c.id}
              id={c.id}
              initials={c.initials}
              name={c.name}
              checked={pickedId === c.id}
              onSelect={() => setPickedId(c.id)}
            />
          ))}
        </div>

        <div className={styles.footer}>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!pickedId}
            onClick={handleApply}
          >
            Apply Changes
          </Button>
        </div>
      </dialog>,
    document.body,
  );
}

function CandidateRow({ initials, name, checked, isUnassigned, onSelect }) {
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
        <Avatar variant="staff" initials={initials} />
      )}
      <div className={styles.rowText}>
        <span className={styles.rowName}>{name}</span>
      </div>
    </button>
  );
}

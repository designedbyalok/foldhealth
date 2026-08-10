import { useState, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../components/Icon/Icon';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Button } from '../../components/Button/Button';
import { Badge } from '../../components/Badge/Badge';
import { Avatar } from '../../components/Avatar/Avatar';
import { ConfirmDialog } from '../../components/ConfirmDialog/ConfirmDialog';
import { MenuPopover } from '../../components/MenuPopover/MenuPopover';
import { PdfPreviewOverlay } from '../../components/PdfPreviewOverlay/PdfPreviewOverlay';
import { useAppStore } from '../../store/useAppStore';
import { toast } from '../../components/Toast/sonnerToast';
import {
  STATUS_ORDER, STATUS_LABELS, STATUS_BADGE_VARIANTS, PRIORITY_ORDER, PRIORITY_LABELS,
  getInitials, isOverdue, formatDateFriendly, PAGE_SIZE,
} from './TasksView.utils';
import { SubtaskIcon, PriorityIcon } from './TasksViewIcons';
import { TaskDatePicker } from './TasksViewDropdowns';
import styles from './TasksView.module.css';

export function RowActionMenu({ task }) {
  const [open, setOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pdfPreview, setPdfPreview] = useState(null);
  const btnRef = useRef(null);
  const updateTask = useAppStore(s => s.updateTask);
  const deleteTask = useAppStore(s => s.deleteTask);
  const showToast = useAppStore(s => s.showToast);
  const allTasks = useAppStore(s => s.tasks);
  const completeCareGapSignOffTask = useAppStore(s => s.completeCareGapSignOffTask);
  const subCount = allTasks.filter(t => t.parent_task_id === task.id).length;

  // HEDIS sign-off tasks route through a dedicated store action so all gaps
  // in the task transition to Completed atomically (AC-13).
  const completeTask = () => {
    if (task.hedisMemberId) {
      completeCareGapSignOffTask(task.id, 'NP');
      showToast('Sign-off task completed — gaps closed');
    } else {
      updateTask(task.id, { status: 'completed' });
      showToast('Task marked as complete');
    }
  };

  const actions = [];
  if (task.status === 'pending') {
    actions.push({ key: 'complete', label: 'Mark as Complete', icon: 'solar:check-circle-linear', handler: completeTask });
    actions.push({ key: 'missed', label: 'Mark as Missed', icon: 'solar:close-circle-linear', handler: () => { updateTask(task.id, { status: 'missed' }); showToast('Task marked as missed'); } });
  } else if (task.status === 'missed') {
    actions.push({ key: 'pending', label: 'Mark as Pending', icon: 'solar:clock-circle-linear', handler: () => { updateTask(task.id, { status: 'pending' }); showToast('Task marked as pending'); } });
    actions.push({ key: 'complete', label: 'Mark as Complete', icon: 'solar:check-circle-linear', handler: completeTask });
  } else if (task.status === 'completed') {
    actions.push({ key: 'pending', label: 'Mark as Pending', icon: 'solar:clock-circle-linear', handler: () => { updateTask(task.id, { status: 'pending' }); showToast('Task marked as pending'); } });
    actions.push({ key: 'missed', label: 'Mark as Missed', icon: 'solar:close-circle-linear', handler: () => { updateTask(task.id, { status: 'missed' }); showToast('Task marked as missed'); } });
  }
  // HEDIS sign-off tasks carry the consolidated clinical-note PDF. The
  // preview is rendered inline via PdfPreviewOverlay so the user stays in
  // the Tasks view (matches production "preview in the same window").
  if (task.consolidatedPdf?.blob) {
    actions.unshift({
      key: 'view-pdf',
      label: 'View consolidated PDF',
      icon: 'solar:document-text-linear',
      handler: () => setPdfPreview(task.consolidatedPdf),
    });
  }
  actions.push({ key: 'delete', label: 'Delete', icon: 'solar:trash-bin-trash-linear', danger: true, handler: () => setShowDeleteConfirm(true) });

  return (
    <div ref={btnRef} style={{ position: 'relative' }}>
      <button className={styles.actionMenuBtn} onClick={e => { e.stopPropagation(); setOpen(v => !v); }} aria-label="Task actions">
        <Icon name="solar:menu-dots-bold" size={16} color="var(--neutral-300)" />
      </button>
      {open && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={e => { e.stopPropagation(); setOpen(false); }}>
          <div
            className={styles.actionMenuDropdown}
            style={{ position: 'fixed', top: btnRef.current?.getBoundingClientRect().bottom + 4, left: btnRef.current?.getBoundingClientRect().right - 180, zIndex: 9999 }}
            onClick={e => e.stopPropagation()}
          >
            {actions.map(a => (
              <button key={a.key} className={`${styles.actionMenuItem} ${a.danger ? styles.actionMenuDanger : ''}`} onClick={() => { a.handler(); setOpen(false); }}>
                <Icon name={a.icon} size={16} />
                {a.label}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
      {pdfPreview && (
        <PdfPreviewOverlay
          blob={pdfPreview.blob}
          filename={pdfPreview.filename}
          onClose={() => setPdfPreview(null)}
        />
      )}
      {showDeleteConfirm && (
        <ConfirmDialog
          icon="solar:danger-triangle-linear"
          iconColor="var(--status-error)"
          title="Delete this task?"
          description={subCount > 0 ? `This task has ${subCount} subtask(s). Deleting it will also delete all subtasks. This cannot be undone.` : 'This action cannot be undone.'}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="error"
          onConfirm={() => { deleteTask(task.id); showToast('Task deleted'); setShowDeleteConfirm(false); }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}

/* ── Inline Status Dropdown for list rows ── */
export function RowStatusDropdown({ task }) {
  const updateTask = useAppStore(s => s.updateTask);
  const showToast = useAppStore(s => s.showToast);
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);

  return (
    <>
      <button
        type="button"
        ref={btnRef}
        style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        aria-label="Change status"
      >
        <Badge variant={STATUS_BADGE_VARIANTS[task.status]} label={STATUS_LABELS[task.status]} trailingIcon="solar:alt-arrow-down-linear" />
      </button>
      {open && (
        <MenuPopover
          anchorRef={btnRef}
          items={STATUS_ORDER.map(s => ({ key: s, label: STATUS_LABELS[s] }))}
          onSelect={v => { updateTask(task.id, { status: v }); showToast(`Status changed to ${STATUS_LABELS[v]}`); }}
          onClose={() => setOpen(false)}
          width={160}
          align="left"
          ariaLabel="Change status"
        />
      )}
    </>
  );
}

/* ── Inline Assignee Dropdown for list rows ──
 * Mirrors the look of RowLabelDropdown: small pill in the row that
 * opens a portal-anchored picker. Sources its options from
 * useAppStore.taskProfiles (profiles table) with the current user
 * pinned at top with "(You)". When the row has no assignee, renders an
 * "Assign" empty-state pill in neutral-200 (same pattern as Add Label).
 */
export function RowAssignDropdown({ task }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const btnRef = useRef(null);
  const updateTask = useAppStore(s => s.updateTask);
  const showToast = useAppStore(s => s.showToast);
  const taskProfiles = useAppStore(s => s.taskProfiles);
  const currentUserProfile = useAppStore(s => s.currentUserProfile);

  // Build picker options: current user first (with "(You)"), then everyone else.
  const profiles = (() => {
    const seen = new Set();
    const list = [];
    if (currentUserProfile?.id) {
      list.push({ ...currentUserProfile, label: `${currentUserProfile.name} (You)` });
      seen.add(currentUserProfile.id);
    }
    (taskProfiles || []).forEach(p => {
      if (seen.has(p.id)) return;
      list.push({ ...p, label: p.name });
      seen.add(p.id);
    });
    return list;
  })();

  const filtered = profiles.filter(p => !search || (p.name || '').toLowerCase().includes(search.toLowerCase()));

  const pick = (profile) => {
    updateTask(task.id, { assigned_to: profile.name, assigned_to_id: profile.id || null });
    showToast(`Assigned to ${profile.name}`);
    setOpen(false);
    setSearch('');
  };

  const handleUnassign = () => {
    updateTask(task.id, { assigned_to: null, assigned_to_id: null });
    showToast('Unassigned');
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={btnRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }} onClick={e => { e.stopPropagation(); setOpen(v => !v); }}>
      {task.assigned_to ? (
        <button className={styles.assignPill} aria-label={`Assigned to ${task.assigned_to}. Click to change.`}>
          <Icon name="solar:user-linear" size={14} color="var(--neutral-300)" />
          <span>{task.assigned_to}</span>
        </button>
      ) : (
        <button className={styles.assignEmpty} aria-label="Assign">
          <Icon name="solar:user-linear" size={13} color="var(--neutral-200)" />
          Assign
        </button>
      )}
      {open && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={e => { e.stopPropagation(); setOpen(false); setSearch(''); }}>
          <div
            className={styles.simpleDropdown}
            style={{ position: 'fixed', top: btnRef.current?.getBoundingClientRect().bottom + 4, left: btnRef.current?.getBoundingClientRect().left, zIndex: 9999 }}
            onClick={e => e.stopPropagation()}
          >
            <div className={styles.dropdownSearch}>
              <Icon name="solar:magnifer-linear" size={14} color="var(--neutral-200)" />
              <input
                className={styles.dropdownSearchInput}
                placeholder="Search assignees..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            {filtered.map(p => {
              const initials = (p.name || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
              return (
                <button key={p.id || p.name} className={styles.simpleDropItem} onClick={() => pick(p)}>
                  <Avatar variant="assignee" initials={initials} className={styles.avatarXs} />
                  <span>{p.label}</span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className={styles.simpleDropItem} style={{ color: 'var(--neutral-200)', cursor: 'default' }}>No matches</div>
            )}
            {task.assigned_to && (
              <button className={styles.simpleDropItem} style={{ color: 'var(--status-error)', borderTop: '0.5px solid var(--neutral-100)' }} onClick={handleUnassign}>
                <Icon name="solar:close-circle-linear" size={14} color="var(--status-error)" />
                Unassign
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/* ── Skeleton Loading ── */

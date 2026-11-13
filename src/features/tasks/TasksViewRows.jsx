import { useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../components/Icon/Icon';
import { CheckboxTick } from '../../components/CheckboxTick/CheckboxTick';
import { Badge } from '../../components/Badge/Badge';
import { AssigneeChange } from '../../components/AssigneeChange/AssigneeChange';
import { useAppStore } from '../../store/useAppStore';
import { isOverdue, buildTaskMetaLine, getInitials } from './TasksView.utils';
import { SubtaskIcon, PriorityIcon, CheckIcon } from './TasksViewIcons';
import { TaskDatePicker } from './TasksViewDropdowns';
import { usePopoverPosition } from './usePopoverPosition';
import { useAssigneeOoo, useRoleOf } from './assigneeHooks';
import { sameName } from '../ooo/oooUtils';
import { Tooltip } from '../../components/Tooltip/Tooltip';
import styles from './TasksView.module.css';

// Build the picker options for AssigneeChange in a row cell: current user
// pinned first with "(You)", then everyone else, deduped by id.
function useAssigneeOptions() {
  const taskProfiles = useAppStore(s => s.taskProfiles);
  const currentUserProfile = useAppStore(s => s.currentUserProfile);
  const roleOf = useRoleOf();
  return useMemo(() => {
    const list = [];
    const seen = new Set();
    if (currentUserProfile?.id) {
      list.push({
        id: currentUserProfile.id,
        name: `${currentUserProfile.name} (You)`,
        initials: getInitials(currentUserProfile.name),
        role: roleOf(currentUserProfile.name),
        _realName: currentUserProfile.name,
      });
      seen.add(currentUserProfile.id);
    }
    (taskProfiles || []).forEach(p => {
      if (seen.has(p.id)) return;
      list.push({
        id: p.id,
        name: p.name,
        initials: getInitials(p.name),
        role: roleOf(p.name),
        _realName: p.name,
      });
      seen.add(p.id);
    });
    return list;
  }, [taskProfiles, currentUserProfile, roleOf]);
}

// Two shared cell renderers so TaskRow and TaskTableRow don't duplicate
// the picker plumbing.
export function AssignedToCell({ task }) {
  const updateTask = useAppStore(s => s.updateTask);
  const showToast = useAppStore(s => s.showToast);
  const options = useAssigneeOptions();
  const outOfOffice = useAssigneeOoo();
  const me = useAppStore(s => s.currentUserProfile);
  // The assignee is out: their avatar wears the Out of Office badge, and its
  // hover adds "You're covering" when their cover names me.
  const assigneeOut = task.assigned_to ? outOfOffice({ id: task.assigned_to_id || null, name: task.assigned_to }) : null;
  const imCovering = !!assigneeOut && (assigneeOut.coveredBy || []).some(n => sameName(n, me?.name));

  const onSelect = (u) => {
    const realName = u._realName || u.name;
    // Giving a pooled task an owner IS claiming it, the store's claimTask()
    // clears `pool` for exactly this reason. Leaving it set would keep the
    // task advertised as unclaimed work in the pool tab.
    updateTask(task.id, { assigned_to: realName, assigned_to_id: u.id || null, pool: null });
    showToast(`Assigned to ${realName}`);
  };

  return (
    <AssigneeChange
      oooUser={task.assigned_to ? { id: task.assigned_to_id || null, name: task.assigned_to } : undefined}
      oooNote={imCovering ? 'You\'re covering' : undefined}
      name={task.assigned_to || undefined}
      initials={task.assigned_to ? getInitials(task.assigned_to) : undefined}
      unassigned={!task.assigned_to}
      unassignedLabel="Assign"
      size="M"
      showRole={false}
      fillContainer
      users={options}
      onSelect={onSelect}
      outOfOffice={outOfOffice}
    />
  );
}

export function MemberCell({ task }) {
  const openMember = (e) => {
    e.stopPropagation();
    const state = useAppStore.getState();
    const match = state.patients.find(p => p.name === task.member)
      || (state.allPatients || []).find(p => p.name === task.member);
    if (match) state.openQuickView(match);
  };
  if (!task.member) return null;
  return (
    <AssigneeChange
      name={task.member}
      initials={getInitials(task.member)}
      avatarVariant="patient"
      size="M"
      showRole={false}
      fillContainer
      onClick={openMember}
      ariaLabel={`Open member ${task.member}`}
    />
  );
}

export function RowLabelDropdown({ task, children }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const btnRef = useRef(null);
  const pos = usePopoverPosition(btnRef, open);
  const updateTask = useAppStore(s => s.updateTask);
  const showToast = useAppStore(s => s.showToast);
  const taskLabels = useAppStore(s => s.taskLabels);
  const createTaskLabel = useAppStore(s => s.createTaskLabel);
  const labels = Array.isArray(task.labels) ? task.labels : [];
  const labelSet = useMemo(() => new Set(labels), [labels]);
  const filtered = taskLabels.filter(l => !search || l.toLowerCase().includes(search.toLowerCase()));
  const exact = taskLabels.find(l => l.toLowerCase() === search.trim().toLowerCase());
  const canCreate = search.trim() && !exact;

  const toggle = (l) => {
    const next = labels.includes(l) ? labels.filter(x => x !== l) : [...labels, l];
    updateTask(task.id, { labels: next });
    showToast(labels.includes(l) ? `Label "${l}" removed` : `Label "${l}" added`);
  };

  const handleCreate = async () => {
    const created = await createTaskLabel(search.trim());
    if (created) {
      showToast(`Label "${created}" created`);
      const next = [...labels, created];
      updateTask(task.id, { labels: next });
      setSearch('');
    }
  };

  return (
    <div ref={btnRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }} onClick={e => { e.stopPropagation(); setOpen(v => !v); }}>
      {children || (
        <button className={styles.addLabel}>
          <Icon name="solar:tag-linear" size={13} color="var(--neutral-200)" />
          Add Label
        </button>
      )}
      {open && pos && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={e => { e.stopPropagation(); setOpen(false); setSearch(''); }}>
          <div
            className={styles.simpleDropdown}
            style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
            onClick={e => e.stopPropagation()}
          >
            <div className={styles.dropdownSearch}>
              <Icon name="solar:magnifer-linear" size={14} color="var(--neutral-200)" />
              <input aria-label="Search or create a label"
                className={styles.dropdownSearchInput}
                placeholder="Search or create..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && canCreate) handleCreate(); }}
                autoFocus
              />
            </div>
            {filtered.map(l => (
              <button key={l} type="button" role="menuitemcheckbox" aria-checked={labelSet.has(l)} className={styles.simpleDropItem} onClick={() => toggle(l)}>
                <CheckboxTick checked={labelSet.has(l)} size={15} />
                {l}
              </button>
            ))}
            {canCreate && (
              <button className={styles.simpleDropItem} style={{ color: 'var(--primary-300)', fontWeight: 500 }} onClick={handleCreate}>
                <Icon name="solar:add-circle-linear" size={14} color="var(--primary-300)" />
                Create "{search.trim()}"
              </button>
            )}
            {filtered.length === 0 && !canCreate && (
              <div className={styles.simpleDropItem} style={{ color: 'var(--neutral-200)', cursor: 'default' }}>No results</div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/* ── Three-dot Action Menu for rows and kanban cards ── */
import { RowActionMenu, RowStatusDropdown } from './TasksViewRowDropdowns';
export function SkeletonRow() {
  return (
    <div className={styles.taskRow}>
      <div className={styles.cellCheck}>
        <div className={`${styles.skeleton} ${styles.skeletonCircle}`} />
      </div>
      <div className={styles.cellTask}>
        <div className={styles.taskInfo}>
          <div className={`${styles.skeleton} ${styles.skeletonText}`} style={{ width: '70%' }} />
          <div className={`${styles.skeleton} ${styles.skeletonText}`} style={{ width: '40%', height: 10 }} />
        </div>
      </div>
      <div className={styles.cellP}>
        <div className={`${styles.skeleton} ${styles.skeletonSmall}`} />
      </div>
      <div className={styles.cellStatus}>
        <div className={`${styles.skeleton} ${styles.skeletonBadge}`} />
      </div>
      <div className={styles.cellDue}>
        <div className={`${styles.skeleton} ${styles.skeletonText}`} style={{ width: '80%' }} />
      </div>
      <div className={styles.cellMember}>
        <div className={`${styles.skeleton} ${styles.skeletonText}`} style={{ width: '60%' }} />
      </div>
      <div className={styles.cellLabels}>
        <div className={`${styles.skeleton} ${styles.skeletonBadge}`} />
      </div>
    </div>
  );
}

/* ── List View: Task Row ── */
export function TaskRow({ task, onToggle, onTaskClick, hideAssignedTo, hideMember, pinnedEnds }) {
  const isCompleted = task.status === 'completed';
  const labels = Array.isArray(task.labels) ? task.labels : [];
  const updateTask = useAppStore(s => s.updateTask);
  const showToast = useAppStore(s => s.showToast);
  // Row-flash signal from the activity feed clickthrough, highlights the
  // matching task for 3s in primary-50 / primary-300 so the user sees where
  // the drawer landed. Cleared automatically by the store's timer.
  const flashTaskId = useAppStore(s => s.flashTaskId);
  const flashing = flashTaskId != null && String(flashTaskId) === String(task.id);

  const overdue = isOverdue(task);

  return (
    <div className={`${styles.taskRow} ${overdue ? styles.taskRowMissed : ''} ${flashing ? styles.taskRowFlash : ''}`} onClick={() => onTaskClick?.(task)}>
      <div className={`${styles.cellCheck} ${pinnedEnds ? styles.pinLeft0 : ''}`}>
        <button
          type="button"
          className={`${styles.taskCheckbox} ${isCompleted ? styles.taskCheckboxChecked : ''}`}
          onClick={e => { e.stopPropagation(); onToggle(task); }}
          aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
        >
          <span className={styles.taskCheckIcon}>
            <CheckIcon size={13} />
          </span>
        </button>
      </div>

      <div className={`${styles.cellTask} ${pinnedEnds ? styles.pinLeftCheck : ''}`}>
        <div className={styles.taskInfo}>
          {task.parent_task && (
            <span className={styles.parentLabel}>Parent Task : {task.parent_task}</span>
          )}
          {task.is_subtask ? (
            <div className={styles.subtaskRow}>
              <SubtaskIcon size={14} color="var(--primary-300)" />
              <span className={`${styles.taskName} ${isCompleted ? styles.taskNameDone : ''}`}>{task.name}</span>
            </div>
          ) : (
            <span className={`${styles.taskName} ${isCompleted ? styles.taskNameDone : ''}`}>{task.name}</span>
          )}
          <span className={styles.taskMeta}>{buildTaskMetaLine(task)}</span>
        </div>
        <div className={styles.taskAttachments}>
          {task.attachments > 0 && (
            <LinkedNotePaperclip task={task} count={task.attachments} />
          )}
          {task.comments > 0 && (
            <span className={styles.attachBadge}>
              <Icon name="solar:chat-round-line-linear" size={14} color="var(--neutral-300)" />
              {task.comments}
            </span>
          )}
        </div>
      </div>

      <div className={styles.cellP}>
        <PriorityIcon priority={task.priority} size={16} />
      </div>

      <div className={styles.cellStatus} onClick={e => e.stopPropagation()}>
        <RowStatusDropdown task={task} />
      </div>

      <div className={`${styles.cellDue} ${overdue ? styles.dueMissed : ''}`} onClick={e => e.stopPropagation()}>
        <TaskDatePicker value={task.due_date} overdue={overdue} onSelect={v => { updateTask(task.id, { due_date: v }); showToast('Due date updated'); }} />
      </div>

      {!hideAssignedTo && (
        <div className={styles.cellAssigned} onClick={e => e.stopPropagation()}>
          <AssignedToCell task={task} />
        </div>
      )}

      {!hideMember && (
        <div className={styles.cellMember} onClick={e => e.stopPropagation()}>
          <MemberCell task={task} />
        </div>
      )}

      <div className={styles.cellLabels} onClick={e => e.stopPropagation()}>
        <RowLabelDropdown task={task}>
          {labels.length > 0 ? (
            <>
              {labels.slice(0, 2).map(l => (
                <Badge key={l} label={l} />
              ))}
              {labels.length > 2 && (
                <span className={styles.labelOverflow} title={labels.slice(2).join(', ')}>+{labels.length - 2}</span>
              )}
            </>
          ) : (
            <button className={styles.addLabel}>
              <Icon name="solar:tag-linear" size={13} color="var(--neutral-200)" />
              Add Label
            </button>
          )}
        </RowLabelDropdown>
      </div>

      <div className={`${styles.cellActions} ${pinnedEnds ? styles.pinRight0 : ''}`} onClick={e => e.stopPropagation()}>
        <RowActionMenu task={task} />
      </div>
    </div>
  );
}

/* ── Table-mode row (WorklistShell) ── */
export function TaskTableRow({ task, onToggle, onTaskClick, hideAssignedTo, hideMember }) {
  const isCompleted = task.status === 'completed';
  const labels = Array.isArray(task.labels) ? task.labels : [];
  const updateTask = useAppStore(s => s.updateTask);
  const showToast = useAppStore(s => s.showToast);
  const overdue = isOverdue(task);
  const flashTaskId = useAppStore(s => s.flashTaskId);
  const flashing = flashTaskId != null && String(flashTaskId) === String(task.id);

  return (
    <tr className={`${styles.taskTr} ${flashing ? styles.taskTrFlash : ''}`} onClick={() => onTaskClick?.(task)}>
      <td className={styles.tdCheck}>
        <button
          type="button"
          className={`${styles.taskCheckbox} ${isCompleted ? styles.taskCheckboxChecked : ''}`}
          onClick={e => { e.stopPropagation(); onToggle(task); }}
          aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
        >
          <span className={styles.taskCheckIcon}>
            <CheckIcon size={13} />
          </span>
        </button>
      </td>

      <td className={styles.tdTask}>
        <div className={styles.tdTaskInner}>
          <div className={styles.taskInfo}>
            {task.parent_task && (
              <span className={styles.parentLabel}>Parent Task : {task.parent_task}</span>
            )}
            {task.is_subtask ? (
              <div className={styles.subtaskRow}>
                <SubtaskIcon size={14} color="var(--primary-300)" />
                <span className={`${styles.taskName} ${isCompleted ? styles.taskNameDone : ''}`}>{task.name}</span>
              </div>
            ) : (
              <span className={`${styles.taskName} ${isCompleted ? styles.taskNameDone : ''}`}>{task.name}</span>
            )}
            <span className={styles.taskMeta}>{buildTaskMetaLine(task)}</span>
          </div>
          <div className={styles.taskAttachments}>
            {task.attachments > 0 && (
              <LinkedNotePaperclip task={task} count={task.attachments} />
            )}
            {task.comments > 0 && (
              <span className={styles.attachBadge}>
                <Icon name="solar:chat-round-line-linear" size={14} color="var(--neutral-300)" />
                {task.comments}
              </span>
            )}
          </div>
        </div>
      </td>

      <td className={styles.tdCenter}>
        <PriorityIcon priority={task.priority} size={16} />
      </td>

      <td className={styles.td} onClick={e => e.stopPropagation()}>
        <RowStatusDropdown task={task} />
      </td>

      <td className={`${styles.td} ${styles.tdDue} ${overdue ? styles.dueMissed : ''}`} onClick={e => e.stopPropagation()}>
        <TaskDatePicker value={task.due_date} overdue={overdue} onSelect={v => { updateTask(task.id, { due_date: v }); showToast('Due date updated'); }} />
      </td>

      {!hideAssignedTo && (
        <td className={styles.td} style={{ width: 170, minWidth: 170 }} onClick={e => e.stopPropagation()}>
          <AssignedToCell task={task} />
        </td>
      )}

      {!hideMember && (
        <td className={styles.td} style={{ width: 210, minWidth: 210 }} onClick={e => e.stopPropagation()}>
          <MemberCell task={task} />
        </td>
      )}

      <td className={styles.td} onClick={e => e.stopPropagation()}>
        <RowLabelDropdown task={task}>
          <div className={styles.tdLabelsInner}>
            {labels.length > 0 ? (
              <>
                {labels.slice(0, 2).map(l => (
                  <Badge key={l} label={l} />
                ))}
                {labels.length > 2 && (
                  <span className={styles.labelOverflow} title={labels.slice(2).join(', ')}>+{labels.length - 2}</span>
                )}
              </>
            ) : (
              <button className={styles.addLabel}>
                <Icon name="solar:tag-linear" size={13} color="var(--neutral-200)" />
                Add Label
              </button>
            )}
          </div>
        </RowLabelDropdown>
      </td>

      <td className={styles.tdActionsCell} onClick={e => e.stopPropagation()}>
        <RowActionMenu task={task} />
      </td>
    </tr>
  );
}

/* ── Linked-Note hover preview for the paperclip badge ──
   HEDIS Sign-Off tasks always link back to a clinical note, the row
   already shows an attachments count via the paperclip badge, but there
   is no fast way to know WHICH note is linked without opening the task
   drawer. On hover (after a 300ms intent delay) surface a compact card
   with the note title, gap chips, status pill, and author line so the
   reviewer/author can triage from the list.
   Falls back to the standard paperclip badge (no popover) for non-
   HEDIS tasks and for HEDIS rows whose linked note can't be resolved. */
function LinkedNotePaperclip({ task, count }) {
  const resolvedMemberId = useAppStore(s => {
    if (!task || task.pool !== 'HEDIS Sign-Off') return null;
    return task.hedisMemberId
      || (task.member ? s.hedisMembers?.find(m => m.name === task.member)?.id : null)
      || null;
  });
  const linkedNote = useAppStore(s => {
    if (!resolvedMemberId) return null;
    const list = s.clinicalNotesByMember?.[resolvedMemberId] || [];
    const byLink = list.find(n => String(n.reviewTaskId) === String(task.id));
    if (byLink) return byLink;
    const gaps = task.hedisGapCodes || task.labels || [];
    if (!gaps.length) return null;
    return list.find(n => (n.gapCodes || []).some(c => gaps.includes(c))) || null;
  });
  const fetchClinicalNotesForMember = useAppStore(s => s.fetchClinicalNotesForMember);
  const openNotePreview = useAppStore(s => s.openNotePreview);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const anchorRef = useRef(null);
  const timerRef = useRef(null);
  const canPreview = !!resolvedMemberId;
  const handleEnter = () => {
    if (!canPreview) return;
    // Lazy-fetch the member's notes on first hover: Tasks-tab rows
    // never trigger the CareGap-flow fetches, so the slice can be empty
    // when the user hovers without ever having opened the drawer.
    if (!linkedNote && resolvedMemberId) fetchClinicalNotesForMember?.(resolvedMemberId);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPos({ top: rect.bottom + 8, left: Math.max(12, rect.left + rect.width / 2 - 160) });
      setOpen(true);
    }, 300);
  };
  const handleLeave = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    // Small grace period so the cursor can travel from the badge into
    // the card without dismissing it. Cancelled by the card's own
    // mouseenter bridge.
    timerRef.current = setTimeout(() => setOpen(false), 120);
  };
  return (
    <span
      ref={anchorRef}
      className={styles.attachBadge}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <Icon name="solar:paperclip-linear" size={14} color="var(--neutral-300)" />
      {count}
      {open && pos && linkedNote && createPortal(
        <LinkedNoteHoverCard
          note={linkedNote}
          style={{ top: pos.top, left: pos.left }}
          onOpen={(e) => {
            e?.stopPropagation();
            setOpen(false);
            // Opens ONLY the note preview drawer, not the task drawer.
            // TasksView owns the mount point via the `previewNoteFromHover`
            // store slice.
            openNotePreview?.(linkedNote);
          }}
          onHoverBridge={(e) => {
            // Keep the card open while the pointer is over it, the
            // paperclip badge's mouseleave still fires as the cursor
            // travels the gap, and cursor entering the card must
            // supersede that so the reader can click "View note".
            if (e.type === 'mouseenter') {
              if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
            } else if (e.type === 'mouseleave') {
              setOpen(false);
            }
          }}
        />,
        document.body,
      )}
    </span>
  );
}

function LinkedNoteHoverCard({ note, style, onOpen, onHoverBridge }) {
  const codes = note.gapCodes || [];
  const title = codes.length > 1
    ? 'Consolidated Clinical Note'
    : codes[0]
      ? `${codes[0]} Visit Note`
      : 'Clinical Note';
  const status = note.status === 'signed' ? 'Signed'
    : note.status === 'submitted' ? 'Pending Review'
    : 'Draft';
  const tone = status === 'Signed' ? 'success' : status === 'Draft' ? 'neutral' : 'warning';
  const subtitle = note.status === 'signed'
    ? `Signed by ${note.signedByName || note.reviewerName || 'Provider'}`
    : note.status === 'submitted'
      ? `Submitted for Review to ${note.reviewerName || '-'}`
      : `Draft by ${note.authorName || 'You'}`;
  const when = note.updatedAt || note.createdAt;
  let whenStr = '';
  if (when) {
    const d = new Date(when);
    if (!Number.isNaN(d.getTime())) {
      whenStr = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
    }
  }
  return (
    <div
      className={styles.linkedNoteHoverCard}
      style={{ position: 'fixed', ...style }}
      role="tooltip"
      onMouseEnter={onHoverBridge}
      onMouseLeave={onHoverBridge}
    >
      <div className={styles.linkedNoteHoverHeader}>
        <div className={styles.linkedNoteHoverTitleWrap}>
          <div className={styles.linkedNoteHoverTitle}>{title}</div>
          <div className={styles.linkedNoteHoverSubtitle}>{subtitle}</div>
        </div>
      </div>
      {!!codes.length && (
        <div className={styles.linkedNoteHoverChips}>
          {codes.map(c => <Badge key={c} size="sm" label={c} />)}
        </div>
      )}
      <div className={styles.linkedNoteHoverFooter}>
        <Badge tone={tone} size="sm" label={status} />
        <button
          type="button"
          className={styles.linkedNoteHoverAction}
          onClick={onOpen}
        >
          View note
          <Icon name="solar:arrow-right-up-linear" size={12} color="var(--primary-300)" />
        </button>
      </div>
    </div>
  );
}

/* ── List View: Status Group ── */

export { StatusGroup } from './TasksViewStatusGroup';


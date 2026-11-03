import { useEffect } from 'react';
import { sanitizeRichText } from '../../lib/sanitizeHtml';
import { Icon } from '../../components/Icon/Icon';
import { ActionButton } from '../../components/ActionButton/ActionButton';
import { Button } from '../../components/Button/Button';
import { Badge } from '../../components/Badge/Badge';
import { Avatar } from '../../components/Avatar/Avatar';
import { CommentComposer } from '../../components/CommentComposer/CommentComposer';
import { Toggle } from '../../components/Toggle/Toggle';
import { useAppStore } from '../../store/useAppStore';
import { Select } from '../../components/Select/Select';
import { LABEL_OPTIONS, TITLE_MAX, getInitials, isOverdue, STATUS_LABELS, STATUS_BADGE_VARIANTS, PRIORITY_OPTIONS } from './TasksView.utils';
import { PriorityIcon } from './TasksViewIcons';
import { TaskDatePicker, DetailDropdown } from './TasksViewDropdowns';
import styles from './TasksView.module.css';

export function TaskDetailDrawerDetails({
  task, labels, assigneeNames, taskProfiles, updateTask, showToast, assigneeInitials,
  taskPools, memberOptionsForDrawer, memberInitials, setPdfPreview, hedisMember,
  setEditingNote, setPreviewNote, completeCareGapSignOffTask, onClose, editingDesc, setEditingDesc, descDraft, setDescDraft,
}) {
  // The sign-off task is linked to a clinical_notes row via review_task_id.
  // Surface it right below the description so the reviewer can jump into
  // the note preview without needing to navigate back to the care gap.
  // Ensure the slice is populated for this member on drawer open, the
  // tasks page path never touched CareGapDetailDrawer, so the slice
  // starts empty here even when the note exists on the server.
  const fetchClinicalNotesForMember = useAppStore(s => s.fetchClinicalNotesForMember);
  const hedisMembers = useAppStore(s => s.hedisMembers);
  // The Tasks page never touches CareGapDetailDrawer, so sign-off tasks
  // arriving here from the Tasks tab don't carry hedisMemberId /
  // hedisGapCodes on the row (those live on the CareGap flow's in-memory
  // state, not on the persisted task). Derive the HEDIS member from the
  // task's member name so the Linked Note surfaces here the same way it
  // does from the CareGap flow.
  const resolvedHedisMemberId = task?.hedisMemberId
    || (task?.pool === 'HEDIS Sign-Off' && task?.member
      ? hedisMembers.find(m => m.name === task.member)?.id
      : null)
    || null;
  useEffect(() => {
    if (resolvedHedisMemberId) fetchClinicalNotesForMember?.(resolvedHedisMemberId);
  }, [resolvedHedisMemberId, fetchClinicalNotesForMember]);
  const linkedNote = useAppStore(s => {
    const isSignOffTask = task?.pool === 'HEDIS Sign-Off';
    // Sign-off tasks are only ever created when a note is submitted
    // for review: a draft cannot own a sign-off task. Filter drafts
    // out of the pool so a stale single-gap draft can't shadow the
    // consolidated submitted note this task actually represents.
    const eligible = (list) => (isSignOffTask
      ? (list || []).filter(n => n.status !== 'draft')
      : (list || []));

    // Fast path: the task carries the member id already (CareGap flow).
    if (resolvedHedisMemberId) {
      const list = eligible(s.clinicalNotesByMember?.[resolvedHedisMemberId]);
      const byLink = list.find(n => String(n.reviewTaskId) === String(task.id));
      if (byLink) return byLink;
      const gaps = task.hedisGapCodes || task.labels || [];
      if (gaps.length) {
        // Prefer a note whose gap set MATCHES the task exactly
        // (consolidated task → consolidated note; single-gap task →
        // single-gap note). Falls through to broader overlap so a
        // partially-matching submitted note still wins over nothing.
        const gapSet = new Set(gaps);
        const matchesAll = (n) => {
          const nGaps = n.gapCodes || [];
          if (nGaps.length !== gapSet.size) return false;
          return nGaps.every(c => gapSet.has(c));
        };
        const overlaps = (n) => (n.gapCodes || []).some(c => gapSet.has(c));
        const taskDone = String(task.status || '').toLowerCase() === 'completed';
        // Sign-off tasks: draft is already filtered out above, so the
        // preferred lifecycle for a pending task is submitted, and for
        // a completed task it's signed. Non-sign-off tasks keep the
        // three-tier preference as before.
        const preferOrder = isSignOffTask
          ? (taskDone ? ['signed', 'submitted'] : ['submitted', 'signed'])
          : (taskDone ? ['signed', 'submitted', 'draft'] : ['submitted', 'draft', 'signed']);
        for (const st of preferOrder) {
          const exact = list.find(n => n.status === st && matchesAll(n));
          if (exact) return exact;
        }
        for (const st of preferOrder) {
          const hit = list.find(n => n.status === st && overlaps(n));
          if (hit) return hit;
        }
        // Any overlapping eligible note as a last resort.
        const anyHit = list.find(overlaps);
        if (anyHit) return anyHit;
      }
    }
    // Fallback: scan every fetched member slice for a note linked to this
    // task id. Reaches any note that has been fetched anywhere else in the
    // session, even when we couldn't resolve the member id up front.
    const all = s.clinicalNotesByMember || {};
    for (const list of Object.values(all)) {
      const byLink = eligible(list).find(n => String(n.reviewTaskId) === String(task.id));
      if (byLink) return byLink;
    }
    return null;
  });
  return (
    <>
        {/* Detail rows */}
        <div className={styles.drawerDetails}>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Assigned To</span>
            <DetailDropdown
              value={task.assigned_to}
              options={assigneeNames}
              onSelect={v => {
                const picked = (taskProfiles || []).find(p => p.name === v);
                // Same claim semantics as the row cell, an owner and a pool
                // are mutually exclusive.
                updateTask(task.id, { assigned_to: v, assigned_to_id: picked?.id || null, pool: null });
                showToast(`Assigned to ${v}`);
              }}
              renderOption={opt => (
                <><Avatar variant="assignee" initials={getInitials(opt)} size="S" /> {opt}</>
              )}
            >
              <Avatar variant="assignee" initials={assigneeInitials} size="S" />
              <span>{task.assigned_to || '-'}</span>
            </DetailDropdown>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Task Pool</span>
            <DetailDropdown
              value={task.pool || 'None'}
              options={['None', ...taskPools.map(p => p.name)]}
              onSelect={v => {
                const next = v === 'None' ? null : v;
                // A pooled task is unclaimed by definition, both the "My Task
                // Pool" tab and the Claim button require no assignee. Pooling
                // without dropping the assignee left the task invisible in
                // both places. Mirrors the Add Task drawer, which already
                // nulls the assignee whenever a pool is picked.
                updateTask(task.id, next
                  ? { pool: next, assigned_to: null, assigned_to_id: null }
                  : { pool: null });
                showToast(next ? `Pool set to ${next}` : 'Removed from pool');
              }}
            />
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Due Date</span>
            <TaskDatePicker value={task.due_date} overdue={isOverdue(task)} onSelect={v => { updateTask(task.id, { due_date: v }); showToast('Due date updated'); }} />
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Priority</span>
            <DetailDropdown
              value={task.priority}
              options={PRIORITY_OPTIONS}
              onSelect={v => { updateTask(task.id, { priority: v }); showToast(`Priority set to ${v}`); }}
              renderOption={opt => (
                <><PriorityIcon priority={opt} size={16} /> <span style={{ textTransform: 'capitalize' }}>{opt}</span></>
              )}
            >
              <PriorityIcon priority={task.priority} size={16} />
              <span style={{ textTransform: 'capitalize' }}>{task.priority}</span>
            </DetailDropdown>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Member</span>
            <DetailDropdown
              value={task.member}
              options={memberOptionsForDrawer}
              onSelect={v => { updateTask(task.id, { member: v }); showToast(`Member set to ${v}`); }}
              renderOption={opt => (
                <><Avatar variant="patient" initials={getInitials(opt)} size="S" /> {opt}</>
              )}
            >
              <Avatar variant="patient" initials={memberInitials} size="S" />
              <span>{task.member}</span>
            </DetailDropdown>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Labels</span>
            <div className={styles.detailValueLabels}>
              {labels.map(l => (
                <Badge
                  key={l}
                  label={l}
                  trailingIcon="solar:close-circle-linear"
                  trailingIconLabel={`Remove ${l}`}
                  onTrailingIconClick={() => {
                    updateTask(task.id, { labels: labels.filter(x => x !== l) });
                    showToast(`Label "${l}" removed`);
                  }}
                />
              ))}
              <DetailDropdown
                value=""
                options={LABEL_OPTIONS.filter(l => !labels.includes(l))}
                onSelect={v => {
                  updateTask(task.id, { labels: [...labels, v] });
                  showToast(`Label "${v}" added`);
                }}
              >
                <Icon name="solar:add-circle-linear" size={14} color="var(--neutral-200)" />
              </DetailDropdown>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className={styles.drawerSection}>
          <span className={styles.drawerSectionLabel}>Description</span>
          {editingDesc ? (
            <div className={styles.descEditor}>
              <div
                className={styles.descEditable}
                contentEditable
                suppressContentEditableWarning
                dangerouslySetInnerHTML={{ __html: sanitizeRichText(descDraft) }}
                onInput={e => setDescDraft(e.currentTarget.innerHTML)}
              />
              <div className={styles.descToolbar}>
                <ActionButton icon="solar:paperclip-linear" size="sm" tooltip="Attach" />
                <span className={styles.toolbarDivider} />
                <ActionButton icon="solar:text-bold-linear" size="sm" tooltip="Bold" onClick={() => document.execCommand('bold')} />
                <ActionButton icon="solar:text-italic-linear" size="sm" tooltip="Italic" onClick={() => document.execCommand('italic')} />
                <ActionButton icon="solar:text-underline-linear" size="sm" tooltip="Underline" onClick={() => document.execCommand('underline')} />
                <ActionButton icon="solar:text-cross-linear" size="sm" tooltip="Strikethrough" onClick={() => document.execCommand('strikeThrough')} />
                <span className={styles.toolbarDivider} />
                <ActionButton icon="solar:list-linear" size="sm" tooltip="List" onClick={() => document.execCommand('insertUnorderedList')} />
                <div style={{ flex: 1 }} />
                <ActionButton icon="solar:close-circle-linear" size="sm" tooltip="Discard" onClick={() => setEditingDesc(false)} />
                <ActionButton icon="solar:check-read-linear" size="sm" tooltip="Save" onClick={() => { updateTask(task.id, { description: descDraft }); setEditingDesc(false); showToast('Description saved'); }} />
              </div>
            </div>
          ) : (
            <div
              className={styles.descriptionBox}
              onClick={() => { setDescDraft(task.description || ''); setEditingDesc(true); }}
              dangerouslySetInnerHTML={{ __html: task.description ? sanitizeRichText(task.description) : '<span style="color: var(--neutral-200);">Click to add description...</span>' }}
            />
          )}
        </div>

        {task?.pool === 'HEDIS Sign-Off' && (
          <div className={styles.drawerSection}>
            <span className={styles.drawerSectionLabel}>Linked Note</span>
            {linkedNote ? (
              <LinkedNoteCard
                note={linkedNote}
                task={task}
                setEditingNote={setEditingNote}
                setPreviewNote={setPreviewNote}
                showToast={showToast}
              />
            ) : (
              <div className={styles.linkedNoteEmpty}>
                <Icon name="solar:notes-linear" size={20} color="var(--neutral-200)" />
                <span className={styles.linkedNoteEmptyText}>
                  No clinical note attached to this task yet.
                </span>
              </div>
            )}
          </div>
        )}
    </>
  );
}

function LinkedNoteCard({ note, task, setEditingNote, setPreviewNote }) {
  // A Pending-Review note has two audiences from this row:
  //   • the assigned reviewer: should drop straight into the editable
  //     ClinicalNotePanel so they can revise + sign; matches the CareGap
  //     drawer's reviewer path.
  //   • everyone else (the author, other viewers), should see the
  //     read-only preview, since they cannot sign on the reviewer's behalf.
  // We compare the note's `reviewerName` against the signed-in user's
  // display name; the CareGap flow uses the same equality check.
  const currentActorName = useAppStore(s => s.currentActorName);
  const iAmReviewer = !!note.reviewerName && note.reviewerName === currentActorName?.();
  const codes = note.gapCodes?.length ? note.gapCodes : (task.hedisGapCodes || []);
  const title = codes.length > 1 ? 'Consolidated Clinical Note' : `${codes[0] || task.hedisGapCodes?.[0] || 'Clinical'} Visit Note`;
  const status = note.status === 'signed' ? 'Signed'
    : note.status === 'submitted' ? 'Pending Review'
    : 'Draft';
  const statusTone = status === 'Signed' ? 'success' : status === 'Draft' ? 'neutral' : 'warning';
  const authorLine = note.status === 'signed'
    ? `Signed by ${note.signedByName || note.reviewerName || 'Provider'}${note.signedAt ? ` · ${fmtDate(note.signedAt)}` : ''}`
    : note.status === 'submitted'
      ? `Submitted for Review to ${note.reviewerName || '-'}`
      : `Save as Draft by ${note.authorName || 'You'}`;
  const metaWhen = note.updatedAt || note.createdAt;
  return (
    <div className={styles.linkedNoteCard}>
      <div className={styles.linkedNoteMeta}>
        {metaWhen ? `${fmtDate(metaWhen)}, ${fmtTime(metaWhen)}` : ''}
        {note.authorName ? ` • ${note.authorName}` : ''}
      </div>
      <div className={styles.linkedNoteRow}>
        <div className={styles.linkedNoteText}>
          <div className={styles.linkedNoteTitleRow}>
            <span className={styles.linkedNoteTitle}>{title}</span>
            {codes.length > 1 && <Badge size="sm" label={`${codes.length} Gaps`} />}
          </div>
          <div className={styles.linkedNoteSubtitle}>{authorLine}</div>
        </div>
        <div className={styles.linkedNoteTrailing}>
          <Badge tone={statusTone} size="md" label={status} />
          <button
            type="button"
            className={styles.linkedNoteView}
            onClick={() => {
              // Signed → always read-only preview (Amend is the audit
              // path). Pending Review → the assigned reviewer opens the
              // editable panel so they can revise + sign; every other
              // viewer sees the same read-only preview the reviewer would
              // publish. Draft → editable panel so the author keeps
              // composing.
              if (note.status === 'signed' && setPreviewNote) {
                setPreviewNote(note);
                return;
              }
              if (note.status === 'submitted') {
                if (iAmReviewer) setEditingNote?.(true);
                else if (setPreviewNote) setPreviewNote(note);
                else setEditingNote?.(true);
                return;
              }
              setEditingNote?.(true);
            }}
          >
            View
            <Icon name="solar:arrow-right-up-linear" size={12} color="var(--primary-300)" />
          </button>
        </div>
      </div>
    </div>
  );
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
}
function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

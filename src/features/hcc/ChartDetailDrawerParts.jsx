import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../../components/Icon/Icon';
import { CloseButton } from '../../components/CloseButton/CloseButton';
import { Button } from '../../components/Button/Button';
import { Select } from '../../components/Select/Select';
import { Checkbox } from '../../components/ShadcnCheckbox/ShadcnCheckbox';
import { Textarea } from '../../components/Textarea/Textarea';
import { CommentComposer } from '../../components/CommentComposer/CommentComposer';
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription } from '../../components/ConfirmDialog/AlertDialogPrimitives';
import { useAppStore } from '../../store/useAppStore';
import { DOC_TYPES } from './data/chartDocs';
import { FAIL_REASONS, INSUFFICIENT_REASONS } from './ChartDetailDrawerParts.constants';
import styles from './ChartDetailDrawer.module.css';

export function StatusIcon({ status, size = 16 }) {
  const common = { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', style: { flexShrink: 0 } };
  switch (status) {
    case 'in-progress':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6.5" stroke="var(--status-warning)" strokeWidth="1.2" />
          <path d="M8 1.5A6.5 6.5 0 0 1 8 14.5Z" fill="var(--status-warning)" />
        </svg>
      );
    case 'insufficient':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="7" fill="var(--status-warning-light)" stroke="var(--status-warning)" />
          <path d="M8 4.5V8.6" stroke="var(--status-warning)" strokeLinecap="round" />
          <circle cx="8" cy="11" r="0.75" fill="var(--status-warning)" />
        </svg>
      );
    case 'completed':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="7" fill="var(--status-success-light)" stroke="var(--status-success)" />
          <path d="M5 8.2l2 2 4-4.4" stroke="var(--status-success)" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'rejected':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="7" fill="var(--status-error-light)" stroke="var(--status-error)" />
          <path d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8" stroke="var(--status-error)" strokeLinecap="round" />
        </svg>
      );
    case 'action-needed':
    default:
      return (
        <svg {...common}>
          <path d="M8 0.5C12.14 0.5 15.5 3.86 15.5 8C15.5 12.14 12.14 15.5 8 15.5C3.86 15.5 0.5 12.14 0.5 8C0.5 3.86 3.86 0.5 8 0.5Z" fill="var(--status-warning-light)" />
          <path d="M8 0.5C12.14 0.5 15.5 3.86 15.5 8C15.5 12.14 12.14 15.5 8 15.5C3.86 15.5 0.5 12.14 0.5 8C0.5 3.86 3.86 0.5 8 0.5Z" stroke="var(--neutral-400)" />
          <path d="M8 4V5.33M12 8H10.67M8 12V10.67M4 8H5.33M5.17 5.17L6.11 6.11M10.83 5.17L9.89 6.11M10.83 10.83L9.89 9.89M5.17 10.83L6.11 9.89" stroke="var(--neutral-400)" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

// Inline fail-reason form — renders INSIDE the doc card whose Fail button
// was clicked, so the doc header (name + meta + Pass/Fail/⋯) and the
// reason picker read as one bordered container per Figma. Keeps every
// other doc row and header action live so the reviewer can bail out
// (three-dots, hover on the status pill, etc.) without an overlay
// blocking the surface.
export function FailReasonInline({ onCancel, onConfirm, value, onChange, hideActions = false }) {
  // Two modes:
  //  1. Uncontrolled (default) — internal state + Confirm/Cancel actions.
  //     Used by ChartDetailDrawer where the picker commits on Confirm.
  //  2. Controlled — parent owns `value: { reasons: string[], note: string }`
  //     and receives changes via `onChange`. Pair with `hideActions` when the
  //     parent has its own outer submit (e.g. UploadChartDrawer's Upload
  //     button already saves everything on click).
  const controlled = value !== undefined;
  const [reasonsInternal, setReasonsInternal] = useState(() => new Set());
  const [commentInternal, setCommentInternal] = useState('');
  const reasons = controlled
    ? new Set(value?.reasons || [])
    : reasonsInternal;
  const comment = controlled ? (value?.note || '') : commentInternal;
  const emit = (nextReasons, nextComment) => {
    if (controlled) {
      onChange?.({
        reasons: FAIL_REASONS.filter(r => nextReasons.has(r)),
        note: nextComment,
      });
    } else {
      setReasonsInternal(nextReasons);
      setCommentInternal(nextComment);
    }
  };
  const toggleReason = (r) => {
    const next = new Set(reasons);
    if (next.has(r)) next.delete(r); else next.add(r);
    emit(next, comment);
  };
  const setComment = (c) => emit(reasons, c);
  // At least one reason is always required. The comment is optional — with
  // one exception: picking "Other" makes it mandatory, since the reviewer
  // owes a specific reason for the downstream reviewer to act on. When
  // required, a red asterisk appears next to the Comment label.
  const commentRequired = reasons.has('Other');
  const canSubmit = reasons.size > 0 && (!commentRequired || comment.trim().length > 0);
  return (
    <div className={styles.failInline} onClick={(e) => e.stopPropagation()}>
      <div className={styles.failBody}>
        <div className={styles.failIntro}>
          Select a reason and add a note to mark document as a failed:
          <span className={styles.failNoteRequired} aria-hidden="true"> *</span>
        </div>
        <div className={styles.failReasons}>
          {FAIL_REASONS.map((r) => {
            const checked = reasons.has(r);
            return (
              <button
                key={r}
                type="button"
                role="checkbox"
                aria-checked={checked}
                aria-label={r}
                className={styles.reasonOption}
                onClick={(e) => { e.stopPropagation(); toggleReason(r); }}
              >
                <Checkbox
                  checked={checked}
                  tabIndex={-1}
                  aria-hidden
                  className="pointer-events-none"
                />
                <span className={styles.reasonLabel}>{r}</span>
              </button>
            );
          })}
        </div>
        <div className={styles.failNoteLabel}>
          Comment
          {commentRequired && <span className={styles.failNoteRequired} aria-hidden="true"> *</span>}
        </div>
        <Textarea
          rows={3}
          placeholder="Add a Comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </div>
      {!hideActions && (
        <div className={styles.failActions}>
          <Button
            variant="danger"
            size="S"
            disabled={!canSubmit}
            onClick={() => onConfirm?.({ reasons: FAIL_REASONS.filter(r => reasons.has(r)), note: comment })}
          >
            Confirm
          </Button>
          <Button variant="secondary" size="S" onClick={onCancel}>Cancel</Button>
        </div>
      )}
    </div>
  );
}

// Inline metadata editor — the doc card's second row when the ⋯ menu's Edit
// item is picked. Only caption + document type are editable (the file
// itself stays put); Save writes through updateChartDocMeta upstream.
export function EditDocInline({ doc, onCancel, onSave }) {
  const [caption, setCaption] = useState(doc?.caption || doc?.n || '');
  const [docType, setDocType] = useState(doc?.t || '');
  const canSave = caption.trim().length > 0 && !!docType;
  return (
    <div className={styles.failInline} onClick={(e) => e.stopPropagation()}>
      <div className={styles.failBody}>
        <div className={styles.failNoteLabel}>Caption</div>
        <input aria-label="Caption"
          type="text"
          className={styles.editInput}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Document caption"
          autoFocus
        />
        <div className={styles.failNoteLabel}>Document Type</div>
        <Select
          className={styles.editSelectTrigger}
          options={DOC_TYPES.map(t => ({ value: t, label: t }))}
          value={docType}
          onChange={setDocType}
          placeholder="Select a type"
        />
      </div>
      <div className={styles.failActions}>
        <Button
          variant="primary"
          size="S"
          disabled={!canSave}
          onClick={() => onSave({ caption: caption.trim(), docType })}
        >
          Save
        </Button>
        <Button variant="secondary" size="S" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

/**
 * Hover tooltip for a doc row's "Failed" badge. Renders the design's
 * "Failed Due to:" card — bulleted reasons + a subtle Comment box — as a
 * portalled popover so it can escape the doc-row + drawer stacking
 * contexts. Falls back to the base badge (no tooltip) when there are no
 * reasons captured (e.g. a legacy fail with no metadata).
 */
export function FailedBadgeWithTooltip({ details }) {
  const badgeRef = useRef(null);
  const openTimer = useRef(null);
  const [rect, setRect] = useState(null);

  const reasons = details?.reasons || [];
  const note = (details?.note || '').trim();
  const hasContent = reasons.length > 0 || note.length > 0;

  const open = () => {
    if (!hasContent) return;
    if (openTimer.current) clearTimeout(openTimer.current);
    openTimer.current = setTimeout(() => {
      const r = badgeRef.current?.getBoundingClientRect();
      if (r) setRect(r);
    }, 120);
  };
  const close = () => {
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
    setRect(null);
  };
  useEffect(() => () => clearTimeout(openTimer.current), []);

  const W = 260;
  const style = rect
    ? { top: rect.bottom + 6, left: Math.min(rect.left, window.innerWidth - W - 8), width: W }
    : null;

  return (
    <>
      <span
        ref={badgeRef}
        className={styles.failedBadge}
        onMouseEnter={open}
        onMouseLeave={close}
        onFocus={open}
        onBlur={close}
        tabIndex={hasContent ? 0 : -1}
      >
        <Icon name="solar:close-circle-linear" size={12} color="var(--status-error)" />
        Failed
      </span>
      {rect && hasContent && createPortal(
        <div
          role="tooltip"
          aria-label="Fail reasons"
          className={styles.failTooltip}
          style={style}
        >
          {reasons.length > 0 && (
            <>
              <div className={styles.failTooltipHeading}>Failed Due to:</div>
              <ul className={styles.failTooltipList}>
                {reasons.map(r => <li key={r}>{r}</li>)}
              </ul>
            </>
          )}
          {note && (
            <div className={styles.failTooltipComment}>Comment: {note}</div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}

/**
 * Comment panel rendered in the left column when the header "Comment" action
 * is toggled on. Composer + timeline read/write the SAME `hccDiagComments`
 * store slice the Diagnosis Gap drawer's Comments tab uses — no separate
 * chart-scoped list, so a comment posted here shows up there and vice-versa.
 * Stamps `dos` from the member's primary DOS (matches DiagPanel's scoping);
 * `icd` is left null because this drawer is chart-level, not ICD-scoped.
 */
export function ChartCommentsPanel({ member }) {
  const comments = useAppStore(s => s.hccDiagComments);
  const addHccDiagComment = useAppStore(s => s.addHccDiagComment);
  const addActivityEntry = useAppStore(s => s.addActivityEntry);
  const currentUserProfile = useAppStore(s => s.currentUserProfile);
  const hccUserRole = useAppStore(s => s.hccUserRole);

  // Show the full comment thread — no per-DOS or per-member filter here.
  // DiagPanel's Comments tab renders every row too, so the two views agree
  // 1:1 (per the sync requirement).
  const visibleComments = comments;

  const addComment = (body) => {
    if (!body) return;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const date = `${pad(now.getMonth() + 1)}/${pad(now.getDate())}/${now.getFullYear()}`;
    const hours = now.getHours();
    const time = `${((hours + 11) % 12) + 1}:${pad(now.getMinutes())} ${hours >= 12 ? 'PM' : 'AM'}`;
    const author = currentUserProfile?.name || 'You';
    const role = hccUserRole || 'Support';
    const dos = member?.dos_list?.[0]?.date || member?.dos || null;
    const row = { id: `c${Date.now()}`, author, role, date, time, body, icd: null, dos };
    addHccDiagComment(row);
    addActivityEntry?.({
      t: 'comment', by: author, role,
      headline: 'Added a Comment',
      details: [{ note: body }],
    });
  };

  return (
    <div className={styles.commentsPanel}>
      <div className={styles.commentsComposerWrap}>
        <CommentComposer onSubmit={addComment} placeholder="Add a comment, use @ to mention someone" />
      </div>
      <div className={styles.commentsList}>
        {visibleComments.length === 0 ? (
          <div className={styles.commentsEmpty}>
            <Icon name="solar:chat-round-linear" size={20} color="var(--neutral-200)" />
            <span>No comments yet. Drop the first one above.</span>
          </div>
        ) : visibleComments.map((c) => (
          <div key={c.id} className={styles.commentRow}>
            <span className={styles.commentAvatar} aria-hidden="true">
              {(c.author || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'}
            </span>
            <div className={styles.commentBubble}>
              <div className={styles.commentMeta}>
                <span className={styles.commentAuthor}>{c.author}</span>
                <span className={styles.commentRole}>({c.role})</span>
                <span className={styles.commentDot} aria-hidden="true">•</span>
                <span className={styles.commentDate}>{c.date} · {c.time}</span>
                {c.edited && <span className={styles.commentEdited}>Edited</span>}
              </div>
              <div className={styles.commentBody}>{c.body}</div>
              {c.icd && (
                <div className={styles.commentScope}>ICD {c.icd}{c.dos ? ` · DOS ${c.dos}` : ''}</div>
              )}
              {!c.icd && c.dos && (
                <div className={styles.commentScope}>DOS {c.dos}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Modal shown when Support picks the record-level "Insufficient" status.
 * Design: white card, centred, close X, multi-select reason checkboxes,
 * optional note (mandatory when "Other" is picked, mirroring the doc-level
 * FailReasonInline rule). Confirm commits the status upstream.
 */
export function InsufficientDosDialog({ onCancel, onConfirm }) {
  const [reasons, setReasons] = useState(() => new Set());
  const [note, setNote] = useState('');
  const toggleReason = (r) => setReasons(prev => {
    const next = new Set(prev);
    if (next.has(r)) next.delete(r); else next.add(r);
    return next;
  });
  const commentRequired = reasons.has('Other');
  const canSubmit = reasons.size > 0 && (!commentRequired || note.trim().length > 0);
  return (
    <AlertDialog open onOpenChange={(open) => { if (!open) onCancel?.(); }}>
      <AlertDialogContent className={`${styles.insufficientDialog} !max-w-[420px]`}>
        <div className={styles.insufficientHeader}>
          <div className={styles.insufficientTitleGroup}>
            <AlertDialogTitle className={styles.insufficientTitle}>
              Mark documents Insufficient
            </AlertDialogTitle>
            <AlertDialogDescription className={styles.insufficientSubtitle}>
              Please select a reason. Adding a note is optional
            </AlertDialogDescription>
          </div>
          <CloseButton size={16} onClick={onCancel} className={styles.insufficientClose} />
        </div>
        <div className={styles.insufficientReasons}>
          {INSUFFICIENT_REASONS.map((r) => {
            const checked = reasons.has(r);
            return (
              <div
                key={r}
                role="checkbox"
                tabIndex={0}
                aria-checked={checked}
                aria-label={r}
                className={styles.reasonOption}
                onClick={() => toggleReason(r)}
                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleReason(r); } }}
              >
                <Checkbox
                  checked={checked}
                  tabIndex={-1}
                  aria-hidden
                  className="pointer-events-none"
                />
                <span className={styles.reasonLabel}>{r}</span>
              </div>
            );
          })}
        </div>
        {commentRequired && (
          <div className={styles.failNoteLabel}>
            Note<span className={styles.failNoteRequired} aria-hidden="true"> *</span>
          </div>
        )}
        <Textarea
          rows={2}
          placeholder={commentRequired ? 'Add a note explaining "Other"' : 'Add a note (optional)'}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className={styles.insufficientActions}>
          <Button
            variant="danger"
            size="S"
            disabled={!canSubmit}
            onClick={() => onConfirm({ reasons: INSUFFICIENT_REASONS.filter(r => reasons.has(r)), note })}
          >
            Confirm
          </Button>
          <Button variant="secondary" size="S" onClick={onCancel}>Cancel</Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
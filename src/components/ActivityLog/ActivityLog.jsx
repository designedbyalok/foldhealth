import { useMemo, useState } from 'react';
import { Icon } from '../Icon/Icon';
import { DownChevronIcon } from '../Icon/DownChevronIcon';
import { Badge } from '../Badge/Badge';
import { Tooltip } from '../Tooltip/Tooltip';
import { Avatar } from '../Avatar/Avatar';
import { PriorityIcon } from '../PriorityIcon/PriorityIcon';
import { useAppStore } from '../../store/useAppStore';
import { ActionButton } from '../ActionButton/ActionButton';
import { MenuPopover } from '../MenuPopover/MenuPopover';
import { CommentComposer } from '../CommentComposer/CommentComposer';
import {
  AvatarPill,
  ACT_ICON,
  TRANS_BADGE,
  historyTimelineStyles as htStyles,
} from '../HistoryTimeline/HistoryTimeline';
import styles from './ActivityLog.module.css';

// Render a comment body with the signed-in user's @-mentions painted in the
// mention style (secondary-300, weight 500). Other users' mentions stay
// plain text — highlighting them here would compete visually with the row's
// primary meaning. Match is case-insensitive so `@fold demo` still fires
// when the account name is `Fold Demo`.
function renderCommentBodyWithMentions(text, meName) {
  if (!text) return null;
  if (!meName) return text;
  // Same shape as the extraction regex in TaskDetailDrawer.handleAddComment —
  // `@` followed by one or two whitespace-separated word groups.
  const re = /@(\w+(?:\s+\w+)?)/g;
  const meLower = meName.toLowerCase();
  const parts = [];
  let last = 0;
  let match;
  let idx = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const label = match[1];
    if (label.toLowerCase() === meLower) {
      parts.push(
        <span key={`m-${idx++}`} style={{ fontWeight: 500, color: 'var(--secondary-300)' }}>@{label}</span>,
      );
    } else {
      parts.push(match[0]);
    }
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// Icon config per entry type — reuses HCC's ACT_ICON (colored rail bubble)
// so ActivityLog matches the DiagPanel timeline visually. Types unique to
// this surface (call/sms, note/clinical_note, task, appointment, …) get
// their own routing here.
const TYPE_ICON = {
  outreach:        { icon: 'solar:phone-linear',            color: 'var(--secondary-300)', bg: 'var(--secondary-100)',        border: 'rgba(244,122,62,0.2)' },
  call:            { icon: 'solar:phone-linear',            color: 'var(--secondary-300)', bg: 'var(--secondary-100)',        border: 'rgba(244,122,62,0.2)' },
  sms:             { icon: 'solar:chat-round-line-linear',  color: 'var(--secondary-300)', bg: 'var(--secondary-100)',        border: 'rgba(244,122,62,0.2)' },
  status_dos:      ACT_ICON.status_dos,
  status_change:   ACT_ICON.status_dos,
  status_hcc:      ACT_ICON.status_hcc,
  status_role:     ACT_ICON.status_role,
  accept:          ACT_ICON.accept,
  dismiss:         ACT_ICON.dismiss,
  delete:          ACT_ICON.delete,
  upload:          ACT_ICON.upload,
  document:        ACT_ICON.upload,
  create:          ACT_ICON.create,
  override:        ACT_ICON.override,
  comment:         ACT_ICON.comment,
  assign_coder:    ACT_ICON.assign_coder,
  assignee_change: ACT_ICON.assign_coder,
  note:            { icon: 'solar:notes-linear',            color: 'var(--primary-300)',    bg: 'var(--primary-50)',           border: 'rgba(107,68,168,0.2)' },
  clinical_note:   { icon: 'solar:notes-linear',            color: 'var(--primary-300)',    bg: 'var(--primary-50)',           border: 'rgba(107,68,168,0.2)' },
  task:            { icon: 'solar:clipboard-check-linear',  color: 'var(--primary-300)',    bg: 'var(--primary-50)',           border: 'rgba(107,68,168,0.2)' },
  reminder:        { icon: 'solar:bell-linear',             color: 'var(--status-warning)', bg: 'var(--status-warning-light)', border: 'rgba(217,165,11,0.2)' },
  appointment:     { icon: 'solar:calendar-linear',         color: 'var(--primary-300)',    bg: 'var(--primary-50)',           border: 'rgba(107,68,168,0.2)' },
  referral:        { icon: 'solar:square-share-line-linear', tileClass: 'referralTile' },
};
const DEFAULT_ICON = { icon: 'solar:document-text-linear', color: 'var(--neutral-300)', bg: 'var(--neutral-0)', border: 'var(--neutral-150)' };

// Status label → Badge tone. HEDIS canonical status grouping drives the
// color band: Open → primary (Not Started); Engaged / Submitted → warning
// (In Progress); Completed → success (Done); Closed - * → grey. HCC-only
// labels (Accepted / Dismissed / Audited / Returned / …) share the same
// map so both worklists render identical status pills. Unknown falls to
// 'grey'.
const STATUS_TONE = {
  Open:                          'primary',
  Audited:                       'primary',
  Engaged:                       'warning',
  'Engaged Requires Follow-Up':  'warning',
  Submitted:                     'warning',
  'In Progress':                 'warning',
  New:                           'warning',
  Pending:                       'warning',
  'Pending Review':              'warning',
  'Record Requested':            'warning',
  'Record Received':             'warning',
  Completed:                     'success',
  Signed:                        'success',
  Accepted:                      'success',
  Met:                           'success',
  'On Hold':                     'error',
  'Not Met':                     'error',
  Draft:                         'grey',
  Dismissed:                     'error',
  Returned:                      'warning',
  Rebuttal:                      'secondary',
  Rejected:                      'error',
  'Closed - Do not call':        'grey',
  'Closed - UTR':                'grey',
  'Closed - Other':              'grey',
  Deleted:                       'grey',
  None:                          'grey',
};
const statusTone = (label) => STATUS_TONE[label] || 'grey';

/**
 * Shared per-record activity feed.
 *
 * Entries are either group headers (`{ t: 'group', label }`) or log entries.
 * `t` selects which variant renders — outreach entries get the full
 * OutreachTab card treatment (with call details + transcript); status
 * changes render just the transition pills; clinical notes and tasks render
 * a nested "View Details" card; comments render as an inline paragraph;
 * uploads render the HCC attachment file card; assignee changes render a
 * from → to avatar transition.
 */
/**
 * Entries are `{ t, … }` objects; `{ t: 'group', label, badge? }` starts a
 * collapsible section. An entry may override its rail with `avatar` (node) or
 * `icon` / `iconBg` / `iconBorder` / `iconColor`, and may replace its body
 * entirely with `render(entry)`.
 */
// A Draft note entry is superseded once a LATER entry submits or signs a
// note covering any of the same gaps (or the same note). Consolidated notes
// bundle several gaps' drafts, so matching on the note id alone would leave
// the other gaps' drafts looking editable. `_draftLock` is 'signed' or
// 'submitted' and drives ClinicalNoteCardActions' disabled pencil.
function markSupersededDrafts(list) {
  const timeOf = (e) => new Date(e.when ?? e.at ?? 0).getTime() || 0;
  const codesOf = (dc) => (dc?.gapCodes?.length ? dc.gapCodes : (dc?.gapCode ? [dc.gapCode] : []));
  const finals = list.filter(e => e.detailCard && (e.detailCard.status === 'Pending Review' || e.detailCard.status === 'Signed'));
  if (!finals.length) return list;
  return list.map(e => {
    const dc = e.detailCard;
    if (!dc || dc.status !== 'Draft') return e;
    const at = timeOf(e);
    const codes = codesOf(dc);
    const later = finals.filter(f => timeOf(f) > at && (
      (dc.noteId && f.detailCard.noteId === dc.noteId)
      || codesOf(f.detailCard).some(c => codes.includes(c))
    ));
    if (!later.length) return e;
    return { ...e, _draftLock: later.some(f => f.detailCard.status === 'Signed') ? 'signed' : 'submitted' };
  });
}

export function ActivityLog({ entries, emptyLabel = 'No activity recorded yet.', hideCommentTitle = false, onOpenTask, onOpenNote }) {
  const [collapsed, setCollapsed] = useState(() => new Set());
  const toggleGroup = (label) => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(label)) next.delete(label); else next.add(label);
    return next;
  });

  const list = useMemo(() => markSupersededDrafts(entries || []), [entries]);
  const hasItems = list.some(e => e.t !== 'group');
  if (!hasItems) {
    return (
      <div className={styles.empty}>
        <Icon name="solar:history-linear" size={32} color="var(--neutral-200)" />
        <p>{emptyLabel}</p>
      </div>
    );
  }

  // Flatten to render list — mark the first/last item in each visible
  // group so the icon rail can drop its top/bottom connectors, matching
  // the HCC timeline's continuous-line look.
  const items = (() => {
    let activeGroup = null;
    const out = [];
    list.forEach((entry, i) => {
      if (entry.t === 'group') {
        activeGroup = entry.label;
        out.push({ kind: 'group', entry, key: `g${i}` });
        return;
      }
      if (activeGroup && collapsed.has(activeGroup)) return;
      out.push({ kind: 'item', entry, key: `i${i}`, isFirst: false, isLast: false });
    });
    const allItems = out.filter(it => it.kind === 'item');
    if (allItems.length) {
      allItems[0].isFirst = true;
      allItems[allItems.length - 1].isLast = true;
    }
    return out;
  })();

  return (
    <div className={htStyles.wrap}>
      {items.map(it => it.kind === 'group' ? (
        <button
          key={it.key}
          type="button"
          className={`${styles.group} ${collapsed.has(it.entry.label) ? styles.groupCollapsed : ''}`}
          onClick={() => toggleGroup(it.entry.label)}
          aria-expanded={!collapsed.has(it.entry.label)}
        >
          <span>{it.entry.label}</span>
          <span className={styles.groupChevron}>
            <DownChevronIcon size={12} color="var(--neutral-400)" />
          </span>
        </button>
      ) : (
        <ActivityLogEntry
          key={it.key}
          entry={it.entry}
          isFirst={it.isFirst}
          isLast={it.isLast}
          hideCommentTitle={hideCommentTitle}
          onOpenTask={onOpenTask}
          onOpenNote={onOpenNote}
        />
      ))}
    </div>
  );
}

// A Badge tone and an Avatar variant name the same five states; grey is the
// avatar's neutral "others".
const TONE_TO_VARIANT = {
  success: 'success',
  error: 'error',
  warning: 'warning',
  primary: 'primary',
  grey: 'others',
};

// An entry that records how something went paints its tile accordingly.
function railVariantFor(entry) {
  // A status change wears the colour of the status it moved to, so the tile
  // and the badge beside it agree.
  if (entry.to) return TONE_TO_VARIANT[statusTone(entry.to)] || 'others';
  // Accepting a code is a success; dismissing or deleting one is not.
  if (entry.t === 'accept') return 'success';
  if (entry.t === 'dismiss' || entry.t === 'delete') return 'error';
  // Outreach and friends carry their result in the outcome's own colour, the
  // same signal the Outreach tab reads.
  const hint = `${entry.outcomeColor || ''} ${entry.statusTone || ''}`.toLowerCase();
  if (hint.includes('success')) return 'success';
  if (hint.includes('error')) return 'error';
  return 'others';
}

/* ── Rail (shared) ───────────────────────────────────────────────────── */
function Rail({ entry, isFirst, isLast }) {
  const cfg = TYPE_ICON[entry.t] || DEFAULT_ICON;
  return (
    <div className={htStyles.rail}>
      <span className={[htStyles.connectorTop, isFirst ? htStyles.connectorTopFirst : ''].filter(Boolean).join(' ')} />
      {/* `avatar` swaps the tile wholesale; otherwise every entry uses the
          design system's own icon avatar at size S. */}
      {entry.avatar || (
        <Avatar
          type="icon"
          variant={entry.avatarVariant || railVariantFor(entry)}
          size="S"
          iconName={entry.icon || cfg.icon}
          className={cfg.tileClass ? styles[cfg.tileClass] : undefined}
        />
      )}
      <span className={[htStyles.connectorBottom, isLast ? htStyles.connectorBottomLast : ''].filter(Boolean).join(' ')} />
    </div>
  );
}

/* ── Meta line (shared across variants) ──────────────────────────────── */
export function MetaLine({ entry }) {
  const parts = [
    entry.date,
    entry.time,
    entry.by ? `${entry.by}${entry.role ? ` (${entry.role})` : ''}` : null,
    entry.dos ? `DOS (${entry.dos})` : null,
  ].filter(Boolean);
  return <div className={htStyles.meta}>{parts.join(' • ')}</div>;
}

/**
 * ViewMoreButton — the shared expand trigger. Hidden until the row is
 * hovered or focused, pinned once open. Exported so a `render` body uses the
 * same affordance as the built-in variants.
 */
export function ViewMoreButton({ expanded, onToggle, label = 'View more', leadingDot = false }) {
  return (
    <button
      type="button"
      className={`${styles.viewMoreBtn} ${expanded ? styles.viewMoreBtnOpen : ''}`}
      onClick={onToggle}
    >
      {leadingDot && <span className={styles.viewNoteDot} aria-hidden="true">•</span>}
      {label}
      <DownChevronIcon size={11} color="currentColor" className={expanded ? styles.viewMoreChevronOpen : undefined} />
    </button>
  );
}

/* ── Type-branched entry ─────────────────────────────────────────────── */
function ActivityLogEntry({ entry, isFirst, isLast, hideCommentTitle = false, onOpenTask, onOpenNote }) {
  return (
    <div className={htStyles.row}>
      <Rail entry={entry} isFirst={isFirst} isLast={isLast} />
      <div className={[htStyles.body, isFirst ? htStyles.bodyFirst : '', isLast ? htStyles.bodyLast : ''].join(' ')}>
        {(() => {
          // Escape hatch for surfaces whose entry shape none of the built-in
          // variants covers (e.g. Care Plan History's version cards).
          if (typeof entry.render === 'function') return entry.render(entry);
          switch (entry.t) {
            case 'outreach':
            case 'call':
            case 'sms':
              return <OutreachEntryBody entry={entry} />;
            case 'status_change':
            case 'status_dos':
              return <StatusChangeEntryBody entry={entry} />;
            case 'clinical_note':
            case 'note':
              return <DetailCardEntryBody entry={entry} variant="note" onOpenTask={onOpenTask} onOpenNote={onOpenNote} />;
            case 'task':
              return <DetailCardEntryBody entry={entry} variant="task" onOpenTask={onOpenTask} />;
            case 'appointment':
              return <DetailCardEntryBody entry={entry} variant="appointment" />;
            case 'referral':
              return <ReferralEntryBody entry={entry} />;
            case 'assign_coder':
            case 'assignee_change':
              return <AssigneeChangeEntryBody entry={entry} />;
            case 'upload':
            case 'document':
              return <UploadEntryBody entry={entry} />;
            case 'comment':
              return <CommentEntryBody entry={entry} hideTitle={hideCommentTitle} />;
            default:
              return <GenericEntryBody entry={entry} />;
          }
        })()}
      </div>
    </div>
  );
}

/* ── Variant: Outreach (OutreachTab.LogEntry) ────────────────────────── */
function OutreachEntryBody({ entry }) {
  const [expanded, setExpanded] = useState(false);
  const hasNote = Boolean(entry.note && entry.note.trim());
  const hasCall = !!entry.callDetails;
  const expandable = hasNote || hasCall;

  return (
    <>
      <MetaLine entry={entry} />
      <div className={htStyles.headlineRow}>
        <span className={htStyles.headline}>{entry.title}</span>
        {(entry.badges || []).map(b => <Badge key={b} tone="primary" size="M" label={b} />)}
      </div>
      <div className={styles.outcomeRow}>
        {entry.outcome && (
          <span className={styles.outcome} style={entry.outcomeColor ? { color: entry.outcomeColor } : undefined}>
            {entry.outcome}
          </span>
        )}
        {expandable && (
          <button
            type="button"
            className={`${styles.viewMoreBtn} ${expanded ? styles.viewMoreBtnOpen : ''}`}
            onClick={() => setExpanded(v => !v)}
          >
            {entry.outcome && <span className={styles.viewNoteDot} aria-hidden="true">•</span>}
            View more
            <DownChevronIcon size={11} color="currentColor" className={expanded ? styles.viewMoreChevronOpen : undefined} />
          </button>
        )}
      </div>

      {expanded && (hasCall || hasNote) && (
        <div className={styles.expandedCard}>
          {hasCall && (
            <>
              <div className={styles.expandedLabel}>Call Details:</div>
              <div className={styles.expandedMeta}>
                via: <strong>{entry.callDetails.via}</strong>
                <span className={styles.expandedMetaDot}>·</span>
                To: <strong>{entry.callDetails.to}</strong>
                <span className={styles.expandedMetaDot}>·</span>
                Duration: <strong>{entry.callDetails.durationMin}mins</strong>
              </div>
              {(hasNote || (Array.isArray(entry.callDetails.transcript) && entry.callDetails.transcript.length > 0)) && (
                <div className={styles.expandedNoteLabel}>Note :</div>
              )}
              {Array.isArray(entry.callDetails.transcript) && entry.callDetails.transcript.length > 0 && (
                <div className={styles.transcriptCard}>
                  <div className={styles.transcriptCaption}>Call Transcript</div>
                  {entry.callDetails.transcript.slice(0, 2).map((t, i) => (
                    <div key={i} className={styles.transcriptLine}>
                      <div>{t.speaker} - {t.t}</div>
                      <div>{t.text}</div>
                    </div>
                  ))}
                  {entry.callDetails.transcript.length > 2 && (
                    <div className={styles.transcriptMore}>
                      Show More
                      <Icon name="solar:alt-arrow-down-linear" size={11} color="var(--primary-300)" />
                    </div>
                  )}
                </div>
              )}
              {hasNote && <p className={styles.expandedNote}>{entry.note}</p>}
              <div className={styles.expandedActions}>
                {entry.callDetails.recordingUrl && (
                  <button type="button" className={styles.expandedAction}>
                    <Icon name="solar:play-circle-linear" size={13} color="var(--neutral-400)" />
                    Call Recording
                  </button>
                )}
                {entry.callDetails.transcriptUrl && (
                  <button type="button" className={styles.expandedAction}>
                    <Icon name="solar:document-text-linear" size={13} color="var(--neutral-400)" />
                    Transcript
                  </button>
                )}
              </div>
            </>
          )}
          {!hasCall && hasNote && (
            <>
              <div className={styles.expandedNoteLabel}>Note :</div>
              <p className={styles.expandedNote}>{entry.note}</p>
            </>
          )}
        </div>
      )}
    </>
  );
}

/* ── Variant: Status Change (transition pills) ──────────────────────── */
function StatusChangeEntryBody({ entry }) {
  return (
    <>
      <MetaLine entry={entry} />
      <div className={htStyles.headlineRow}>
        <span className={htStyles.headline}>{entry.title || 'Status Changed'}</span>
      </div>
      {entry.from && entry.to && (
        <div className={htStyles.transition}>
          <Badge size="S" tone={statusTone(entry.from)} label={entry.from} />
          <Icon name="solar:arrow-right-linear" size={12} color="var(--neutral-300)" />
          <Badge size="S" tone={statusTone(entry.to)} label={entry.to} />
        </div>
      )}
    </>
  );
}

/* ── Variant: Clinical note / Task / Appointment (nested detail card) ─ */
function DetailCardEntryBody({ entry, variant, onOpenTask, onOpenNote }) {
  const [expanded, setExpanded] = useState(true);
  const dc = entry.detailCard;
  const expandable = !!dc;
  const allTasks = useAppStore(s => s.tasks);
  const taskPriority = dc?.priority
    || (dc?.taskId && allTasks?.find(t => t.id === dc.taskId)?.priority)
    || (variant === 'task' ? 'medium' : 'none');

  return (
    <>
      <MetaLine entry={entry} />
      <div className={htStyles.headlineRow}>
        <span className={htStyles.headline}>{entry.title}</span>
        {expandable && (
          <button
            type="button"
            className={`${styles.viewMoreBtn} ${expanded ? styles.viewMoreBtnOpen : ''}`}
            onClick={() => setExpanded(v => !v)}
          >
            <span className={styles.viewNoteDot} aria-hidden="true">•</span>
            View more
            <DownChevronIcon size={11} color="currentColor" className={expanded ? styles.viewMoreChevronOpen : undefined} />
          </button>
        )}
      </div>
      {expanded && dc && (
        <div className={styles.detailCard}>
          {variant === 'task' ? (
            <div className={styles.detailCardRow}>
              <PriorityIcon priority={taskPriority} size={16} />
              <div className={styles.detailCardText}>
                <span className={styles.detailCardTitle}>{dc.title}</span>
                {dc.assignee && (
                  <div className={styles.detailCardSubtitle}>Assignee: {dc.assignee}</div>
                )}
              </div>
              <div className={styles.detailCardTrailing}>
                {dc.status && <Badge tone={statusTone(dc.status)} size="M" label={dc.status} />}
                <span className={styles.detailCardActionsDivider} aria-hidden="true" />
                <button
                  type="button"
                  className={styles.detailCardIconBtn}
                  aria-label="Preview task"
                  onClick={dc.taskId && onOpenTask ? () => onOpenTask(dc.taskId) : undefined}
                  style={dc.taskId && onOpenTask ? undefined : { cursor: 'default' }}
                >
                  <Icon name="solar:eye-linear" size={14} color="var(--neutral-400)" />
                </button>
              </div>
            </div>
          ) : variant === 'appointment' ? (
            // Figma 1230:74055 — leading calendar icon + title over a
            // "date, time · provider" subtitle, trailing status badge and
            // an arrow-out icon that later opens the appointment drawer.
            <div className={styles.detailCardRow}>
              <span className={styles.detailCardHandle}>
                <Icon name="solar:calendar-linear" size={16} color="var(--neutral-300)" />
              </span>
              <div className={styles.detailCardText}>
                <div className={styles.detailCardTitleRow}>
                  <span className={styles.detailCardTitle}>{dc.title}</span>
                </div>
                {dc.subtitle && (
                  <div className={styles.detailCardSubtitle}>{dc.subtitle}</div>
                )}
              </div>
              <div className={styles.detailCardTrailing}>
                {dc.status && <Badge tone={statusTone(dc.status)} size="M" label={dc.status} />}
                <button type="button" className={styles.detailCardIconBtn} aria-label="Open">
                  <Icon name="solar:arrow-right-up-linear" size={14} color="var(--neutral-400)" />
                </button>
              </div>
            </div>
          ) : (
            <ClinicalNoteCardActions dc={dc} draftLock={entry._draftLock} onOpenTask={onOpenTask} onOpenNote={onOpenNote} />
          )}
        </div>
      )}
    </>
  );
}

/* Note-variant card body — the shared Clinical Note affordance. Extracted
   so the eye / edit / task-arrow buttons can hook into the store's task
   opener and PDF viewer instead of being visual-only. Exported so the
   HEDIS Clinical Notes tab can render the same card without the
   ActivityLog's timeline rail. */
// Derive the nested review-task's title from the parent note's title so
// old activity entries (persisted before we started stamping the correct
// per-gap name) render consistently with new ones. Falls back to whatever
// the store stamped originally, then to a safe default.
function deriveReviewTaskTitle(dc) {
  if (dc?.title) return `Request for Sign-off - ${dc.title}`;
  return dc?.reviewTask?.title || 'Request for Sign-off - Clinical Note';
}

export function ClinicalNoteCardActions({ dc, draftLock = null, onOpenTask, onOpenNote }) {
  // Prefer the caller-provided `onOpenTask` (drawer wires the upstream
  // openTaskFromActivity signal — that's the fix from 3e0aa74 that stamps
  // pendingOpenTaskId for TasksView). Fall back to openTaskFromNotification
  // for surfaces without a specific handler.
  const openTaskFromNotification = useAppStore(s => s.openTaskFromNotification);
  const allTasks = useAppStore(s => s.tasks);
  // Each activity entry represents an event at a point in time, so the
  // status badge here mirrors the state the event captured (submit →
  // Pending Review, sign → Signed). A separate "Clinical Note Signed"
  // entry logs at sign-time, so both events remain visible in order.
  const noteStatus = dc?.status;
  // The note as it is NOW (clinical_notes), found by the id the entry saved.
  // A Draft entry stays a historical record, but once that note has been
  // submitted or signed its pencil is locked: the draft is no longer the
  // editable version. Entries logged before noteId was stored fall back to
  // the member's note for the same gap.
  const memberNotes = useAppStore(s => (dc?.memberId ? s.clinicalNotesByMember?.[dc.memberId] : undefined));
  const entryCodes = dc?.gapCodes?.length ? dc.gapCodes : (dc?.gapCode ? [dc.gapCode] : []);
  const liveNote = dc?.noteId
    ? memberNotes?.find(n => n.id === dc.noteId)
    : memberNotes?.find(n => (n.gapCodes || []).some(c => entryCodes.includes(c)));
  const liveStatus = liveNote?.status;
  const draftLocked = noteStatus === 'Draft' && (!!draftLock || (!!liveStatus && liveStatus !== 'draft'));
  const lockReason = (draftLock === 'signed' || liveStatus === 'signed')
    ? 'This note has been signed, so this draft can no longer be edited.'
    : 'This note was submitted for review, so this draft can no longer be edited.';
  const reviewTaskStatus = dc?.reviewTask?.status;
  const reviewTaskPriority = dc?.reviewTask?.priority
    || (dc?.reviewTask?.taskId && allTasks?.find(t => t.id === dc.reviewTask.taskId)?.priority)
    || 'medium';
  const openTask = (taskId) => (onOpenTask ? onOpenTask(taskId) : openTaskFromNotification?.(taskId));
  // `onOpenNote` gets the whole detailCard so the drawer can reopen the
  // note in its left workspace (matches "Add Note") — used by the eye
  // affordance so authors can edit their submission before it's signed.
  const openNote = (dcArg) => onOpenNote?.(dcArg);
  const openClinicalNoteDrawer = useAppStore(s => s.openClinicalNoteDrawer);
  const showToast = useAppStore(s => s.showToast);
  // Draft rows key on the pencil, which reopens the note (edit path).
  // Submitted / Signed rows key on the eye — for a Pending Review note we
  // reopen the linked sign-off task so the reviewer lands back in the
  // ClinicalNotePanel with the exact same fields they filled out,
  // matching Figma 511:105429. Signed notes without a review task fall
  // back to the stored PDF dataUrl.
  const handlePrimary = () => {
    // Eye (Preview / edit re-submission) and pencil (Draft edit) both open
    // the note back in its own workspace via onOpenNote. That gives the
    // submitter a chance to amend before the reviewer signs; the reviewer
    // still uses the task-arrow ↗ button to reach the sign-off task.
    if (onOpenNote) {
      onOpenNote(dc);
      return;
    }
    if (dc.status === 'Draft' && openClinicalNoteDrawer && dc.memberId && dc.gapCode) {
      openClinicalNoteDrawer({ memberId: dc.memberId, gapCode: dc.gapCode });
      return;
    }
    if (dc.pdfDataUrl) {
      try {
        const w = window.open(dc.pdfDataUrl, '_blank');
        w?.focus?.();
      } catch (_) { /* popup blocker */ }
    } else {
      showToast?.('Reopen note — coming soon');
    }
  };
  const handleOpenTask = () => {
    if (dc.reviewTask?.taskId) openTask(dc.reviewTask.taskId);
    else showToast?.('No linked review task.');
  };
  return (
    <>
      {/* subMeta (pre-title form-type label) and the "Linked Score Groups"
           link are no longer part of the note-card design — dropped at the
           render layer so historical entries with those fields still
           persisted don't show them. */}
      <div className={styles.detailCardRow}>
        <div className={styles.detailCardText}>
          <div className={styles.detailCardTitleRow}>
            <span className={styles.detailCardTitle}>{dc.title}</span>
            {dc.chip && (
              // Wrap in a Tooltip so hover reveals the exact set of gaps
              // the note bundles — prefer human-readable HEDIS measure
              // names (dc.gapNames) e.g. "Colorectal Cancer Screening,
              // Breast Cancer Screening"; fall back to raw codes for
              // older activity entries.
              (dc.gapNames?.length || dc.gapCodes?.length) ? (
                <Tooltip label={(dc.gapNames || dc.gapCodes).join(', ')}>
                  <Badge tone="grey" size="S" label={dc.chip} />
                </Tooltip>
              ) : (
                <Badge tone="grey" size="S" label={dc.chip} />
              )
            )}
          </div>
          {dc.subtitle && <div className={styles.detailCardSubtitle}>{dc.subtitle}</div>}
        </div>
        <div className={styles.detailCardTrailing}>
          <span className={styles.detailCardStatusSlot}>
            {noteStatus && <Badge tone={statusTone(noteStatus)} size="M" label={noteStatus} />}
          </span>
          <span className={styles.detailCardActionsSlot}>
            <Tooltip label={draftLocked ? lockReason : null} maxWidth={240}>
              <button
                type="button"
                className={styles.detailCardIconBtn}
                aria-label={noteStatus === 'Draft' ? 'Edit' : 'Preview'}
                onClick={draftLocked ? undefined : handlePrimary}
                disabled={draftLocked}
              >
                <Icon
                  name={noteStatus === 'Draft' ? 'solar:pen-linear' : 'solar:eye-linear'}
                  size={14}
                  color="var(--neutral-300)"
                />
              </button>
            </Tooltip>
            <span className={styles.detailCardActionsDivider} aria-hidden="true" />
            <button type="button" className={styles.detailCardIconBtn} aria-label="More">
              <Icon name="solar:menu-dots-linear" size={14} color="var(--neutral-300)" />
            </button>
          </span>
        </div>
      </div>
      {dc.reviewTask && (
        <div className={styles.detailCardNested}>
          <PriorityIcon priority={reviewTaskPriority} size={16} />
          <div className={styles.detailCardText}>
            <span className={styles.detailCardTitle}>{deriveReviewTaskTitle(dc)}</span>
            {dc.reviewTask.assignee && (
              <div className={styles.detailCardSubtitle}>Assignee: {dc.reviewTask.assignee}</div>
            )}
          </div>
          <div className={styles.detailCardTrailing}>
            {reviewTaskStatus && <Badge tone={statusTone(reviewTaskStatus)} size="M" label={reviewTaskStatus} />}
            <span className={styles.detailCardActionsDivider} aria-hidden="true" />
            <button type="button" className={styles.detailCardIconBtn} aria-label="Preview task" onClick={handleOpenTask}>
              <Icon name="solar:eye-linear" size={14} color="var(--neutral-400)" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Variant: Assignee change (avatar-transition pills) ──────────────── */
function assigneeInitials(a) {
  if (!a) return '';
  return a.initials || '';
}

function AssigneeChangeEntryBody({ entry }) {
  const fromA = entry.fromAssignee;
  const toA   = entry.toAssignee;
  return (
    <>
      <MetaLine entry={entry} />
      <div className={htStyles.headlineRow}>
        <span className={htStyles.headline}>{entry.title || 'Assignee Changed'}</span>
      </div>
      {(fromA || toA) && (
        <div className={htStyles.avatarTransition}>
          {fromA
            ? <AvatarPill initials={assigneeInitials(fromA)} name={fromA.name} />
            : <UnassignedPill />}
          <Icon name="solar:arrow-right-linear" size={12} color="var(--neutral-300)" />
          {toA
            ? <AvatarPill initials={assigneeInitials(toA)} name={toA.name} />
            : <UnassignedPill />}
        </div>
      )}
    </>
  );
}

// Mirrors AvatarPill's chrome but seats an "Unassigned" glyph in the
// avatar slot so a "Unassigned → Alok" transition still reads as a chip
// pair rather than a bare arrow.
function UnassignedPill() {
  return (
    <span className={htStyles.avatarPill}>
      <Avatar variant="others" size="XS" iconName="solar:user-linear" type="icon" />
      <span className={htStyles.avatarName}>Unassigned</span>
    </span>
  );
}

/* ── Variant: Upload / Document (HCC attachment card) ────────────────── */
function UploadEntryBody({ entry }) {
  return (
    <>
      <MetaLine entry={entry} />
      <div className={htStyles.headlineRow}>
        <span className={htStyles.headline}>{entry.title}</span>
      </div>
      {entry.file && (
        <div className={htStyles.attachment}>
          <span className={htStyles.fileBubble}>
            <Icon name="solar:file-text-linear" size={14} color="var(--neutral-300)" />
          </span>
          <div className={htStyles.fileText}>
            <div className={htStyles.fileName}>{entry.file}</div>
            {entry.fileType && <div className={htStyles.fileType}>{entry.fileType}</div>}
          </div>
          <button type="button" className={htStyles.filePreview} aria-label="Preview">
            <Icon name="solar:eye-linear" size={14} color="var(--neutral-300)" />
          </button>
        </div>
      )}
    </>
  );
}

/* ── Variant: Comment (inline paragraph) ─────────────────────────────── */
/* `hideTitle` drops the "…added a Comment" line when the caller already
   scopes the log to comments only (e.g. the Comments tab), since the
   title just restates what the surface already implies. */
// Comments can be editable: the host passes `onEditComment(text, mentions)`
// / `onDeleteComment()` on the entry (only for the author's own comments)
// and an optional `mentionUsers` roster for the edit composer.
function CommentEntryBody({ entry, hideTitle = false }) {
  const meName = useAppStore(s => s.currentUserProfile?.name);
  const [editing, setEditing] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const canManage = !!(entry.onEditComment || entry.onDeleteComment);
  return (
    <div className={styles.commentEntry}>
      <div className={styles.commentMetaRow}>
        <div className={styles.commentMetaText}>
          <MetaLine entry={entry} />
          {entry.edited && <span className={styles.commentEdited}>• Edited</span>}
        </div>
        {canManage && !editing && (
          <span className={[styles.commentMenu, menuAnchor ? styles.commentMenuOpen : ''].filter(Boolean).join(' ')}>
            <ActionButton
              icon="solar:menu-dots-linear"
              size="S"
              tooltip="Comment actions"
              onClick={(e) => setMenuAnchor(e.currentTarget.getBoundingClientRect())}
            />
          </span>
        )}
      </div>
      {!hideTitle && (
        <div className={htStyles.headlineRow}>
          <span className={htStyles.headline}>{entry.title || 'Added a Comment'}</span>
        </div>
      )}
      {editing ? (
        <div className={styles.commentEditor}>
          <CommentComposer
            autoFocus
            users={entry.mentionUsers}
            initialValue={entry.commentBody || ''}
            submitLabel="Save"
            cancelLabel="Cancel"
            onSubmit={(text, mentions) => { entry.onEditComment?.(text, mentions); setEditing(false); }}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : entry.commentBody && (
        <div className={styles.commentBody}>
          {renderCommentBodyWithMentions(entry.commentBody, meName)}
        </div>
      )}
      {menuAnchor && (
        <MenuPopover
          anchorRect={menuAnchor}
          width={168}
          align="right"
          items={[
            ...(entry.onEditComment ? [{ key: 'edit', icon: 'solar:pen-linear', label: 'Edit' }] : []),
            ...(entry.onDeleteComment ? [{ key: 'delete', icon: 'solar:trash-bin-2-linear', label: 'Delete', danger: true }] : []),
          ]}
          onClose={() => setMenuAnchor(null)}
          onSelect={(key) => {
            setMenuAnchor(null);
            if (key === 'edit') setEditing(true);
            else if (key === 'delete') entry.onDeleteComment?.();
          }}
        />
      )}
    </div>
  );
}

/* ── Variant: Referral (Figma New Care Gap Workflow 1327:419983) ─────── */
// Sender (name + role) → recipient (name, Fold Provider badge, specialty •
// channel contact), then "Created on : date • status". The menu reopens a
// still-draft referral, or opens a sent Email referral in Messages > Email.
function ReferralEntryBody({ entry }) {
  const [expanded, setExpanded] = useState(true);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const setActivePage = useAppStore(s => s.setActivePage);
  const setPendingEmailReferralId = useAppStore(s => s.setPendingEmailReferralId);
  const dc = entry.detailCard || {};
  const created = dc.createdAt ? new Date(dc.createdAt) : null;
  const createdLabel = created && !Number.isNaN(created.getTime())
    ? `${String(created.getMonth() + 1).padStart(2, '0')}/${String(created.getDate()).padStart(2, '0')}/${created.getFullYear()}, ${created.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
    : '';
  const isDraft = dc.status === 'Draft';
  const menuItems = [
    ...(entry.onOpenReferralDraft ? [{ key: 'continue-draft', icon: 'solar:pen-linear', label: 'Continue Draft' }] : []),
    ...(!isDraft && dc.channel === 'email' && dc.referralId ? [{ key: 'view-email', icon: 'solar:letter-linear', label: 'View Email' }] : []),
  ];

  return (
    <>
      <MetaLine entry={entry} />
      <div className={htStyles.headlineRow}>
        <span className={htStyles.headline}>{entry.title}</span>
        <ViewMoreButton expanded={expanded} onToggle={() => setExpanded(v => !v)} leadingDot />
      </div>
      {expanded && (
        <div className={[styles.detailCard, styles.referralCard].join(' ')}>
          <div className={styles.referralMain}>
            <div className={styles.referralParties}>
              <div className={styles.referralParty}>
                <span className={styles.referralName}>{dc.fromName}</span>
                {dc.fromRole && <span className={styles.referralSub}>{dc.fromRole}</span>}
              </div>
              <Icon name="solar:arrow-right-linear" size={16} color="var(--neutral-300)" />
              <div className={styles.referralParty}>
                <span className={styles.referralNameRow}>
                  <span className={styles.referralName}>{dc.toName}</span>
                  {dc.toBadge && <Badge tone="primary" size="S" label={dc.toBadge} />}
                </span>
                {dc.toSubtitle && <span className={styles.referralSub}>{dc.toSubtitle}</span>}
              </div>
            </div>
            <div className={styles.referralSub}>
              {createdLabel && `Created on : ${createdLabel}`}
              {createdLabel && dc.status && ' • '}
              {dc.status && <span className={isDraft ? styles.referralStatusDraft : styles.referralStatus}>{dc.status}</span>}
            </div>
          </div>
          {menuItems.length > 0 && (
            <ActionButton
              icon="solar:menu-dots-linear"
              size="S"
              tooltip="More actions"
              tooltipLeft
              onClick={(e) => setMenuAnchor(e.currentTarget.getBoundingClientRect())}
            />
          )}
          {menuAnchor && (
            <MenuPopover
              anchorRect={menuAnchor}
              width={168}
              align="right"
              items={menuItems}
              onClose={() => setMenuAnchor(null)}
              onSelect={(key) => {
                setMenuAnchor(null);
                if (key === 'continue-draft') entry.onOpenReferralDraft?.();
                else if (key === 'view-email') {
                  setActivePage?.('messages');
                  setPendingEmailReferralId?.(dc.referralId);
                }
              }}
            />
          )}
        </div>
      )}
    </>
  );
}

/* ── Fallback ────────────────────────────────────────────────────────── */
function GenericEntryBody({ entry }) {
  return (
    <>
      <MetaLine entry={entry} />
      <div className={htStyles.headlineRow}>
        <span className={htStyles.headline}>{entry.title || entry.headline}</span>
      </div>
      {entry.outcome && (
        <div className={styles.outcomeRow}>
          <span className={styles.outcome} style={entry.outcomeColor ? { color: entry.outcomeColor } : undefined}>
            {entry.outcome}
          </span>
        </div>
      )}
    </>
  );
}

import { Fragment, useContext, useMemo, useState } from 'react';
import { Icon } from '../Icon/Icon';
import { DownChevronIcon } from '../Icon/DownChevronIcon';
import { Badge } from '../Badge/Badge';
import { Tooltip } from '../Tooltip/Tooltip';
import { Avatar } from '../Avatar/Avatar';
import { PriorityIcon } from '../PriorityIcon/PriorityIcon';
import { ActionButton } from '../ActionButton/ActionButton';
import { MenuPopover } from '../MenuPopover/MenuPopover';
import { CommentComposer } from '../CommentComposer/CommentComposer';
import {
  AvatarPill,
  ACT_ICON,
  TRANS_BADGE,
  historyTimelineStyles as htStyles,
} from '../HistoryTimeline/HistoryTimeline';
import { ActivityLogRenderers } from './ActivityLogRenderers';
import { statusTone } from './activityTones';
import styles from './ActivityLog.module.css';

// Render a comment body with the signed-in user's @-mentions painted in the
// mention style (secondary-300, weight 500). Other users' mentions stay
// plain text: highlighting them here would compete visually with the row's
// primary meaning. Match is case-insensitive so `@fold demo` still fires
// when the account name is `Fold Demo`.
function renderCommentBodyWithMentions(text, meName) {
  if (!text) return null;
  if (!meName) return text;
  // Same shape as the extraction regex in TaskDetailDrawer.handleAddComment,
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

// Icon config per entry type: reuses HCC's ACT_ICON (colored rail bubble)
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
  lab:             { icon: 'solar:test-tube-linear' },
  immunization:    { icon: 'solar:syringe-linear' },
};
const DEFAULT_ICON = { icon: 'solar:document-text-linear', color: 'var(--neutral-300)', bg: 'var(--neutral-0)', border: 'var(--neutral-150)' };


/**
 * Shared per-record activity feed.
 *
 * Entries are either group headers (`{ t: 'group', label }`) or log entries.
 * `t` selects which variant renders: outreach entries get the full
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

/**
 * `toolbar` sits at the right of the first month header (search / filter
 * actions); `toolbarAbove` renders above that row (e.g. filter chips). Both
 * stay visible when filtering leaves nothing to show.
 */
export function ActivityLog({ entries, emptyLabel = 'No activity recorded yet.', hideCommentTitle = false, onOpenTask, onOpenNote, toolbar, toolbarAbove, relaxed = false, continuous = false, flushTop = false }) {
  // `continuous` keeps the rail running past the first and last entries, for a
  // log rendered in slices (one per day) that should read as one line.
  // `relaxed` adds 8px between entries, for feeds whose entries carry more lines.
  // `flushTop` drops the first month header's top padding, for hosts that
  // already pad their content (a drawer tab, a program step).
  const wrapClass = [htStyles.wrap, relaxed ? htStyles.relaxed : ''].filter(Boolean).join(' ');
  const [collapsed, setCollapsed] = useState(() => new Set());
  const toggleGroup = (label) => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(label)) next.delete(label); else next.add(label);
    return next;
  });

  const list = useMemo(() => markSupersededDrafts(entries || []), [entries]);
  const hasItems = list.some(e => e.t !== 'group');
  const emptyState = (
    <div className={styles.empty}>
      <Icon name="solar:history-linear" size={32} color="var(--neutral-200)" />
      <p>{emptyLabel}</p>
    </div>
  );
  if (!hasItems) {
    if (!toolbar) return emptyState;
    return (
      <div className={wrapClass}>
        {toolbarAbove}
        <div className={[styles.groupRow, styles.groupRowToolbarOnly].join(' ')}>
          <span className={styles.groupToolbar}>{toolbar}</span>
        </div>
        {emptyState}
      </div>
    );
  }

  // Flatten to render list: mark the first/last item in each visible
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
      // An entry right under a month header starts that month's strand, so it
      // doesn't take the gap that separates it from a previous entry.
      const afterGroup = out.at(-1)?.kind === 'group';
      out.push({ kind: 'item', entry, key: `i${i}`, isFirst: false, isLast: false, afterGroup });
    });
    const allItems = out.filter(it => it.kind === 'item');
    if (allItems.length && !continuous) {
      allItems[0].isFirst = true;
      allItems[allItems.length - 1].isLast = true;
    }
    return out;
  })();

  return (
    <div className={wrapClass}>
      {items.map((it, idx) => {
        if (it.kind === 'item') {
          return (
            <ActivityLogEntry
              key={it.key}
              entry={it.entry}
              isFirst={it.isFirst}
              isLast={it.isLast}
              afterGroup={it.afterGroup}
              hideCommentTitle={hideCommentTitle}
              onOpenTask={onOpenTask}
              onOpenNote={onOpenNote}
            />
          );
        }
        const groupBtn = (
          <button
            key={it.key}
            type="button"
            className={[styles.group, collapsed.has(it.entry.label) ? styles.groupCollapsed : '', flushTop && idx === 0 ? styles.groupFlushTop : ''].filter(Boolean).join(' ')}
            onClick={() => toggleGroup(it.entry.label)}
            aria-expanded={!collapsed.has(it.entry.label)}
          >
            {/* `display` renders in place of the label (a label with a badge,
                say); `label` stays the plain-text key the collapse state uses. */}
            <span>{it.entry.display ?? it.entry.label}</span>
            <span className={styles.groupChevron}>
              <DownChevronIcon size={12} color="var(--neutral-400)" />
            </span>
          </button>
        );
        // The first month row also carries the toolbar.
        if (idx !== 0 || !toolbar) return groupBtn;
        return (
          <div key={it.key} className={styles.groupRowWrap}>
            {toolbarAbove}
            <div className={styles.groupRow}>
              {groupBtn}
              <span className={styles.groupToolbar}>{toolbar}</span>
            </div>
          </div>
        );
      })}
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
function Rail({ entry, isFirst, isLast, afterGroup }) {
  const cfg = TYPE_ICON[entry.t] || DEFAULT_ICON;
  return (
    <div className={htStyles.rail}>
      <span className={[htStyles.connectorTop, isFirst ? htStyles.connectorTopFirst : '', afterGroup ? htStyles.afterGroup : ''].filter(Boolean).join(' ')} />
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
// `context` is a trailing tag naming what the entry belongs to (a care plan
// version, for one), in the slot DOS takes on HCC entries. It may be a node,
// for a tag with styled parts.
export function MetaLine({ entry }) {
  const parts = [
    entry.date,
    entry.time,
    entry.by ? `${entry.by}${entry.role ? ` (${entry.role})` : ''}` : null,
    entry.dos ? `DOS (${entry.dos})` : null,
    entry.context || null,
  ].filter(Boolean);
  return (
    <div className={htStyles.meta}>
      {parts.map((part, i) => (
        <Fragment key={i}>{i > 0 && ' • '}{part}</Fragment>
      ))}
    </div>
  );
}

/**
 * ViewMoreButton: the shared expand trigger. Hidden until the row is
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

// `trailing` sits at the right of an entry, level with its first lines (a
// program badge, say), however tall the entry grows. `trailingHover` goes
// just before it and shows only while the entry is hovered (an open arrow).
function withTrailing(entry, node) {
  if (!entry.trailing && !entry.trailingHover) return node;
  return (
    <div className={styles.withTrailing}>
      <div className={styles.trailingMain}>{node}</div>
      <span className={styles.trailing}>
        {entry.trailingHover && <span className={styles.trailingHover}>{entry.trailingHover}</span>}
        {entry.trailing}
      </span>
    </div>
  );
}

/* ── Type-branched entry ─────────────────────────────────────────────── */
function ActivityLogEntry({ entry, isFirst, isLast, afterGroup = false, hideCommentTitle = false, onOpenTask, onOpenNote }) {
  const { detailCard: DetailCard, referral: Referral } = useContext(ActivityLogRenderers);
  const content = (() => {
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
          return DetailCard ? <DetailCard entry={entry} variant="note" onOpenTask={onOpenTask} onOpenNote={onOpenNote} /> : <GenericEntryBody entry={entry} />;
        case 'task':
          return DetailCard ? <DetailCard entry={entry} variant="task" onOpenTask={onOpenTask} /> : <GenericEntryBody entry={entry} />;
        case 'appointment':
          return DetailCard ? <DetailCard entry={entry} variant="appointment" /> : <GenericEntryBody entry={entry} />;
        case 'referral':
          return Referral ? <Referral entry={entry} /> : <GenericEntryBody entry={entry} />;
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
    })();
  return (
    <div className={htStyles.row}>
      <Rail entry={entry} isFirst={isFirst} isLast={isLast} afterGroup={afterGroup} />
      <div className={[htStyles.body, isFirst ? htStyles.bodyFirst : '', isLast ? htStyles.bodyLast : '', afterGroup ? htStyles.afterGroup : ''].join(' ')}>
        {entry.onOpen ? (
          // `onOpen`: an entry about a record the reader can open. Hovering
          // tints the entry and shows an open button centred at its right
          // (`openTooltip` names what it opens).
          <div className={styles.openable}>
            {withTrailing(entry, content)}
            <span className={styles.openButton}>
              <ActionButton
                icon="solar:arrow-right-up-linear"
                size="sm"
                tooltip={entry.openTooltip || 'Open'}
                onClick={entry.onOpen}
              />
            </span>
          </div>
        ) : withTrailing(entry, content)}
      </div>
    </div>
  );
}

/* ── Variant: Outreach (OutreachTab.LogEntry) ────────────────────────── */
function OutreachEntryBody({ entry }) {
  const [expanded, setExpanded] = useState(false);
  const hasNote = Boolean(entry.note && entry.note.trim());
  const hasCall = !!entry.callDetails;
  // `details`: [{ label, value }] shown as a field list behind "View details"
  // (empty values are skipped).
  const details = (entry.details || []).filter(d => d && d.value != null && d.value !== '');
  // `onViewDetails`: the owner shows the details itself (e.g. a side
  // panel), so View details calls it instead of expanding here.
  // `viewDetailsLabel` renames that link (e.g. "View Chat"), with a right
  // chevron since it opens something rather than expanding.
  const hasDetails = details.length > 0 || !!entry.onViewDetails;
  const expandable = hasNote || hasCall || hasDetails;

  return (
    <>
      <MetaLine entry={entry} />
      <div className={htStyles.headlineRow}>
        <span className={htStyles.headline}>{entry.title}</span>
        {/* A badge is a label, or `{ label, tone, title }` for a quieter one
            (an outreach not tied to any program, say). */}
        {(entry.badges || []).map((b) => {
          const badge = typeof b === 'string' ? { label: b } : b;
          return (
            <span key={badge.label} title={badge.title} className={styles.badgeWrap}>
              <Badge tone={badge.tone || 'primary'} size="sm" label={badge.label} />
            </span>
          );
        })}
      </div>
      <div className={styles.outcomeRow}>
        {entry.outcome && (
          <span className={styles.outcome} style={entry.outcomeColor ? { color: entry.outcomeColor } : undefined}>
            {entry.outcome}
          </span>
        )}
        {/* `outcomeAside`: a quiet note beside the outcome (e.g. a call whose
            details never reached Fold). */}
        {entry.outcomeAside && <span className={styles.outcomeAside}>{entry.outcomeAside}</span>}
        {expandable && (
          <button
            type="button"
            className={`${styles.viewMoreBtn} ${expanded ? styles.viewMoreBtnOpen : ''}`}
            onClick={entry.onViewDetails || (() => setExpanded(v => !v))}
          >
            {entry.outcome && <span className={styles.viewNoteDot} aria-hidden="true">•</span>}
            {entry.viewDetailsLabel || entry.expandLabel || (hasDetails ? 'View details' : 'View more')}
            {entry.viewDetailsLabel
              ? <Icon name="solar:alt-arrow-right-linear" size={12} color="currentColor" />
              : <DownChevronIcon size={11} color="currentColor" className={expanded ? styles.viewMoreChevronOpen : undefined} />}
          </button>
        )}
        {/* `extraAction`: { label, onClick }, one more link after View
            details for something the owner does with this entry. */}
        {entry.extraAction && (
          <button type="button" className={styles.viewMoreBtn} onClick={entry.extraAction.onClick}>
            {(entry.outcome || expandable) && <span className={styles.viewNoteDot} aria-hidden="true">•</span>}
            {entry.extraAction.label}
          </button>
        )}
      </div>

      {expanded && (hasCall || hasNote || hasDetails) && (
        <div className={`${styles.expandedCard} ${!hasCall && !hasDetails ? styles.expandedCardCompact : ''}`}>
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
          {!hasCall && hasDetails && (
            <dl className={styles.detailsGrid}>
              {details.map(d => (
                <Fragment key={d.label}>
                  <dt className={styles.detailsLabel}>{d.label}</dt>
                  <dd className={styles.detailsValue}>{d.value}</dd>
                </Fragment>
              ))}
            </dl>
          )}
          {/* On its own the note needs no heading: "View Note" opened it. */}
          {!hasCall && hasNote && (hasDetails ? (
            <>
              <div className={styles.expandedNoteLabel}>Note :</div>
              <p className={styles.expandedNote}>{entry.note}</p>
            </>
          ) : <p className={styles.expandedNoteOnly}>{entry.note}</p>)}
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
          <Badge size="sm" tone={statusTone(entry.from)} label={entry.from} />
          <Icon name="solar:arrow-right-linear" size={12} color="var(--neutral-300)" />
          <Badge size="sm" tone={statusTone(entry.to)} label={entry.to} />
        </div>
      )}
    </>
  );
}

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
  const meName = useContext(ActivityLogRenderers).viewerName;
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
              size="sm"
              tooltip="Comment actions"
              onClick={(e) => { e.stopPropagation(); setMenuAnchor(e.currentTarget.getBoundingClientRect()); }}
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

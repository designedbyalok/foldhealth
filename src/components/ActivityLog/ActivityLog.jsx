import { useState } from 'react';
import { Icon } from '../Icon/Icon';
import styles from './ActivityLog.module.css';

// Icon per entry type. The bordered neutral square chrome stays constant
// across types — matches OutreachTab.LogEntry and HCC's ActivityTab, where
// the icon glyph carries the type identity, not the tint.
const TYPE_ICON = {
  outreach:        'solar:phone-linear',
  call:            'solar:phone-linear',
  sms:             'solar:chat-round-line-linear',
  status_dos:      'solar:eye-scan-linear',
  status_change:   'solar:eye-scan-linear',
  status_hcc:      'solar:eye-scan-linear',
  status_role:     'solar:refresh-circle-linear',
  accept:          'solar:check-read-linear',
  dismiss:         'solar:close-circle-linear',
  delete:          'solar:trash-bin-trash-linear',
  upload:          'solar:document-add-linear',
  create:          'solar:add-circle-linear',
  override:        'solar:refresh-square-linear',
  comment:         'solar:chat-round-linear',
  assign_coder:    'solar:user-plus-rounded-linear',
  assignee_change: 'solar:user-plus-rounded-linear',
  note:            'solar:notes-linear',
  clinical_note:   'solar:notes-linear',
  task:            'solar:clipboard-check-linear',
  reminder:        'solar:bell-linear',
  appointment:     'solar:calendar-linear',
  referral:        'solar:arrow-right-up-linear',
};

// Status label → pill style class in the CSS. HEDIS canonical status
// grouping drives the color band: Open → primary (Not Started); Engaged /
// Engaged Requires Follow-Up / Submitted → warning (In Progress); Completed
// → success (Done); Closed - * → neutral (Closed). HCC-only labels
// (Accepted / Dismissed / Audited / Returned / …) keep their existing
// classes so both worklists share the map. Unknown falls to `pillNone`.
const TRANS_BADGE = {
  // HEDIS — Not Started (primary)
  Open:                          'pillOpen',
  // HEDIS — In Progress (warning)
  Engaged:                       'pillInProgress',
  'Engaged Requires Follow-Up':  'pillInProgress',
  Submitted:                     'pillInProgress',
  // HEDIS — Done (success)
  Completed:                     'pillCompleted',
  // HEDIS — Closed (neutral)
  'Closed - Do not call':        'pillClosed',
  'Closed - UTR':                'pillClosed',
  'Closed - Other':              'pillClosed',
  // HCC vocabulary
  Accepted:                      'pillAccepted',
  Dismissed:                     'pillDismissed',
  Deleted:                       'pillDeleted',
  None:                          'pillNone',
  Returned:                      'pillReturned',
  New:                           'pillNew',
  Audited:                       'pillAudited',
  'In Progress':                 'pillInProgress',
  'Pending':                     'pillPending',
  'Pending Review':              'pillPending',
  Rejected:                      'pillRejected',
};

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
export function ActivityLog({ entries, emptyLabel = 'No activity recorded yet.' }) {
  const [collapsed, setCollapsed] = useState(() => new Set());
  const toggleGroup = (label) => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(label)) next.delete(label); else next.add(label);
    return next;
  });

  const list = entries || [];
  const hasItems = list.some(e => e.t !== 'group');
  if (!hasItems) {
    return (
      <div className={styles.empty}>
        <Icon name="solar:history-linear" size={32} color="var(--neutral-200)" />
        <p>{emptyLabel}</p>
      </div>
    );
  }

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
      const next = list[i + 1];
      const isLast = !next || next.t === 'group';
      out.push({ kind: 'item', entry, key: `i${i}`, isLast });
    });
    return out;
  })();

  return (
    <div className={styles.timeline}>
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
            <Icon name="solar:alt-arrow-down-linear" size={12} color="var(--neutral-400)" />
          </span>
        </button>
      ) : (
        <ActivityLogEntry key={it.key} entry={it.entry} isLast={it.isLast} />
      ))}
    </div>
  );
}

/* ── Meta line (shared across variants) ──────────────────────────────── */
function MetaLine({ entry }) {
  return (
    <div className={styles.meta}>
      {entry.date && <span>{entry.date}</span>}
      {entry.date && entry.time && <span className={styles.metaDot}>•</span>}
      {entry.time && <span>{entry.time}</span>}
      {(entry.by || entry.role) && <span className={styles.metaDot}>•</span>}
      {entry.by && <span>{entry.by}{entry.role ? ` (${entry.role})` : ''}</span>}
      {entry.dos && (
        <>
          <span className={styles.metaDot}>•</span>
          <span>DOS ({entry.dos})</span>
        </>
      )}
    </div>
  );
}

/* ── Rail (shared) ───────────────────────────────────────────────────── */
function Rail({ iconName, isLast }) {
  return (
    <div className={styles.rail}>
      <div className={styles.railTop}>
        <div className={styles.railLine} />
      </div>
      <div className={styles.icon}>
        <Icon name={iconName} size={14} color="var(--neutral-300)" />
      </div>
      {!isLast && (
        <div className={styles.railBottom}>
          <div className={styles.railLine} />
        </div>
      )}
    </div>
  );
}

/* ── Type-branched entry ─────────────────────────────────────────────── */
function ActivityLogEntry({ entry, isLast }) {
  const iconName = TYPE_ICON[entry.t] || 'solar:document-text-linear';

  return (
    <div className={styles.row}>
      <Rail iconName={iconName} isLast={isLast} />
      <div className={styles.cardWrap}>
        {(() => {
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
              return <DetailCardEntryBody entry={entry} variant="note" />;
            case 'task':
              return <DetailCardEntryBody entry={entry} variant="task" />;
            case 'assign_coder':
            case 'assignee_change':
              return <AssigneeChangeEntryBody entry={entry} />;
            case 'upload':
            case 'document':
              return <UploadEntryBody entry={entry} />;
            case 'comment':
              return <CommentEntryBody entry={entry} />;
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
  const toggle = () => { if (expandable) setExpanded(v => !v); };

  return (
    // The nested "View Note" button owns the accessible expander — role="button" here would nest interactives (axe: nested-interactive).
    <div
      className={`${styles.card} ${expanded ? styles.cardExpanded : ''} ${expandable ? '' : styles.cardStatic}`}
      onClick={toggle}
    >
      <div className={styles.body}>
        <MetaLine entry={entry} />
        <div className={styles.titleRow}>
          <span className={styles.title}>{entry.title}</span>
          {(entry.badges || []).map(b => <span key={b} className={styles.badge}>{b}</span>)}
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
              className={styles.viewNoteBtn}
              onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
            >
              {entry.outcome && <span className={styles.viewNoteDot}>·</span>}
              View Note
              <Icon
                name={expanded ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'}
                size={11}
                color="var(--neutral-400)"
              />
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
                    <button type="button" className={styles.expandedAction} onClick={(e) => e.stopPropagation()}>
                      <Icon name="solar:play-circle-linear" size={13} color="var(--neutral-400)" />
                      Call Recording
                    </button>
                  )}
                  {entry.callDetails.transcriptUrl && (
                    <button type="button" className={styles.expandedAction} onClick={(e) => e.stopPropagation()}>
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
      </div>
    </div>
  );
}

/* ── Variant: Status Change (transition pills only) ──────────────────── */
function StatusChangeEntryBody({ entry }) {
  return (
    <div className={`${styles.card} ${styles.cardStatic}`}>
      <div className={styles.body}>
        <MetaLine entry={entry} />
        <div className={styles.titleRow}>
          <span className={styles.title}>{entry.title || 'Status Changed'}</span>
        </div>
        {entry.from && entry.to && (
          <div className={styles.transition}>
            <span className={`${styles.pill} ${styles[TRANS_BADGE[entry.from] || 'pillNone']}`}>{entry.from}</span>
            <Icon name="solar:arrow-right-linear" size={12} color="var(--neutral-300)" />
            <span className={`${styles.pill} ${styles[TRANS_BADGE[entry.to] || 'pillNone']}`}>{entry.to}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Variant: Clinical note / Task (nested "View Details" card) ──────── */
function DetailCardEntryBody({ entry, variant }) {
  const [expanded, setExpanded] = useState(true);
  const dc = entry.detailCard;
  const expandable = !!dc;
  const toggle = () => { if (expandable) setExpanded(v => !v); };

  return (
    // See OutreachEntryBody — nested "View Details" button owns the accessible expander (axe: nested-interactive).
    <div
      className={`${styles.card} ${styles.cardStatic}`}
      onClick={toggle}
    >
      <div className={styles.body}>
        <MetaLine entry={entry} />
        <div className={styles.titleRow}>
          <span className={styles.title}>{entry.title}</span>
          {expandable && (
            <button
              type="button"
              className={styles.viewDetailsBtn}
              onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
            >
              <span className={styles.viewNoteDot}>·</span>
              View Details
              <Icon
                name={expanded ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'}
                size={11}
                color="var(--primary-300)"
              />
            </button>
          )}
        </div>
        {expanded && dc && (
          <div className={styles.detailCard}>
            {variant === 'task' ? (
              <div className={styles.detailCardRow}>
                {dc.handle && (
                  <span className={styles.detailCardHandle}>
                    <Icon name="solar:hamburger-menu-linear" size={16} color="var(--secondary-300)" />
                  </span>
                )}
                <div className={styles.detailCardText}>
                  <div className={styles.detailCardTitleRow}>
                    <span className={styles.detailCardTitle}>{dc.title}</span>
                    {dc.locked && (
                      <span className={styles.detailCardLock}>
                        <Icon name="solar:lock-keyhole-minimalistic-linear" size={12} color="var(--neutral-300)" />
                      </span>
                    )}
                  </div>
                  {dc.assignee && (
                    <div className={styles.detailCardSubtitle}>Assignee: {dc.assignee}</div>
                  )}
                </div>
                <div className={styles.detailCardTrailing}>
                  {dc.status && (
                    <span className={`${styles.pill} ${styles[TRANS_BADGE[dc.status] || 'pillPending']}`}>{dc.status}</span>
                  )}
                  <button type="button" className={styles.detailCardIconBtn} onClick={(e) => e.stopPropagation()} aria-label="Open">
                    <Icon name="solar:arrow-right-up-linear" size={14} color="var(--neutral-400)" />
                  </button>
                </div>
              </div>
            ) : (
              <>
                {dc.subMeta && <div className={styles.detailCardSubMeta}>{dc.subMeta}</div>}
                <div className={styles.detailCardRow}>
                  <div className={styles.detailCardText}>
                    <div className={styles.detailCardTitleRow}>
                      <span className={styles.detailCardTitle}>{dc.title}</span>
                      {dc.chip && <span className={styles.detailCardChip}>{dc.chip}</span>}
                    </div>
                    {dc.subtitle && <div className={styles.detailCardSubtitle}>{dc.subtitle}</div>}
                  </div>
                  <div className={styles.detailCardTrailing}>
                    {dc.status && (
                      <span className={`${styles.pill} ${styles[TRANS_BADGE[dc.status] || 'pillPending']}`}>{dc.status}</span>
                    )}
                    <button type="button" className={styles.detailCardIconBtn} onClick={(e) => e.stopPropagation()} aria-label="Preview">
                      <Icon name="solar:eye-linear" size={14} color="var(--neutral-300)" />
                    </button>
                    <button type="button" className={styles.detailCardIconBtn} onClick={(e) => e.stopPropagation()} aria-label="More">
                      <Icon name="solar:menu-dots-linear" size={14} color="var(--neutral-300)" />
                    </button>
                  </div>
                </div>
                {dc.linkedGroups && (
                  <button type="button" className={styles.detailCardLink} onClick={(e) => e.stopPropagation()}>
                    Linked Score Groups
                    <Icon name="solar:alt-arrow-right-linear" size={11} color="var(--primary-300)" />
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Variant: Assignee change (from → to avatar transition) ──────────── */
function AssigneeChangeEntryBody({ entry }) {
  const fromA = entry.fromAssignee;
  const toA   = entry.toAssignee;
  return (
    <div className={`${styles.card} ${styles.cardStatic}`}>
      <div className={styles.body}>
        <MetaLine entry={entry} />
        <div className={styles.titleRow}>
          <span className={styles.title}>{entry.title || 'Assignee Changed'}</span>
        </div>
        {(fromA || toA) && (
          <div className={styles.avatarTransition}>
            {fromA ? (
              <span className={styles.avatarPill}>
                <span className={styles.avatarPillDot}>{fromA.initials}</span>
                {fromA.name}
              </span>
            ) : (
              <span className={styles.avatarPill}>
                <span className={`${styles.avatarPillDot} ${styles.avatarPillDotEmpty}`}>—</span>
                Unassigned
              </span>
            )}
            <Icon name="solar:arrow-right-linear" size={12} color="var(--neutral-300)" />
            {toA ? (
              <span className={styles.avatarPill}>
                <span className={styles.avatarPillDot}>{toA.initials}</span>
                {toA.name}
              </span>
            ) : (
              <span className={styles.avatarPill}>
                <span className={`${styles.avatarPillDot} ${styles.avatarPillDotEmpty}`}>—</span>
                Unassigned
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Variant: Upload / Document evidence (HCC .tlAttachment) ─────────── */
function UploadEntryBody({ entry }) {
  return (
    <div className={`${styles.card} ${styles.cardStatic}`}>
      <div className={styles.body}>
        <MetaLine entry={entry} />
        <div className={styles.titleRow}>
          <span className={styles.title}>{entry.title}</span>
        </div>
        {entry.file && (
          <div className={styles.attachment}>
            <span className={styles.fileBubble}>
              <Icon name="solar:file-text-linear" size={14} color="var(--neutral-300)" />
            </span>
            <div className={styles.fileText}>
              <div className={styles.fileName}>{entry.file}</div>
              {entry.fileType && <div className={styles.fileType}>{entry.fileType}</div>}
            </div>
            <button type="button" className={styles.filePreview} aria-label="Preview" onClick={(e) => e.stopPropagation()}>
              <Icon name="solar:eye-linear" size={14} color="var(--neutral-300)" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Variant: Comment (HCC .tlCommentBody inline paragraph) ──────────── */
function CommentEntryBody({ entry }) {
  return (
    <div className={`${styles.card} ${styles.cardStatic}`}>
      <div className={styles.body}>
        <MetaLine entry={entry} />
        <div className={styles.titleRow}>
          <span className={styles.title}>{entry.title || 'Added a Comment'}</span>
        </div>
        {entry.commentBody && (
          <div className={styles.commentBody}>{entry.commentBody}</div>
        )}
      </div>
    </div>
  );
}

/* ── Fallback ────────────────────────────────────────────────────────── */
function GenericEntryBody({ entry }) {
  return (
    <div className={`${styles.card} ${styles.cardStatic}`}>
      <div className={styles.body}>
        <MetaLine entry={entry} />
        <div className={styles.titleRow}>
          <span className={styles.title}>{entry.title || entry.headline}</span>
        </div>
        {entry.outcome && (
          <div className={styles.outcomeRow}>
            <span className={styles.outcome} style={entry.outcomeColor ? { color: entry.outcomeColor } : undefined}>
              {entry.outcome}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

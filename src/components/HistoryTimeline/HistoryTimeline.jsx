import { useState } from 'react';
import { Icon } from '../Icon/Icon';
import { Avatar } from '../Avatar/Avatar';
import { Badge } from '../Badge/Badge';
import styles from './HistoryTimeline.module.css';

// Every status a timeline can show, with its Badge tone and the rail icon
// used when an entry changes TO that status.
const STATUS_META = {
  // Record level
  New:                  { tone: 'primary',   icon: 'solar:stars-linear' },
  'In Progress':        { tone: 'warning',   icon: 'solar:hourglass-linear' },
  Rebuttal:             { tone: 'secondary', icon: 'solar:undo-left-linear' },
  Returned:             { tone: 'warning',   icon: 'solar:undo-left-linear' },
  'Record Requested':   { tone: 'secondary', icon: 'solar:clock-circle-linear' },
  'Record Received':    { tone: 'warning',   icon: 'solar:download-minimalistic-linear' },
  Completed:            { tone: 'success',   icon: 'solar:check-circle-linear' },
  Billed:               { tone: 'success',   icon: 'solar:dollar-linear' },
  Rejected:             { tone: 'error',     icon: 'solar:close-circle-linear' },
  Skipped:              { tone: 'grey',      icon: 'solar:skip-next-linear' },
  Awaiting:             { tone: 'warning',   icon: 'solar:sun-linear' },
  // ICD level
  None:                 { tone: 'grey',      icon: 'solar:minus-circle-linear' },
  Accepted:             { tone: 'success',   icon: 'solar:check-read-linear' },
  Dismissed:            { tone: 'error',     icon: 'solar:close-circle-linear' },
  'Missed Opportunity': { tone: 'warning',   icon: 'solar:danger-triangle-linear' },
  Defer:                { tone: 'grey',      icon: 'solar:pause-circle-linear' },
  Undo:                 { tone: 'grey',      icon: 'solar:undo-left-linear' },
  // HCC level (Completed is shared with record level)
  Open:                 { tone: 'primary',   icon: 'solar:folder-open-linear' },
  Closed:               { tone: 'grey',      icon: 'solar:lock-keyhole-minimalistic-linear' },
};
// Stored values that display under a different name.
const STATUS_ALIAS = { Reject: 'Rejected', 'Action Needed': 'Awaiting', Deferred: 'Defer' };
const statusMeta = (label) => STATUS_META[STATUS_ALIAS[label] || label];
const toneFor = (label) => statusMeta(label)?.tone || 'neutral';
// Stored status values render under the names the worklist uses.
const STATUS_LABEL = { Reject: 'Rejected', Deferred: 'Defer' };
const labelFor = (value) => STATUS_LABEL[value] || value;
const isBlankStatus = (v) => !v || v === '\u2014' || v === '-';

// Rail bubble colors per Badge tone, so the icon matches the pill beside it.
const TONE_BUBBLE = {
  primary:   { color: 'var(--primary-300)',    bg: 'var(--primary-50)' },
  secondary: { color: 'var(--secondary-300)',  bg: 'var(--secondary-50)' },
  success:   { color: 'var(--status-success)', bg: 'var(--status-success-light)' },
  warning:   { color: 'var(--status-warning)', bg: 'var(--status-warning-light)' },
  error:     { color: 'var(--status-error)',   bg: 'var(--status-error-light)' },
  grey:      { color: 'var(--neutral-300)',    bg: 'var(--neutral-50)' },
};
// Icon config for an entry that changed to `label`, or null if unknown.
export function statusIconConfig(label) {
  const meta = statusMeta(label);
  if (!meta) return null;
  const { color, bg } = TONE_BUBBLE[meta.tone];
  return { icon: meta.icon, color, bg, border: `color-mix(in srgb, ${color} 20%, transparent)`, dashed: false };
}
export { toneFor as statusTone };

// Icon + tone treatment per HCC activity type. Exported so callers that
// still key on `t` (e.g. HCC's LeftWorkspace) can share the same routing
// table with tools that need to introspect it.
export const ACT_ICON = {
  outreach:    { icon: 'solar:phone-linear',                 color: 'var(--secondary-300)',  bg: 'var(--secondary-100)',        border: 'rgba(244,122,62,0.2)',    dashed: false },
  status_dos:  { icon: 'solar:eye-scan-linear',              color: 'var(--status-warning)', bg: 'var(--status-warning-light)', border: 'rgba(217,165,11,0.2)',    dashed: false },
  status_hcc:  { icon: 'solar:eye-scan-linear',              color: 'var(--status-warning)', bg: 'var(--status-warning-light)', border: 'rgba(217,165,11,0.2)',    dashed: false },
  status_role: { icon: 'solar:refresh-circle-linear',        color: 'var(--primary-300)',    bg: 'var(--primary-50)',           border: 'rgba(107,68,168,0.2)',    dashed: false },
  accept:      { icon: 'solar:check-read-linear',            color: 'var(--status-success)', bg: 'var(--status-success-light)', border: 'rgba(0,155,83,0.2)',      dashed: false },
  dismiss:     { icon: 'solar:close-circle-linear',          color: 'var(--status-error)',   bg: 'var(--status-error-light)',   border: 'rgba(215,40,37,0.2)',     dashed: false },
  delete:      { icon: 'solar:trash-bin-trash-linear',       color: 'var(--status-error)',   bg: 'var(--status-error-light)',   border: 'rgba(215,40,37,0.2)',     dashed: false },
  upload:      { icon: 'solar:upload-minimalistic-linear',   color: 'var(--neutral-300)',    bg: 'var(--neutral-0)',            border: 'var(--neutral-150)',      dashed: false },
  create:      { icon: 'solar:add-circle-linear',            color: 'var(--secondary-300)',  bg: 'var(--secondary-100)',        border: 'rgba(244,122,62,0.2)',    dashed: false },
  override:    { icon: 'solar:refresh-square-linear',        color: 'var(--secondary-300)',  bg: 'var(--secondary-100)',        border: 'rgba(244,122,62,0.2)',    dashed: false },
  comment:     { icon: 'solar:chat-round-linear',            color: 'var(--neutral-300)',    bg: 'var(--neutral-0)',            border: 'var(--neutral-150)',      dashed: false },
  assign_coder:{ icon: 'solar:user-plus-rounded-linear',     color: 'var(--neutral-300)',    bg: 'var(--neutral-0)',            border: 'var(--neutral-150)',      dashed: false },
};

// Status-string → CSS pill class. Every timeline that shows an "X → Y"
// transition reads from this single map so the color band is identical.
export const TRANS_BADGE = {
  Accepted:      'pillAccepted',
  Dismissed:     'pillDismissed',
  Deleted:       'pillDeleted',
  None:          'pillNone',
  Open:          'pillOpen',
  Returned:      'pillReturned',
  New:           'pillNew',
  Completed:     'pillCompleted',
  'In Progress': 'pillInProgress',
};

/** Small "[avatar] name" chip used inside avatar-transition pills. */
export function AvatarPill({ initials, name }) {
  return (
    <span className={styles.avatarPill}>
      <Avatar variant="staff" size="XS" initials={initials} />
      <span className={styles.avatarName}>{name}</span>
    </span>
  );
}

/**
 * HistoryTimeline: wrapper that lays rows out vertically. Callers still
 * decide how items are grouped (month headers, etc.) upstream; this only
 * takes an already-flattened list of `{ item, isFirst, isLast, key }`.
 */
export function HistoryTimeline({ items = [], renderEntry }) {
  return (
    <div className={styles.wrap}>
      {items.map((it) => renderEntry
        ? renderEntry(it)
        : (
          <HistoryTimelineEntry
            key={it.key}
            item={it.item}
            isFirst={it.isFirst}
            isLast={it.isLast}
          />
        ))}
    </div>
  );
}

/**
 * HistoryTimelineEntry: one row (icon rail + body).
 *
 * Item contract (mirrors HCC's DiagPanel entries):
 *   t         string: key into ACT_ICON for the default icon config
 *   date, time, by, role, dos, meta line inputs
 *   headline  string: the primary line under the meta
 *   from, to  string, status transition pills
 *   tag       string: outreach tag row
 *   file, fileType, attachment card
 *   fromAvatar, toAvatar, { initials, name } for the avatar-transition row
 *   details   Array: per-ICD details rendered inside the expandable card
 *   commentBody string: inline paragraph rendered under the headline
 *
 * Slot props:
 *   iconConfig: override the ACT_ICON lookup (icon, color, bg, border)
 *   singleStatus: render one pill (no arrow) when there's no from/to pair
 *   onPreviewFile: called when the file card is clicked
 *   detailsContent: JSX rendered inside the expandable card (replaces the
 *                    default HCC per-ICD list when the caller has a
 *                    different payload shape, e.g. HccHistoryDrawer)
 *   showDetailsToggle: force-show or force-hide the Details toggle; when
 *                       unset it appears whenever there's expandable content
 *   headlineExtra: extra JSX rendered after the headline (kept inline with
 *                   the Details toggle)
 *   renderStatusIcon: (status, color) => node | null; replaces the rail glyph
 *                   for status changes with a product-specific status icon
 *   children: arbitrary JSX rendered at the end of the body, before
 *                   the details card
 */
export function HistoryTimelineEntry({
  item,
  isFirst,
  isLast,
  iconConfig,
  singleStatus,
  onPreviewFile,
  detailsContent,
  showDetailsToggle,
  headlineExtra,
  renderStatusIcon,
  children,
}) {
  const [expanded, setExpanded] = useState(false);
  // Separate toggle for the composer-note inline expand, status-role
  // rows that were gated on a note (e.g. Coder → Record Requested)
  // ship the copy on `item.note` and reveal it under a View Note link.
  const [noteOpen, setNoteOpen] = useState(false);
  // Status changes take their icon from the status they moved to.
  // ICD accept/dismiss rows carry their outcome in `t`, not a from/to pair.
  const statusForIcon = item.to || singleStatus
    || (item.t === 'accept' ? 'Accepted' : item.t === 'dismiss' ? 'Dismissed' : null);
  const cfg = iconConfig
    || statusIconConfig(statusForIcon)
    || ACT_ICON[item.t]
    || ACT_ICON.accept;
  // Callers can supply the product's own status glyph (e.g. the HCC worklist
  // icons); unknown statuses keep the generic glyph above.
  const statusGlyph = renderStatusIcon && statusIconConfig(statusForIcon)
    ? renderStatusIcon(statusForIcon, cfg.color)
    : null;

  const meta = [
    item.date,
    item.time,
    item.by ? `${item.by}${item.role ? ` (${item.role})` : ''}` : null,
    item.dos ? `DOS (${item.dos})` : null,
    item.patient,
  ].filter(Boolean).join(' • ');

  // A transition with no known previous status shows just the new one.
  const hasTransition = !isBlankStatus(item.from) && !isBlankStatus(item.to);
  const singleStatusValue = singleStatus || (!hasTransition && !isBlankStatus(item.to) ? item.to : null);
  const hasSingleStatus = !hasTransition && singleStatusValue;
  const hasFile = !!item.file;
  const hasAvatarTransition = item.fromAvatar && item.toAvatar;
  const hasDefaultDetails = Array.isArray(item.details) && item.t !== 'accept' && item.t !== 'comment';
  const canExpand = detailsContent != null || hasDefaultDetails;
  const showToggle = showDetailsToggle == null ? canExpand : showDetailsToggle;

  const preview = (e) => {
    if (e) e.stopPropagation?.();
    onPreviewFile?.(item);
  };

  return (
    <div className={styles.row}>
      <div className={styles.rail}>
        <span className={[styles.connectorTop, isFirst ? styles.connectorTopFirst : ''].join(' ')} />
        <span
          className={[styles.icon, cfg.dashed ? styles.iconDashed : ''].join(' ')}
          style={{ background: cfg.bg, borderColor: cfg.border }}
        >
          {statusGlyph || <Icon name={cfg.icon} size={14} color={cfg.color} />}
        </span>
        <span className={[styles.connectorBottom, isLast ? styles.connectorBottomLast : ''].join(' ')} />
      </div>

      <div className={[styles.body, isFirst ? styles.bodyFirst : '', isLast ? styles.bodyLast : ''].join(' ')}>
        {meta && <div className={styles.meta}>{meta}</div>}
        {(item.headline || showToggle || headlineExtra) && (
          <div className={styles.headlineRow}>
            {item.headline && <span className={styles.headline}>{item.headline}</span>}
            {headlineExtra}
            {showToggle && (
              <button
                type="button"
                className={styles.detailsToggle}
                onClick={() => setExpanded(v => !v)}
              >
                <span className={styles.dot}>•</span>
                <span>Details</span>
                <Icon
                  name={expanded ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'}
                  size={10}
                  color="var(--neutral-300)"
                />
              </button>
            )}
          </div>
        )}

        {item.commentBody && (
          <div className={styles.commentBody}>{item.commentBody}</div>
        )}
        {item.t === 'comment' && item.details?.[0]?.note && !item.commentBody && (
          <div className={styles.commentBody}>{item.details[0].note}</div>
        )}

        {hasTransition && (
          <>
            <div className={styles.transition}>
              <Badge size="sm" tone={toneFor(item.from)} label={labelFor(item.from)} />
              <Icon name="solar:arrow-right-linear" size={12} color="var(--neutral-300)" />
              <Badge size="sm" tone={toneFor(item.to)} label={labelFor(item.to)} />
              {item.note && (
                <button
                  type="button"
                  className={styles.viewNoteBtn}
                  onClick={() => setNoteOpen(v => !v)}
                  aria-expanded={noteOpen}
                >
                  <span className={styles.dot}>•</span>
                  <span>View Note</span>
                  <Icon
                    name={noteOpen ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'}
                    size={10}
                    color="var(--neutral-300)"
                  />
                </button>
              )}
            </div>
            {item.note && noteOpen && (
              <div className={styles.commentBody}>{item.note}</div>
            )}
          </>
        )}
        {hasSingleStatus && (
          <div className={styles.transition}>
            <Badge size="sm" tone={toneFor(singleStatusValue)} label={labelFor(singleStatusValue)} />
          </div>
        )}

        {item.tag && <div className={styles.tag}>{item.tag}</div>}

        {hasFile && (
          <div
            className={styles.attachment}
            role={onPreviewFile ? 'button' : undefined}
            tabIndex={onPreviewFile ? 0 : undefined}
            onClick={onPreviewFile ? preview : undefined}
            onKeyDown={onPreviewFile ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); preview(e); }
            } : undefined}
            title={onPreviewFile ? `Preview ${item.file}` : undefined}
          >
            <span className={styles.fileBubble}>
              <Icon name="solar:file-text-linear" size={14} color="var(--neutral-300)" />
            </span>
            <div className={styles.fileText}>
              <div className={styles.fileName}>{item.file}</div>
              {item.fileType && <div className={styles.fileType}>{item.fileType}</div>}
            </div>
            <button
              type="button"
              className={styles.filePreview}
              aria-label="Preview"
              onClick={onPreviewFile ? preview : undefined}
            >
              <Icon name="solar:eye-linear" size={14} color="var(--neutral-300)" />
            </button>
          </div>
        )}

        {hasAvatarTransition && (
          <div className={styles.avatarTransition}>
            <AvatarPill {...item.fromAvatar} />
            <Icon name="solar:arrow-right-linear" size={12} color="var(--neutral-300)" />
            <AvatarPill {...item.toAvatar} />
          </div>
        )}

        {children}

        {expanded && (detailsContent
          ? <div className={styles.detailsCard}>{detailsContent}</div>
          : hasDefaultDetails && (
            <div className={styles.detailsCard}>
              {item.details.map((d, i) => (
                <div key={i} className={styles.detailRow}>
                  <div className={styles.detailText}>
                    {d.hcc && <div className={styles.detailHcc}>{d.hcc}</div>}
                    {d.icd && <div className={styles.detailIcd}>{d.icd}</div>}
                    {d.reason && <div className={styles.detailReason}>Reason: {d.reason}</div>}
                    {d.note && <div className={styles.detailNote}>Note: {d.note}</div>}
                  </div>
                  {d.from && d.to && (
                    <div className={styles.detailBadges}>
                      <Badge size="sm" tone={toneFor(d.from)} label={d.from} />
                      <Icon name="solar:arrow-right-linear" size={12} color="var(--neutral-300)" />
                      <Badge size="sm" tone={toneFor(d.to)} label={d.to} />
                    </div>
                  )}
                  {!d.from && !d.to && (
                    <Badge size="sm" label="Deleted" />
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

export { styles as historyTimelineStyles };

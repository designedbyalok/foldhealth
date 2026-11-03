import { useMemo, useState } from 'react';
import { Icon } from '../Icon/Icon';
import { Badge } from '../Badge/Badge';
import { ViewMoreButton } from '../ActivityLog/ActivityLog';
import styles from './Timeline.module.css';
import { groupByMonth } from './Timeline.utils';

/**
 * Timeline: month-grouped vertical timeline used by Domain Registry's
 * audit log and the Care Gap drawer's Activity Log tab. Extracted from
 * the original AuditLogDrawer so both callers share the same pattern.
 *
 * @param {Array}  props.entries          Entries (see TimelineEntry for shape).
 * @param {string} [props.currentUserName] Name to compare against entry.user
 *                                         for the "(Current User)" hint.
 * @param {(entry: object) => React.ReactNode} [props.renderExtra]
 *                                         Optional content rendered inside the
 *                                         entry card below the description
 *                                         (e.g. attachment buttons).
 * @param {string} [props.emptyLabel]      Placeholder shown when entries is empty.
 */
export function Timeline({ entries, currentUserName, renderExtra, emptyLabel = 'No activity yet.' }) {
  const groups = useMemo(() => groupByMonth(entries || []), [entries]);

  if (!entries || entries.length === 0) {
    return <div style={{ padding: 16, fontSize: 'var(--font-md)', color: 'var(--neutral-300)' }}>{emptyLabel}</div>;
  }

  const lastGroup = groups.length - 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {groups.map((group, gi) => (
        <div key={group.label}>
          {/* The month heading carries its own rail segment so the timeline
              reads as one line instead of restarting each month. */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'stretch' }}>
            <div style={{ width: 24, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: 0.5, flex: 1, background: gi === 0 ? 'transparent' : 'var(--neutral-150)' }} />
            </div>
            <div style={{ padding: gi === 0 ? '0 0 8px' : '8px 0' }}>
              <Badge size="sm" label={group.label} />
            </div>
          </div>
          {group.entries.map((entry, i) => (
            <TimelineEntry
              key={entry.id ?? i}
              entry={entry}
              isFirst={gi === 0 && i === 0}
              isLast={gi === lastGroup && i === group.entries.length - 1}
              currentUserName={currentUserName}
              renderExtra={renderExtra}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ── Icons + colors keyed off entry.action, domain-registry uses these,
   but a caller can override per-entry by passing `icon` / `iconBg` /
   `iconColor` / `iconBorder` directly on the entry. ───────────────── */
const ACTION_CONFIG = {
  created:   { icon: 'solar:add-circle-linear',           bg: 'var(--status-success-light)', border: 'color-mix(in srgb, var(--status-success) 20%, transparent)', color: 'var(--status-success)' },
  updated:   { icon: 'solar:pen-linear',                  bg: 'var(--primary-100)',          border: 'color-mix(in srgb, var(--primary-300) 20%, transparent)', color: 'var(--primary-300)' },
  deleted:   { icon: 'solar:trash-bin-minimalistic-linear', bg: 'var(--status-error-light)', border: 'color-mix(in srgb, var(--status-error) 30%, transparent)',  color: 'var(--status-error)' },
  enabled:   { icon: 'solar:check-circle-linear',         bg: 'var(--status-success-light)', border: 'color-mix(in srgb, var(--status-success) 20%, transparent)', color: 'var(--status-success)' },
  disabled:  { icon: 'solar:close-circle-linear',         bg: 'var(--status-error-light)',   border: 'color-mix(in srgb, var(--status-error) 30%, transparent)',  color: 'var(--status-error)' },
  previewed: { icon: 'solar:eye-linear',                  bg: 'var(--status-info-light)',    border: 'color-mix(in srgb, var(--status-info) 15%, transparent)',  color: 'var(--status-info)' },
  note:      { icon: 'solar:document-text-linear',        bg: 'var(--neutral-50)',           border: 'color-mix(in srgb, var(--neutral-300) 12%, transparent)',  color: 'var(--neutral-300)' },
};
const DEFAULT_CONFIG = { icon: 'solar:document-text-linear', bg: 'var(--neutral-50)', border: 'color-mix(in srgb, var(--neutral-300) 10%, transparent)', color: 'var(--neutral-300)' };

// Map status strings to the shared Badge component's variant keys so status
// pills in the changelog match the rest of the app's status badges.
const STATUS_VARIANT = {
  Enabled:  'success',
  Disabled: 'warning',
  Active:   'success',
  Inactive: 'warning',
  Verified: 'success',
  Removed:  'danger',
};

function ArrowRight() {
  return <Icon name="solar:arrow-right-linear" size={14} color="var(--neutral-200)" />;
}

/** A single field-level change row inside a TimelineEntry. */
export function ChangeDisplay({ change }) {
  if (change.type === 'status') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Badge tone={STATUS_VARIANT[change.from] || 'neutral'} label={change.from} />
        <ArrowRight />
        <Badge tone={STATUS_VARIANT[change.to] || 'neutral'} label={change.to} />
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 'var(--font-md)' }}>
      <span style={{ color: 'var(--neutral-300)', textDecoration: 'line-through' }}>{change.from || '(empty)'}</span>
      <ArrowRight />
      <span style={{ color: 'var(--neutral-400)' }}>{change.to || '(empty)'}</span>
    </div>
  );
}

/**
 * TimelineEntry: single timeline node.
 *
 * Accepted entry fields:
 *   - createdAt   (string): ISO timestamp (drives month grouping)
 *   - date        (string): display date, pre-formatted
 *   - time        (string): display time, pre-formatted
 *   - method      (string): how it happened (e.g. "Password"), after the time
 *   - user        (string): actor name
 *   - action      (string): key into ACTION_CONFIG (created/updated/etc.).
 *   - icon, iconBg, iconBorder, iconColor, per-entry overrides
 *   - avatar      (node): rail node rendered in place of the icon tile
 *   - railBelow   (bool): keep the rail running below a last entry
 *   - title       (string): bold event line above the details
 *   - details     (string): primary description line
 *   - footnote    (string): muted subtitle line, shown in place of category
 *   - category    (string): muted subtitle line
 *   - changes     (array): structured field diffs (Domain Registry)
 *
 * `compact` tightens the spacing between entries (e.g. a profile's Audit Log).
 * `collapseChanges` hides the field diffs behind the ActivityLog's "View
 * Details" toggle, which shows while the entry is hovered.
 */
export function TimelineEntry({ entry, isFirst, isLast, currentUserName, renderExtra, compact = false, collapseChanges = false }) {
  const [changesOpen, setChangesOpen] = useState(false);
  const hasChanges = entry.changes?.length > 0;
  const toggleable = collapseChanges && hasChanges;
  const cfg = ACTION_CONFIG[entry.action] || DEFAULT_CONFIG;
  const icon = entry.icon || cfg.icon;
  const iconBg = entry.iconBg || cfg.bg;
  const iconBorder = entry.iconBorder || cfg.border;
  const iconColor = entry.iconColor || cfg.color;
  const isCurrentUser = currentUserName && entry.user && entry.user.toLowerCase() === currentUserName.toLowerCase();

  return (
    <div className={styles.row}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24, flexShrink: 0 }}>
        <div style={{ width: 0.5, flex: `0 0 ${compact ? 4 : 14}px`, background: isFirst ? 'transparent' : 'var(--neutral-150)' }} />
        {entry.avatar || (
          <div style={{
            width: 24, height: 24, borderRadius: 6, flexShrink: 0,
            border: `0.5px solid ${iconBorder}`, background: iconBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name={icon} size={14} color={iconColor} />
          </div>
        )}
        <div style={{
          width: 0.5,
          flex: 1,
          minHeight: 12,
          // The tail is dropped after the last entry so nothing dangles, unless
          // the entry opted in: an expanded card needs the rail beside it.
          background: isLast && !entry.railBelow ? 'transparent' : 'var(--neutral-150)',
        }} />
      </div>

      <div style={{ flex: 1, background: 'var(--neutral-0)', borderRadius: 8, padding: compact ? '0 4px 8px' : '6px 4px 12px 4px' }}>
        <div style={{ padding: compact ? '4px 8px' : 8 }}>
          <div style={{
            display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap',
            fontSize: 'var(--font-sm)', fontWeight: 500, color: 'var(--neutral-300)', marginBottom: 4,
          }}>
            {entry.date && <span>{entry.date}</span>}
            {entry.date && entry.time && <span style={{ color: 'var(--neutral-300)' }}>•</span>}
            {entry.time && <span>{entry.time}</span>}
            {entry.method && <span style={{ color: 'var(--neutral-300)' }}>•</span>}
            {entry.method && <span>{entry.method}</span>}
            {entry.user && <span style={{ color: 'var(--neutral-300)' }}>•</span>}
            {entry.user && (
              <span>
                {entry.user}
                {isCurrentUser && <span style={{ color: 'var(--neutral-200)', fontWeight: 400 }}> (Current User)</span>}
              </span>
            )}
          </div>

          {entry.title && (
            <div style={{ fontSize: 'var(--font-base)', fontWeight: 500, color: 'var(--neutral-500)', lineHeight: 1.2, marginBottom: 4 }}>
              {entry.title}
            </div>
          )}

          {entry.details && (
            <div style={{
              fontSize: entry.title ? 'var(--font-md)' : 'var(--font-base)',
              color: entry.title ? 'var(--neutral-300)' : 'var(--neutral-400)',
              lineHeight: 1.2, marginBottom: 4,
            }}>
              {entry.details}
              {toggleable && (
                <ViewMoreButton leadingDot label="View Details" expanded={changesOpen} onToggle={() => setChangesOpen(o => !o)} />
              )}
            </div>
          )}

          {hasChanges && (!collapseChanges || changesOpen) && (
            <div
              className={collapseChanges ? styles.changesCard : undefined}
              style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6, marginBottom: 4 }}
            >
              {entry.changes.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {c.field && (
                    <span style={{ fontSize: 'var(--font-xs)', fontWeight: 500, color: 'var(--neutral-200)', textTransform: 'capitalize' }}>{c.field.replace(/_/g, ' ')}</span>
                  )}
                  <ChangeDisplay change={c} />
                </div>
              ))}
            </div>
          )}

          {(entry.footnote || entry.category) && (
            <span style={{ fontSize: 'var(--font-sm)', color: 'var(--neutral-200)' }}>{entry.footnote || entry.category}</span>
          )}

          {renderExtra && renderExtra(entry)}
        </div>
      </div>
    </div>
  );
}

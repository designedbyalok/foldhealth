import { MetaLine, ViewMoreButton } from '../../../../../../../components/ActivityLog/ActivityLog';
import { historyTimelineStyles as htStyles } from '../../../../../../../components/HistoryTimeline/HistoryTimeline';
import { Avatar } from '../../../../../../../components/Avatar/Avatar';
import { Badge } from '../../../../../../../components/Badge/Badge';
import { Icon } from '../../../../../../../components/Icon/Icon';
import { adherenceTone, goalProgressTone } from './goalMetrics';
import styles from './carePlanLogItem.module.css';

const LIVE_CHANGE_TYPES = new Set(['status', 'priority', 'progress', 'title', 'assignment']);

// A status change wears the icon of the status it moved to (the rail tile
// already takes that status's colour), as HCC status entries do.
const STATUS_ICON = {
  'Not Started': 'solar:minus-circle-linear',
  'In Progress': 'custom:pending',
  'On Hold': 'solar:pause-circle-linear',
  Met: 'solar:check-circle-linear',
  'Not Met': 'solar:close-circle-linear',
};
const CHANGE_ICON = {
  priority: 'solar:ranking-linear',
  title: 'solar:pen-linear',
};
const NOTE_ON = { goal: 'Goal', intervention: 'Intervention', barrier: 'Barrier' };

/**
 * One care plan activity (from buildCarePlanHistory / activityEntries) as an
 * ActivityLog entry, the way the Care Plan History shows it: status and
 * progress transitions as pills, assignee changes as avatar chips, notes
 * behind "• View Note".
 *
 * `meta` fills the meta line (date, time, by, role, context); `noteOpen` and
 * `onToggleNote` hold a note's open state, which lives with the caller.
 */
export function carePlanLogItem(e, { meta = {}, noteOpen = false, onToggleNote } = {}) {
  const base = {
    id: e.id,
    ...meta,
    // What happened, then the item it happened to in a quieter tone.
    title: e.headlineAction
      ? <>{e.headlineAction} <span className={styles.headlineSubject}>{e.headlineSubject}</span></>
      : e.headline,
  };
  if (e.type === 'progress') {
    // Progress and adherence read in their band colours, on the pills and on
    // the half-ring glyph in the rail.
    const toneOf = e.entityType === 'intervention' ? adherenceTone : goalProgressTone;
    const toTone = toneOf(e.to);
    return {
      ...base,
      t: 'status_change',
      avatar: <Avatar type="icon" variant={toTone === 'grey' ? 'others' : toTone} size="S" iconName="custom:in-progress" />,
      render: () => (
        <>
          <MetaLine entry={base} />
          <div className={htStyles.headlineRow}>
            <span className={htStyles.headline}>{base.title}</span>
          </div>
          <div className={htStyles.transition}>
            <Badge size="S" tone={toneOf(e.from)} label={e.from || 'None'} />
            <Icon name="solar:arrow-right-linear" size={12} color="var(--neutral-300)" />
            <Badge size="S" tone={toTone} label={e.to || 'None'} />
          </div>
        </>
      ),
    };
  }
  if (e.type === 'assignment' && /^Assignee Changed for /.test(e.headline)) {
    const person = name => (!name || name === 'Unassigned' || name === 'None'
      ? null
      : { name, initials: name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() });
    return { ...base, t: 'assignee_change', fromAssignee: person(e.from), toAssignee: person(e.to) };
  }
  if (LIVE_CHANGE_TYPES.has(e.type)) {
    const icon = e.type === 'status'
      ? STATUS_ICON[e.to]
      : (e.type === 'assignment' ? 'solar:calendar-linear' : CHANGE_ICON[e.type]);
    return { ...base, t: 'status_change', icon, from: e.from || 'None', to: e.to || 'None' };
  }
  if (e.type === 'care_note' || e.type === 'item_note') {
    return {
      ...base,
      t: 'comment',
      render: () => (
        <>
          <MetaLine entry={base} />
          <div className={htStyles.headlineRow}>
            <span className={htStyles.headline}>{base.title}</span>
            {(e.body || e.previous) && (
              <ViewMoreButton expanded={noteOpen} onToggle={onToggleNote} label="View Note" leadingDot />
            )}
          </div>
          {noteOpen && (
            // Laid out like an HCC details card: what the note is on, the
            // note itself, then what it replaced.
            <div className={htStyles.detailsCard}>
              <div className={htStyles.detailRow}>
                <div className={htStyles.detailText}>
                  <div className={htStyles.detailHcc}>
                    {e.title ? `${NOTE_ON[e.entityType] || 'Item'}: ${e.title}` : 'Care Plan Note'}
                  </div>
                  <div className={`${htStyles.detailIcd} ${styles.noteText}`}>{e.body || e.previous}</div>
                  {e.body && e.previous && (
                    <div className={htStyles.detailReason}>Previous note: {e.previous}</div>
                  )}
                  {!e.body && <div className={htStyles.detailReason}>Note removed</div>}
                </div>
              </div>
            </div>
          )}
        </>
      ),
    };
  }
  if (e.type === 'value') {
    return {
      ...base,
      t: 'care_plan_value',
      icon: 'solar:graph-up-linear',
      outcome: `${e.value || 'No value'}${e.previous ? ` (previous ${e.previous})` : ''} • ${e.inTarget ? 'In target' : 'Out of target'}`,
      outcomeColor: e.inTarget ? 'var(--status-success)' : 'var(--status-error)',
    };
  }
  return { ...base, t: 'care_plan_event', icon: 'custom:history', outcome: e.detail || undefined };
}

import { GBI_STATUS_TONE } from '../../tables/carePlanTableShared';

const NOUN = { goal: 'Goal', intervention: 'Intervention', barrier: 'Barrier', template: 'Template', plan: 'Care plan' };

// Call notes come from a rich-text field; older ones are plain text.
function noteHtml(detail) {
  if (!detail) return '';
  if (/<[a-z][^>]*>/i.test(detail)) return detail;
  return detail.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
}

function splitArrow(detail) {
  if (!detail || !detail.includes('→')) return [null, null];
  const [from, to] = detail.split('→').map(s => s.trim());
  return [from || null, to || null];
}

/** Filter options for the plan-wide log, by audit action. */
export const PLAN_ACTIVITY_FILTERS = [
  { key: 'all', label: 'All activity' },
  { key: 'call_note', label: 'Call notes' },
  { key: 'note', label: 'Notes' },
  { key: 'status_changed', label: 'Status' },
  { key: 'progress_changed', label: 'Progress' },
  { key: 'value_changed', label: 'Values' },
  { key: 'review_finished', label: 'Reviews' },
  { key: 'signed', label: 'Signed' },
];

/**
 * Every audit row on a care plan as ActivityLog entries, newest first, each
 * naming the goal / intervention / barrier it is about. `titles`: id → item
 * title, so a row whose summary is generic still says which item it was.
 */
export function planActivityEntries(audit, titles) {
  return [...(audit || [])]
    .sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt))
    .map((e) => {
      const created = e.createdAt ? new Date(e.createdAt) : null;
      const base = {
        id: e.id,
        actor: e.actor || '',
        at: e.createdAt,
        createdAt: e.createdAt,
        action: e.action,
        date: created ? created.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null,
        time: created ? created.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null,
        by: e.actor || null,
      };
      const noun = NOUN[e.entityType] || 'Item';
      const item = titles.get(String(e.entityId)) || '';
      const about = item ? `${noun}: ${item}` : noun;
      const [from, to] = splitArrow(e.detail);
      switch (e.action) {
        case 'call_note':
          return { ...base, t: 'comment', title: 'Added a Call Note', commentHtml: noteHtml(e.detail) };
        case 'review_finished':
          return { ...base, t: 'default', title: `Finished a care plan review${e.detail ? ` · ${e.detail}` : ''}` };
        case 'note':
          return { ...base, t: 'comment', title: `Added a Note · ${about}`, commentBody: e.detail || '' };
        case 'note_deleted':
          return { ...base, t: 'comment', title: `Deleted a Note · ${about}`, commentBody: e.detail || '' };
        case 'status_changed':
          return {
            ...base, t: 'status_change', title: `Status · ${item || noun}`, from, to,
            fromTone: GBI_STATUS_TONE[from] || 'grey', toTone: GBI_STATUS_TONE[to] || 'grey',
          };
        case 'progress_changed':
        case 'value_changed':
          return {
            ...base, t: 'status_change', title: `${e.action === 'value_changed' ? 'Value' : 'Progress'} · ${item || noun}`,
            from, to, fromTone: 'grey', toTone: 'primary',
          };
        case 'created':
          if (e.entityType === 'template') return { ...base, t: 'default', title: `Template applied · ${e.summary || item}` };
          return { ...base, t: 'default', title: `Added ${noun.toLowerCase()} · ${e.summary || item}` };
        case 'deleted':
          if (e.entityType === 'template') return { ...base, t: 'default', title: `Template removed · ${e.summary || item}` };
          return { ...base, t: 'default', title: `Removed ${noun.toLowerCase()} · ${e.summary || item}` };
        case 'signed':
          return { ...base, t: 'default', title: e.summary || 'Signed the care plan' };
        default:
          if (e.entityType === 'template') {
            return { ...base, t: 'default', title: `Template updated · ${e.summary || item}` };
          }
          return { ...base, t: 'default', title: e.summary ? `${e.summary}${item && !e.summary.includes(item) ? ` · ${item}` : ''}` : `Updated ${about}` };
      }
    });
}

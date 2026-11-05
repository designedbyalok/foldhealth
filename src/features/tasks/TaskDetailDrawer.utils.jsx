import { AUDIT_LOG_VERB_MAP, STATUS_LABELS } from './TasksView.utils';

function initialsOf(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2);
}

function formatDate(iso) {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(iso) {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// Map a task_audit_log row to an ActivityLog entry shape (date/time/by meta
// line + typed body). `t` selects the ActivityLog body variant; anything not
// listed falls to the generic body.
export function buildActivityLogItems(auditLog, activityTab) {
  const entries = [];
  for (const log of auditLog) {
    const visible = activityTab === 'All'
      || (activityTab === 'Comments' && log.action_type === 'comment_added')
      || (activityTab === 'History' && log.action_type !== 'comment_added');
    if (!visible) continue;

    const base = {
      id: log.id,
      date: formatDate(log.created_at),
      time: formatTime(log.created_at),
      by: log.user_name,
    };
    const verb = AUDIT_LOG_VERB_MAP[log.action_type] || log.action_type;
    const actor = log.user_name || 'System';

    switch (log.action_type) {
      case 'created':
        entries.push({
          ...base,
          t: 'create',
          title: log.to_value ? `${actor} created the task "${log.to_value}"` : `${actor} ${verb}`,
        });
        break;
      case 'comment_added':
        entries.push({
          ...base,
          t: 'comment',
          title: `${actor} ${verb}`,
          commentBody: log.to_value,
        });
        break;
      case 'status_changed':
        entries.push({
          ...base,
          t: 'status_change',
          title: `${actor} ${verb}`,
          from: STATUS_LABELS[log.from_value] || log.from_value,
          to: STATUS_LABELS[log.to_value] || log.to_value,
        });
        break;
      case 'assignee_changed':
        entries.push({
          ...base,
          t: 'assignee_change',
          title: `${actor} ${verb}`,
          fromAssignee: log.from_value ? { name: log.from_value, initials: initialsOf(log.from_value) } : null,
          toAssignee: log.to_value ? { name: log.to_value, initials: initialsOf(log.to_value) } : null,
        });
        break;
      case 'priority_changed':
        entries.push({
          ...base,
          title: `${actor} ${verb}: ${log.from_value || '-'} → ${log.to_value || '-'}`,
        });
        break;
      case 'due_date_changed':
        entries.push({
          ...base,
          title: `${actor} ${verb}: ${log.from_value || '-'} → ${log.to_value || '-'}`,
        });
        break;
      case 'renamed':
        entries.push({
          ...base,
          title: `${actor} ${verb}: "${log.from_value}" → "${log.to_value}"`,
        });
        break;
      case 'label_added':
        entries.push({ ...base, title: `${actor} ${verb} "${log.to_value}"` });
        break;
      case 'label_removed':
        entries.push({ ...base, title: `${actor} ${verb} "${log.from_value}"` });
        break;
      case 'description_changed':
        entries.push({ ...base, title: `${actor} ${verb}` });
        break;
      case 'subtask_added':
        entries.push({
          ...base,
          t: 'task',
          title: `${actor} ${verb}${log.to_value ? `: ${log.to_value}` : ''}`,
        });
        break;
      case 'claimed':
        entries.push({
          ...base,
          title: `${actor} ${verb}${log.to_value ? ` (assigned to ${log.to_value})` : ''}`,
        });
        break;
      case 'deleted':
        entries.push({ ...base, t: 'delete', title: `${actor} ${verb}` });
        break;
      default:
        entries.push({ ...base, title: `${actor} ${verb}` });
    }
  }
  return entries;
}

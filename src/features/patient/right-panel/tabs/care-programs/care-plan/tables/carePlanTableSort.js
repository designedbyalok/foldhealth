import { parseLocalDate } from '../../../../../../../lib/localDate';
const GBI_PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

function parseSortNumber(value) {
  if (value == null || value === '' || value === '-') return -1;
  const n = Number(value);
  return Number.isFinite(n) ? n : -1;
}

function toIsoDateKey(v) {
  const d = parseLocalDate(v);
  return d ? d.toISOString() : '';
}

export function enrichGoalRows(rows) {
  return (rows || []).map((g) => ({
    ...g,
    _sortPriority: GBI_PRIORITY_RANK[String(g.priority || '').toLowerCase()] ?? 99,
    _sortProgress: parseSortNumber(g.progress),
    _sortCreatedAt: toIsoDateKey(g.createdAt),
    _sortTargetDate: toIsoDateKey(g.targetDate),
  }));
}

export function enrichBarrierRows(rows) {
  return (rows || []).map(b => ({
    ...b,
    _sortPriority: GBI_PRIORITY_RANK[String(b.priority || '').toLowerCase()] ?? 99,
  }));
}

export function enrichInterventionRows(rows) {
  return (rows || []).map((i) => {
    // Due date sort key = createdAt + parsed duration (ISO string).
    // Empty/unparseable rows sort last (the shared sorter groups
    // empty strings at the end for date columns).
    // Same precedence as computeDueDate: user-picked override wins,
    // otherwise createdAt + duration; unparseable rows sort last.
    let dueSortKey = '';
    const override = i.config?.dueDateOverride;
    if (override) {
      const d = parseLocalDate(override);
      if (d) dueSortKey = d.toISOString();
    }
    if (!dueSortKey) {
      const start = i.createdAt ? new Date(i.createdAt) : null;
      const rawDur = i.config?.dueOffset != null && i.config?.dueUnit
        ? `${i.config.dueOffset}${String(i.config.dueUnit)[0]}`
        : i.duration;
      const m = rawDur && String(rawDur).trim().match(/^(\d+)\s*([dwmy])$/i);
      if (start && !Number.isNaN(start.getTime()) && m) {
        const n = Number(m[1]);
        const unit = m[2].toLowerCase();
        const end = new Date(start);
        if (unit === 'd') end.setDate(end.getDate() + n);
        else if (unit === 'w') end.setDate(end.getDate() + n * 7);
        else if (unit === 'm') end.setMonth(end.getMonth() + n);
        else if (unit === 'y') end.setFullYear(end.getFullYear() + n);
        dueSortKey = end.toISOString();
      }
    }
    return {
      ...i,
      _sortPriority: GBI_PRIORITY_RANK[String(i.priority || '').toLowerCase()] ?? 99,
      _sortAssignee: i.assignee?.name === 'Unassigned' ? '' : (i.assignee?.name || ''),
      _sortAdherence: parseSortNumber(i.adherence),
      _sortDueDate: dueSortKey,
    };
  });
}

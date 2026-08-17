// Maps population_groups DB rows ↔ the group objects the Population Groups
// table renders. The table shows pre-formatted `created` / `updated` strings,
// so we derive those from the timestamptz columns here. Both are date-only:
// the time of day added noise to the column without telling anyone anything
// they acted on.

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '';

export function popGroupRowToJs(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    type: row.group_type,
    filterType: row.filter_type || null,
    memberStatus: row.member_status || 'All Status',
    memberIds: row.member_ids || [],
    count: row.active_count ?? 0,
    inactive: row.inactive_count ?? 0,
    rule: row.rule || null,
    created: fmtDate(row.created_at),
    updated: fmtDate(row.updated_at),
  };
}

export function popGroupJsToDb(g) {
  return {
    name: g.name,
    description: g.description || null,
    group_type: g.type || 'Static',
    filter_type: g.filterType || null,
    member_status: g.memberStatus || 'All Status',
    member_ids: g.memberIds || [],
    active_count: g.count ?? 0,
    inactive_count: g.inactive ?? 0,
    // Only written when the caller supplies it — an unconditional null here
    // would wipe a Dynamic group's rule every time the edit drawer saves
    // name/description (it doesn't know about rules).
    ...('rule' in g ? { rule: g.rule } : {}),
  };
}

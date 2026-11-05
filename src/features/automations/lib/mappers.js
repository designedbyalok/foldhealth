/* Supabase rows ⇄ automation objects (automations migration). */

const graphOf = (g) => (g && Array.isArray(g.nodes) ? g : { nodes: [] });

export const automationRowToJs = (r) => ({
  id: r.id,
  name: r.name || '',
  description: r.description || '',
  status: r.status || 'draft',
  schedule: r.schedule || 'onTrigger',
  runTime: r.run_time || null,
  populationGroupId: r.population_group_id || null,
  populationGroupName: r.population_group_name || null,
  graph: graphOf(r.graph),
  draftGraph: r.draft_graph && Array.isArray(r.draft_graph.nodes) ? r.draft_graph : null,
  templateId: r.template_id || null,
  legacyRuleId: r.legacy_rule_id || null,
  lastExecutedAt: r.last_executed_at || null,
  lastRunStatus: r.last_run_status || null,
  lastTestedAt: r.last_tested_at || null,
  createdBy: r.created_by || '',
  updatedBy: r.updated_by || '',
  createdAt: r.created_at || null,
  updatedAt: r.updated_at || null,
});

export const automationJsToRow = (a) => ({
  name: a.name,
  description: a.description || '',
  status: a.status || 'draft',
  schedule: a.schedule || 'onTrigger',
  run_time: a.runTime || null,
  population_group_id: a.populationGroupId || null,
  population_group_name: a.populationGroupName || null,
  graph: graphOf(a.graph),
  draft_graph: a.draftGraph || null,
  template_id: a.templateId || null,
});

export const templateRowToJs = (r) => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  description: r.description || '',
  category: r.category,
  recommended: !!r.recommended,
  schedule: r.schedule || 'onTrigger',
  usedCount: r.used_count ?? 0,
  sortOrder: r.sort_order ?? 0,
  graph: graphOf(r.graph),
});

export const templateJsToRow = (t) => ({
  slug: t.slug,
  name: t.name,
  description: t.description,
  category: t.category,
  recommended: !!t.recommended,
  schedule: t.schedule || 'onTrigger',
  used_count: t.usedCount ?? 0,
  sort_order: t.sortOrder ?? 0,
  graph: graphOf(t.graph),
});

export const runRowToJs = (r) => ({
  id: r.id,
  automationId: r.automation_id,
  kind: r.kind,
  targetType: r.target_type || null,
  targetLabel: r.target_label || null,
  memberCount: r.member_count ?? 0,
  completedCount: r.completed_count ?? 0,
  inProgressCount: r.in_progress_count ?? 0,
  failedCount: r.failed_count ?? 0,
  minutesSaved: r.minutes_saved ?? 0,
  graph: r.graph ? graphOf(r.graph) : null,
  triggeredBy: r.triggered_by || null,
  startedAt: r.started_at,
  finishedAt: r.finished_at || null,
});

export const runJsToRow = (r) => ({
  id: r.id,
  automation_id: r.automationId,
  kind: r.kind,
  target_type: r.targetType || null,
  target_label: r.targetLabel || null,
  member_count: r.memberCount ?? 0,
  completed_count: r.completedCount ?? 0,
  in_progress_count: r.inProgressCount ?? 0,
  failed_count: r.failedCount ?? 0,
  minutes_saved: r.minutesSaved ?? 0,
  graph: r.graph || null,
  triggered_by: r.triggeredBy || null,
  started_at: r.startedAt,
  finished_at: r.finishedAt || null,
});

export const runMemberRowToJs = (r) => ({
  id: r.id,
  runId: r.run_id,
  automationId: r.automation_id,
  patientId: r.patient_id,
  patientName: r.patient_name || '',
  status: r.status,
  failingReason: r.failing_reason || null,
  minutesSaved: r.minutes_saved ?? 0,
  path: r.path || {},
  startedAt: r.started_at,
  finishedAt: r.finished_at || null,
});

export const runMemberJsToRow = (m) => ({
  id: m.id,
  run_id: m.runId,
  automation_id: m.automationId,
  patient_id: String(m.patientId),
  patient_name: m.patientName || null,
  status: m.status,
  failing_reason: m.failingReason || null,
  minutes_saved: m.minutesSaved ?? 0,
  path: m.path || {},
  started_at: m.startedAt,
  finished_at: m.finishedAt || null,
});

export const messageRowToJs = (r) => ({
  id: r.id,
  runMemberId: r.run_member_id,
  runId: r.run_id,
  automationId: r.automation_id,
  nodeId: r.node_id,
  channel: r.channel,
  patientId: r.patient_id,
  patientName: r.patient_name || '',
  address: r.address || '',
  status: r.status,
  opens: r.opens ?? 0,
  clicks: r.clicks ?? 0,
  failingReason: r.failing_reason || null,
  sentAt: r.sent_at,
});

export const messageJsToRow = (m) => ({
  id: m.id,
  run_member_id: m.runMemberId,
  run_id: m.runId,
  automation_id: m.automationId,
  node_id: m.nodeId,
  channel: m.channel,
  patient_id: String(m.patientId),
  patient_name: m.patientName || null,
  address: m.address || null,
  status: m.status,
  opens: m.opens ?? 0,
  clicks: m.clicks ?? 0,
  failing_reason: m.failingReason || null,
  sent_at: m.sentAt,
});

export const editLogRowToJs = (r) => ({
  id: r.id,
  automationId: r.automation_id,
  actor: r.actor || '',
  summary: r.summary,
  createdAt: r.created_at,
});

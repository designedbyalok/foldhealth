// AI-generated TOC follow-up tasks. The worklist badge shows `patient.tasks`;
// rows are persisted to Supabase (program_code=TOC, source_key per slot).

import { resolveAiTaskCount } from './tocOutcome';

export const AI_TOC_TASK_POOL = [
  { title: 'Complete post-discharge medication reconciliation', priority: 'high', subtasks: 2, attachments: 1, comments: 0 },
  { title: 'Schedule PCP follow-up within 7 days of discharge', priority: 'high', subtasks: 0, attachments: 0, comments: 1 },
  { title: 'Review red-flag symptoms with patient and caregiver', priority: 'medium', subtasks: 0, attachments: 1, comments: 0 },
  { title: 'Confirm home health nursing start date', priority: 'medium', subtasks: 0, attachments: 0, comments: 0 },
  { title: 'Coordinate transportation for follow-up appointment', priority: 'low', subtasks: 0, attachments: 0, comments: 0 },
  { title: 'Document social-work referral for prescription assistance', priority: 'medium', subtasks: 1, attachments: 0, comments: 2 },
];

export function aiTocSourceKey(patientId, index) {
  return `${patientId}-ai-${index}`;
}

export function getAiTocTaskTemplate(index) {
  return AI_TOC_TASK_POOL[index] || null;
}

/** MM/DD/YYYY or MM-DD-YYYY → MM-DD-YYYY for the tasks table. */
export function normalizeAiTocDueDate(patient) {
  const raw = patient?.dueOn || patient?.nextOutreach;
  if (!raw) {
    const t = new Date();
    return `${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}-${t.getFullYear()}`;
  }
  const slash = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  if (slash) return `${slash[1]}-${slash[2]}-${slash[3]}`;
  const dash = /^(\d{2})-(\d{2})-(\d{4})$/.exec(raw);
  if (dash) return raw;
  return raw;
}

/** Display due for TasksTab (MM/DD/YYYY). */
export function displayAiTocDue(dueDate) {
  if (!dueDate) return '-';
  const dash = /^(\d{2})-(\d{2})-(\d{4})$/.exec(dueDate);
  if (dash) return `${dash[1]}/${dash[2]}/${dash[3]}`;
  return dueDate;
}

export function tocAgentCreatedAt(patient, index = 0) {
  const n = String(patient?.id || index).split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const daysAgo = 1 + ((n + index) % 5);
  const created = new Date();
  created.setDate(created.getDate() - daysAgo);
  return created.toISOString();
}

export function isAiTocTaskId(id) {
  return /-ai-\d+$/.test(String(id || ''));
}

export function isAiTocTask(task) {
  if (!task) return false;
  if (task.source_key && String(task.source_key).includes('-ai-')) return true;
  if (task.program_code === 'TOC' && Array.isArray(task.labels) && task.labels.includes('AI')) return true;
  return task.created_by === 'TOC Agent' || isAiTocTaskId(task.id);
}

/** Fallback audit entry when DB log hasn't loaded yet. */
export function buildTocAgentCreatedAuditEntry(task, patient) {
  const idx = task?.source_key?.match(/-ai-(\d+)$/)?.[1];
  return {
    id: `toc-agent-created-${task.id}`,
    task_id: task.id,
    user_name: 'TOC Agent',
    user_id: null,
    action_type: 'created',
    field_name: null,
    from_value: null,
    to_value: task.name || task.title || 'Task',
    created_at: tocAgentCreatedAt(patient || { id: task.patient_id }, Number(idx) || 0),
  };
}

export function resolveAiTocTaskAuditLog(task, auditLog = [], patient = null) {
  if (!isAiTocTask(task)) return auditLog;
  if (auditLog.some(l => l.action_type === 'created')) return auditLog;
  const patientCtx = patient || { id: task.patient_id };
  return [buildTocAgentCreatedAuditEntry(task, patientCtx), ...auditLog];
}

export function dbTaskToListRow(dbTask, template) {
  const due = displayAiTocDue(dbTask.due_date);
  const completedOn = dbTask.completed_at
    ? new Date(dbTask.completed_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
    : undefined;
  return {
    id: dbTask.id,
    title: dbTask.name,
    name: dbTask.name,
    priority: dbTask.priority || 'medium',
    due,
    due_date: dbTask.due_date,
    status: dbTask.status || 'pending',
    overdue: dbTask.status === 'missed' || !!dbTask.due_missed,
    subtasks: template?.subtasks || 0,
    attachments: dbTask.attachments ?? template?.attachments ?? 0,
    comments: dbTask.comments ?? template?.comments ?? 0,
    completedOn,
    source_key: dbTask.source_key || dbTask.meta,
    program_code: dbTask.program_code,
    patient_id: dbTask.patient_id,
    created_by: dbTask.created_by,
    labels: dbTask.labels,
  };
}

export function groupAiTocListRows(rows) {
  const pending = [];
  const overdue = [];
  const completed = [];
  for (const row of rows) {
    if (row.status === 'completed') completed.push(row);
    else if (row.status === 'missed' || row.overdue) overdue.push(row);
    else pending.push(row);
  }
  return { pending, overdue, completed };
}

/** Local-only preview: used until ensureAiTocTasksForPatient resolves. */
export function buildAiTocTasks(patient) {
  const count = resolveAiTaskCount(patient);
  const due = displayAiTocDue(normalizeAiTocDueDate(patient));
  const pending = AI_TOC_TASK_POOL.slice(0, count).map((t, i) => ({
    id: aiTocSourceKey(patient?.id || 'toc', i),
    ...t,
    due,
  }));
  return { pending, overdue: [], completed: [] };
}

export function buildAiTocCreatePayload(patient, template, index) {
  const sourceKey = aiTocSourceKey(patient.id, index);
  return {
    name: template.title,
    status: 'pending',
    priority: template.priority,
    due_date: normalizeAiTocDueDate(patient),
    member: patient.name,
    patient_id: patient.id,
    program_code: 'TOC',
    source_key: sourceKey,
    meta: sourceKey,
    assigned_to: patient.assignee || null,
    labels: ['AI'],
    attachments: template.attachments || 0,
    comments: template.comments || 0,
    created_by: 'TOC Agent',
    created_by_id: null,
  };
}

/** Map a list-row / DB task into the shape TaskDetailDrawer expects. */
export function toTaskPreview(task, patient, { done = false, overdue = false } = {}) {
  const status = done ? 'completed' : overdue ? 'missed' : (task.status || 'pending');
  return {
    id: task.id,
    name: task.title || task.name,
    status,
    priority: task.priority || 'medium',
    due_date: task.due_date || normalizeAiTocDueDate(patient),
    member: patient?.name || task.member || null,
    patient_id: patient?.id || task.patient_id || null,
    program_code: 'TOC',
    source_key: task.source_key,
    assigned_to: patient?.assignee || task.assigned_to || null,
    assigned_to_id: task.assigned_to_id || null,
    description: task.context || task.description || '',
    labels: task.labels || ['AI'],
    attachments: task.attachments || 0,
    comments: task.comments || 0,
    created_by: task.created_by || 'TOC Agent',
    completed_at: done ? (task.completedOn || new Date().toISOString()) : task.completed_at || null,
  };
}

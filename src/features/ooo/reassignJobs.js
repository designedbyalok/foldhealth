/**
 * Reassignment jobs: what a confirmed plan did, appointment by appointment.
 * buildJob works the outcome out (pure); the store carries it out on
 * `appointments` and saves it (reassignment_jobs).
 */
import { findConflict } from './reassignUtils';
import { dueEnd } from './openWork';
import { sameName } from './oooUtils';

// The bits of an appointment the summary shows, kept on the job so it
// still reads right after the appointment has moved or been cancelled.
export const snapshot = (a) => ({
  patientName: a.patient_name || 'Appointment',
  date: a.date,
  timeStart: a.time_start,
  timeEnd: a.time_end,
  type: a.appointment_type_name || '',
  location: (a.location || '').trim() || 'No Department',
});

/** What a reassigned task shows in the summary. */
export const taskSnapshot = (t) => ({
  name: t.name || 'Task',
  priority: t.priority || null,
  due_date: t.due_date || null,
  status: t.status || null,
  member: t.member || null,
  location: (t.location || '').trim() || 'No Department',
});

/** What a reassigned care program enrollment shows in the summary. */
export const programSnapshot = (p) => ({
  code: p.code || '',
  name: p.name || '',
  status: p.status || '',
  patientName: p.patientName || null,
  startDate: p.startDate || null,
  progress: p.progress || 0,
  location: (p.location || '').trim() || 'No Department',
});

/** What kind of item a result is (appointment results from before had none). */
export const kindOf = (r) => r.kind || 'appointment';

/** A job's counts, from all its results. */
export const jobCounts = (results) => ({
  reassignedCount: results.filter(r => r.outcome === 'reassigned').length,
  cancelledCount: results.filter(r => r.outcome === 'cancelled').length,
  conflictingCount: results.filter(r => r.conflict).length,
  failedCount: results.filter(r => r.outcome === 'failed').length,
});

/**
 * The job for a plan. Each planned appointment ends up:
 *   - failed ("Unable to Find Appointment") when the EHR no longer has it;
 *   - cancelled;
 *   - reassigned, with `conflict` set when the covering provider already
 *     has an overlapping appointment (it still goes ahead).
 * Appointments moved earlier in the same job count when checking clashes.
 */
export function buildJob({ fromUser, fromUserId, fromUserRole, type, window, oooRecordId, plan, appointments, everyone, createdBy, now = new Date() }) {
  const id = `rj-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`;
  const calendar = [...(everyone || [])];
  const results = [];
  (appointments || []).forEach((a) => {
    const p = plan[a.id];
    if (!p) return;
    const base = { appointmentId: a.id, appointment: snapshot(a) };
    // `to` is the covering provider's name (shown), `toId` who they are.
    if (a.ehr_missing) { results.push({ ...base, outcome: 'failed', to: p.to || null, toId: p.toId || null, reason: 'Unable to Find Appointment' }); return; }
    if (p.action === 'cancel') { results.push({ ...base, outcome: 'cancelled' }); return; }
    const clash = findConflict(a, { id: p.toId, name: p.to }, calendar);
    results.push({ ...base, outcome: 'reassigned', to: p.to, toId: p.toId || null, conflict: clash ? { appointmentId: clash.id, appointment: snapshot(clash) } : null });
    calendar.push({ ...a, primary_user: p.to, primary_user_id: p.toId || null });
  });
  const count = (o) => results.filter(r => r.outcome === o).length;
  return {
    id,
    fromUser,
    fromUserId: fromUserId || null,
    fromUserRole: fromUserRole || null,
    type,
    windowStart: window && Number.isFinite(window.from) ? new Date(window.from).toISOString() : null,
    windowEnd: window && Number.isFinite(window.to) ? new Date(window.to).toISOString() : null,
    oooRecordId: oooRecordId || null,
    status: 'done',
    reassignedCount: count('reassigned'),
    cancelledCount: count('cancelled'),
    conflictingCount: results.filter(r => r.conflict).length,
    failedCount: count('failed'),
    results,
    createdBy: createdBy || null,
    createdAt: now.toISOString(),
  };
}

export const jobToRow = (j) => ({
  id: j.id,
  from_user: j.fromUser,
  from_user_id: j.fromUserId || null,
  from_user_role: j.fromUserRole,
  type: j.type,
  window_start: j.windowStart,
  window_end: j.windowEnd,
  ooo_record_id: j.oooRecordId,
  status: j.status,
  reassigned_count: j.reassignedCount,
  cancelled_count: j.cancelledCount,
  conflicting_count: j.conflictingCount,
  failed_count: j.failedCount,
  results: j.results,
  created_by: j.createdBy,
  created_at: j.createdAt,
});

export const rowToJob = (r) => ({
  id: r.id,
  fromUser: r.from_user,
  fromUserId: r.from_user_id || null,
  fromUserRole: r.from_user_role,
  type: r.type,
  windowStart: r.window_start,
  windowEnd: r.window_end,
  oooRecordId: r.ooo_record_id,
  status: r.status,
  reassignedCount: r.reassigned_count,
  cancelledCount: r.cancelled_count,
  conflictingCount: r.conflicting_count,
  failedCount: r.failed_count,
  results: Array.isArray(r.results) ? r.results : [],
  createdBy: r.created_by,
  createdAt: r.created_at,
});

export const TYPE_LABELS = { ooo: 'Out of Office Reassignment', permanent: 'Permanent Reassignment', other: 'One-time Reassignment' };

/**
 * Tasks an Out of Office reassignment moved to a covering provider, while
 * that cover still runs (the job's dates haven't ended): task id → { fromUser,
 * fromUserId, to, toId }. The latest job wins when a task moved twice.
 */
export function coveredTasks(jobs, now = new Date()) {
  const t = new Date(now).getTime();
  const out = new Map();
  [...(jobs || [])]
    .filter(j => j.type === 'ooo' && (!j.windowEnd || new Date(j.windowEnd).getTime() > t))
    .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
    .forEach(j => (j.results || []).forEach((r) => {
      if (r.kind === 'task' && r.outcome === 'reassigned' && r.taskId != null) {
        out.set(String(r.taskId), { fromUser: j.fromUser, fromUserId: j.fromUserId || null, to: r.to, toId: r.toId || null });
      }
    }));
  return out;
}

/**
 * What goes back to the user when their Out of Office record is deleted or
 * shortened: the tasks and care programs its reassignment jobs moved, while
 * they're still with whoever covered them (anything since reassigned by hand,
 * or a task completed, stays put).
 *   - Deleted (no `ranges`): every such task and care program.
 *   - Shortened (`ranges` [{ from, to }] in ms, the dates taken off): tasks
 *     due on those dates. Care programs have no dates, and don't return when
 *     the record ends either, so they stay with the covering provider.
 * Returns { taskIds, programs: [{ id, to }] }; programs are checked against
 * their current assignee by the caller.
 */
export function workToReturn(jobs, { recordId, tasks = [], ranges = null }) {
  const DAY = 24 * 60 * 60 * 1000;
  const taskById = new Map((tasks || []).map(t => [String(t.id), t]));
  const taskIds = new Set();
  const programs = new Map();
  (jobs || [])
    .filter(j => j.type === 'ooo' && recordId && j.oooRecordId === recordId)
    .forEach(j => (j.results || []).forEach((r) => {
      if (r.outcome !== 'reassigned') return;
      if (r.kind === 'task') {
        const t = taskById.get(String(r.taskId));
        if (!t || t.status === 'completed' || !sameName(t.assigned_to, r.to)) return;
        if (ranges) {
          const end = dueEnd(t.due_date);
          if (Number.isNaN(end) || !ranges.some(x => end >= x.from && end - DAY < x.to)) return;
        }
        taskIds.add(t.id);
      } else if (r.kind === 'program' && !ranges && r.programId != null) {
        programs.set(String(r.programId), { id: r.programId, to: r.to });
      }
    }));
  return { taskIds: [...taskIds], programs: [...programs.values()] };
}

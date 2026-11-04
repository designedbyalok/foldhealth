/**
 * Bulk appointment jobs: what a Bulk Reschedule or a multi-appointment
 * cancel did, appointment by appointment (as reassignJobs does for
 * reassignments). The store carries the changes out on `appointments` and
 * saves the job (appointment_bulk_jobs).
 */
import { snapshot } from '../../ooo/reassignJobs';

const newId = (now) => `bj-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`;
// The appointment as it was, with whose it was (a cancel can span providers).
const before = (a) => ({ ...snapshot(a), provider: a.primary_user || '' });

function finish({ kind, provider, providerId, providerRole, reason, results, createdBy, now }) {
  return {
    id: newId(now),
    kind,
    provider: provider || null,
    providerId: providerId || null,
    providerRole: providerRole || null,
    reason: reason || null,
    status: 'done',
    doneCount: results.filter(r => r.outcome === 'done').length,
    failedCount: results.filter(r => r.outcome === 'failed').length,
    results,
    createdBy: createdBy || null,
    createdAt: now.toISOString(),
  };
}

/**
 * A Bulk Reschedule: each move and whether it saved.
 *
 * @param {{ appt, date, time_start, time_end }[]} changes
 * @param {boolean[]} saved – one per change
 */
export function buildRescheduleJob({ provider, providerId, providerRole, changes, saved, createdBy, now = new Date() }) {
  const results = changes.map((c, i) => ({
    appointmentId: c.appt.id,
    appointment: before(c.appt),
    to: { date: c.date, timeStart: c.time_start, timeEnd: c.time_end },
    outcome: saved[i] ? 'done' : 'failed',
    ...(saved[i] ? {} : { reason: 'Unable to Save the New Time' }),
  }));
  return finish({ kind: 'reschedule', provider, providerId, providerRole, results, createdBy, now });
}

/**
 * A cancel of several appointments with one reason, and whether it saved.
 * `provider` is set only when they all belong to one.
 */
export function buildCancelJob({ appointments, reason, saved, createdBy, now = new Date() }) {
  const providers = [...new Set(appointments.map(a => a.primary_user).filter(Boolean))];
  const one = providers.length === 1 ? appointments.find(a => a.primary_user === providers[0]) : null;
  const results = appointments.map(a => ({
    appointmentId: a.id,
    appointment: before(a),
    outcome: saved ? 'done' : 'failed',
    ...(saved ? {} : { reason: 'Unable to Save the Cancellation' }),
  }));
  return finish({ kind: 'cancel', provider: one?.primary_user, providerId: one?.primary_user_id, reason, results, createdBy, now });
}

export const bulkJobToRow = (j) => ({
  id: j.id,
  kind: j.kind,
  provider: j.provider,
  provider_id: j.providerId,
  provider_role: j.providerRole,
  reason: j.reason,
  status: j.status,
  done_count: j.doneCount,
  failed_count: j.failedCount,
  results: j.results,
  created_by: j.createdBy,
  created_at: j.createdAt,
});

export const rowToBulkJob = (r) => ({
  id: r.id,
  kind: r.kind,
  provider: r.provider,
  providerId: r.provider_id || null,
  providerRole: r.provider_role,
  reason: r.reason,
  status: r.status,
  doneCount: r.done_count,
  failedCount: r.failed_count,
  results: Array.isArray(r.results) ? r.results : [],
  createdBy: r.created_by,
  createdAt: r.created_at,
});

// What each kind of job is called, and what its notification says.
export const BULK_JOB_COPY = {
  reschedule: { title: 'Appointment Rescheduling Summary', ready: 'Appointment rescheduling summary is ready', done: 'Rescheduled' },
  cancel: { title: 'Appointment Cancellation Summary', ready: 'Appointment cancellation summary is ready', done: 'Cancelled' },
};

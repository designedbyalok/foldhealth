import { inlineAddPayload } from '../patient/right-panel/tabs/care-programs/care-plan/lib/carePlanInlineAdd';
import { medRecord } from './liveCallModel';

/* Wrap-up routing: what each accepted action item becomes when the call is
   completed. An item's `route` (data/scripts.js) names the record; items
   without one stay on the call record only. */

const pad = n => String(n).padStart(2, '0');
const mdy = d => `${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${d.getFullYear()}`;
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Where an accepted item lands, for the wrap-up list. */
export function routeLabel(route) {
  switch (route?.kind) {
    case 'task': return 'Creates a task';
    case 'appointment': return 'Books an appointment';
    case 'goal': return 'Adds a goal to the care plan';
    case 'barrier': return 'Adds a barrier to the care plan';
    case 'medication': return 'Updates the medication list';
    default: return 'Saved with the call';
  }
}

/** A task's due date: a fixed MM-DD-YYYY, 'today', or `dueInDays` from today. */
export function dueDateOf(route, today = new Date()) {
  if (route.dueInDays != null) { const d = new Date(today); d.setDate(d.getDate() + route.dueInDays); return mdy(d); }
  if (!route.due || route.due === 'today') return mdy(today);
  return route.due;
}

/** The patient's medication a route or edit refers to, matched on the drug's first word. */
export function findMedication(list, name) {
  const word = String(name || '').split(' ')[0].toLowerCase();
  return (list || []).find(m => String(m.name || '').toLowerCase().startsWith(word) && m.status !== 'Stopped') || null;
}

/** The task record createTask expects, as other patient views build it. */
export function taskRecord({ route, patient, pid, program, me, today }) {
  return {
    name: route.name,
    status: 'pending',
    priority: route.priority || 'medium',
    due_date: dueDateOf(route, today),
    assigned_to: me?.name || '',
    assigned_to_id: me?.id || null,
    member: patient.name,
    labels: [],
    meta: '',
    description: `From a live call on ${mdy(today)}.`,
    pool: null,
    mentions: [],
    attachments: 0,
    comments: 0,
    is_subtask: false,
    parent_task: null,
    parent_task_id: null,
    program_code: program?.code || null,
    patient_id: String(pid),
  };
}

/** The appointments row, in the Schedule drawer's shape. */
export function appointmentRecord({ route, patient, pid }) {
  return {
    patient_id: String(pid),
    patient_name: patient.name,
    appointment_type_id: null,
    appointment_type_name: route.type,
    mode: route.mode || 'At Clinic',
    location: route.location || '',
    primary_user: route.provider || '',
    secondary_users: [],
    date: route.date,
    time_start: route.start || '',
    time_end: route.end || '',
    reason_for_visit: route.reason || '',
    member_instruction: '',
    staff_instruction: 'Booked on a live call.',
    require_rsvp: false,
    recurring: false,
    recurring_config: null,
    status: 'Scheduled',
    calendar_id: 'followup',
  };
}

/**
 * Create the records for the accepted items and the medication edits. Each
 * write is independent: one failing doesn't stop the rest. Returns what was
 * done, for the toast.
 */
export async function routeAcceptedItems({ store, patient, pid, program, accepted, script, medEdits = {}, today = new Date() }) {
  const s = store.getState();
  const me = s.currentUserProfile;
  const done = { task: 0, appointment: 0, carePlan: 0, medication: 0, failed: 0 };
  const ok = (kind, result) => { if (result) done[kind] += 1; else done.failed += 1; };

  const needsMeds = accepted.some(it => it.route?.kind === 'medication') || Object.keys(medEdits).length > 0;
  if (needsMeds) await s.fetchPatientMedications?.(pid);
  const meds = () => store.getState().patientMedications?.[pid] || [];

  for (const it of accepted) {
    const route = it.route;
    if (!route) continue;
    try {
      if (route.kind === 'task') ok('task', await s.createTask(taskRecord({ route: { ...route, name: it.title === it.originalTitle ? route.name : it.title }, patient, pid, program, me, today })));
      else if (route.kind === 'appointment') ok('appointment', await s.createAppointment(appointmentRecord({ route, patient, pid })));
      else if ((route.kind === 'goal' || route.kind === 'barrier') && program) {
        const payload = inlineAddPayload(route.kind, { title: it.title });
        const save = route.kind === 'goal' ? s.savePatientCarePlanGoal : s.savePatientCarePlanBarrier;
        ok('carePlan', await save(pid, program, route.words ? { ...payload, patientTitle: route.words } : payload));
      } else if (route.kind === 'medication') {
        const found = findMedication(meds(), route.name);
        if (route.action === 'add' || !found) {
          if (route.action === 'stop') continue;
          ok('medication', await s.addPatientMedication(pid, { name: route.rename || route.name, sig: route.sig || '', start: route.start || iso(today), source: 'live call' }));
        } else if (route.action === 'stop') {
          ok('medication', await s.updatePatientMedication(pid, found.id, { status: 'Stopped', stop: iso(today), stopReason: route.reason || '' }));
        } else {
          ok('medication', await s.updatePatientMedication(pid, found.id, { ...(route.rename ? { name: route.rename } : {}), ...(route.sig ? { sig: route.sig } : {}) }));
        }
      }
    } catch (err) {
      console.warn('live call routing failed for', it.id, err);
      done.failed += 1;
    }
  }

  // Medication editor saves: the full record from the editor.
  for (const med of script.meds.filter(m => medEdits[m.n])) {
    const r = medRecord(med, medEdits[med.n]);
    const fields = { status: r.status, start: r.start, stop: r.stop, stopReason: r.reason, sig: r.sig, lastFilledOn: r.last, daysSupply: r.days === '' ? null : Number(r.days), note: r.note };
    try {
      const found = findMedication(meds(), med.n);
      ok('medication', found ? await s.updatePatientMedication(pid, found.id, fields) : await s.addPatientMedication(pid, { name: med.n, ...fields, source: 'live call' }));
    } catch (err) {
      console.warn('live call medication update failed for', med.n, err);
      done.failed += 1;
    }
  }
  return done;
}

/** "2 tasks, 1 appointment and 3 care plan items" for the completion toast. */
export function routedSummary(done) {
  const parts = [
    done.task && `${done.task} ${done.task === 1 ? 'task' : 'tasks'}`,
    done.appointment && `${done.appointment} ${done.appointment === 1 ? 'appointment' : 'appointments'}`,
    done.carePlan && `${done.carePlan} care plan ${done.carePlan === 1 ? 'item' : 'items'}`,
    done.medication && `${done.medication} medication ${done.medication === 1 ? 'update' : 'updates'}`,
  ].filter(Boolean);
  if (!parts.length) return '';
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

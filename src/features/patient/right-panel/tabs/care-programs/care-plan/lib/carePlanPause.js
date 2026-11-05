/* Care plan Pause (care_plan_pause migration): a plan-level hold.
   While paused there is no cadence, no overdue flag, no next touchpoint and
   no automated outreach. isCarePlanPaused is the one gate for all of them:
   anything that would fire on a plan's schedule must check it. Plain JS so
   the store and tests share it. */

import { isClosedStatus } from './gbiStatus';
import { parseLocalDate } from '../../../../../../../lib/localDate';

export const PAUSE_REASONS = [
  { value: 'hospitalized', label: 'Hospitalized' },
  { value: 'traveling', label: 'Traveling' },
  { value: 'patient_request', label: 'Patient request' },
  { value: 'other', label: 'Other' },
];
// Set by the system, not offered in the Pause dialog: an episodic template
// (lib/episodeTemplates) paused the plan for the length of its episode.
export const EPISODE_PAUSE_REASON = 'episode';
const REASON_LABEL = {
  ...Object.fromEntries(PAUSE_REASONS.map(r => [r.value, r.label])),
  [EPISODE_PAUSE_REASON]: 'Episode in progress',
};
export const pauseReasonLabel = (value) => REASON_LABEL[value] || 'Other';
/** The value for a picked label (ReasonDialog hands back the label). */
export const pauseReasonFromLabel = (label) => PAUSE_REASONS.find(r => r.label === label)?.value || 'other';

/** True while the plan is paused. The gate for cadence, overdue and outreach. */
export const isCarePlanPaused = (plan) => plan?.status === 'paused';

const pad = (n) => String(n).padStart(2, '0');
/** YYYY-MM-DD for a local date. */
export const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

/** Paused with auto-resume, and the resume date has arrived. */
export function isDueToAutoResume(plan, today = new Date()) {
  if (!isCarePlanPaused(plan) || !plan.pause?.autoResume) return false;
  const resumeOn = parseLocalDate(plan.pause.resumeOn);
  return !!resumeOn && resumeOn <= startOfDay(today);
}

// How far a goal's measurement cadence reaches from a date.
const FREQUENCY_STEP = {
  Daily: (d) => d.setDate(d.getDate() + 1),
  Weekly: (d) => d.setDate(d.getDate() + 7),
  Monthly: (d) => d.setMonth(d.getMonth() + 1),
  Quarterly: (d) => d.setMonth(d.getMonth() + 3),
};

/**
 * The plan's next touchpoint (YYYY-MM-DD), or null: the earliest due date
 * among open interventions (one already past due means today), else the next
 * measurement any open goal's frequency calls for, counted from today. A
 * paused plan has none. `dueDateOf(intervention)` resolves an intervention's
 * due date as the table does (override, paired task, configured duration).
 */
export function nextTouchpoint({ plan, goals = [], interventions = [] }, { today = new Date(), dueDateOf } = {}) {
  if (isCarePlanPaused(plan)) return null;
  const day = startOfDay(today);
  let earliest = null;
  const consider = (d) => { if (d && (!earliest || d < earliest)) earliest = d; };

  for (const i of interventions) {
    if (isClosedStatus(i?.status)) continue;
    const raw = dueDateOf ? dueDateOf(i) : i?.config?.dueDateOverride || i?.config?.dueDate;
    const due = raw ? parseLocalDate(raw) || startOfDay(new Date(raw)) : null;
    if (due && !Number.isNaN(due.getTime())) consider(due < day ? day : due);
  }
  if (!earliest) {
    for (const g of goals) {
      if (isClosedStatus(g?.status)) continue;
      const step = FREQUENCY_STEP[g?.frequency];
      if (!step) continue;
      const next = new Date(day);
      step(next);
      consider(next);
    }
  }
  return earliest ? isoDay(earliest) : null;
}

const fmt = (iso) => {
  const d = parseLocalDate(iso);
  return d ? `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}` : '';
};

/** The plan header fields for a pause, as the store writes them. */
export function pauseFields({ reason, note, pausedOn, resumeOn, autoResume }) {
  return {
    status: 'paused',
    reason,
    note: reason === 'other' ? (note || '').trim() : (note || '').trim() || null,
    pausedOn,
    resumeOn: resumeOn || null,
    autoResume: !!(autoResume && resumeOn),
  };
}

/** Why the pause form can't submit yet, or null. */
export function pauseFormProblem({ pausedOn, resumeOn, autoResume }) {
  if (!pausedOn) return 'Pick the date the pause starts.';
  if (resumeOn && resumeOn < pausedOn) return 'The resume date can’t be before the pause starts.';
  if (autoResume && !resumeOn) return 'Auto-resume needs a planned resume date.';
  return null;
}

/** care_plan_audit entries for a pause and a resume. */
export function pauseAuditEntry(planId, pause) {
  const reason = pauseReasonLabel(pause.reason);
  const resume = pause.resumeOn
    ? `Resumes ${fmt(pause.resumeOn)}${pause.autoResume ? ' automatically' : ''}`
    : 'No resume date';
  return {
    entityType: 'plan',
    entityId: planId,
    action: 'paused',
    summary: `Paused: ${reason}`,
    detail: [`From ${fmt(pause.pausedOn)}`, resume, pause.note].filter(Boolean).join(' · '),
  };
}

export function resumeAuditEntry(planId, { auto = false, nextTouchpoint: next = null } = {}) {
  return {
    entityType: 'plan',
    entityId: planId,
    action: 'resumed',
    summary: auto ? 'Resumed automatically on the resume date' : 'Resumed',
    detail: next ? `Next touchpoint ${fmt(next)}` : 'No upcoming touchpoint',
  };
}

/** "Hospitalized · since 10/19/2026 · resumes 10/30/2026 automatically". */
export function pauseSummary(pause) {
  if (!pause) return '';
  const parts = [pauseReasonLabel(pause.reason)];
  if ((pause.reason === 'other' || pause.reason === EPISODE_PAUSE_REASON) && pause.note) parts[0] = pause.note;
  if (pause.pausedOn) parts.push(`since ${fmt(pause.pausedOn)}`);
  if (pause.resumeOn) parts.push(`resumes ${fmt(pause.resumeOn)}${pause.autoResume ? ' automatically' : ''}`);
  else parts.push('no resume date');
  return parts.join(' · ');
}

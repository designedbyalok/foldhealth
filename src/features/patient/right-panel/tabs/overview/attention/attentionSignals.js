import { parseLocalDate } from '../../../../../../lib/localDate';
import { awaitingReply, waitLabel } from '../cards/awaitingReply';

/**
 * Needs Attention: what changed for the patient, and what is still open,
 * as a ranked list of signals with one next step each. Built only from data
 * the Overview already loads (the patient stream, the patient_overview row,
 * tasks, conversations, the P360 profile), so nothing here is invented.
 *
 * "New" means since the last touch: the newest completed touchpoint, or 30
 * days back when there is none. Standing problems (a missed appointment not
 * yet rebooked, a vital off goal, overdue work) stay listed until they are
 * resolved or someone marks them reviewed, because they still need a step.
 *
 * Signal: { id, kind, severity: 'high'|'medium'|'low', icon, title, detail,
 *   at (ms|null), isNew, action: { key, label } | null }
 * Action keys: 'schedule', 'addTask', 'reviewMeds', 'openTasks', 'reply'.
 * `id` is stable for the same underlying fact, so a review sticks to it, and
 * changes when the fact does (a new reading, another overdue task).
 */

const DAY = 24 * 3600 * 1000;
export const FALLBACK_DAYS = 30;
// Missed visits older than this are history, not something to rebook now.
// A year, so a missed annual visit still surfaces until it is rebooked.
const MISSED_LOOKBACK_DAYS = 365;
const RAF_JUMP = 0.3;
// Repeat ED use: two or more ED visits inside this window.
const ED_WINDOW_DAYS = 180;

const SEVERITY_RANK = { high: 0, medium: 1, low: 2 };
// Within a severity: care events first, then the patient waiting on us, then
// standing clinical state, then the team's own backlog.
const KIND_RANK = { adt: 0, lab: 1, appointment: 2, reply: 3, medication: 4, vital: 5, risk: 6, gap: 7, tasks: 8 };

const NOT_DONE = /scheduled|booked|confirmed|pending|draft|in progress|failed|no.?show|missed|cancel/i;

/** The newest completed touchpoint at or before `now`, or null. */
export function lastTouchAt(events, now = Date.now()) {
  const touch = (events || []).find(e => e.category === 'touchpoint'
    && e.at <= now
    && e.tone !== 'error'
    && !NOT_DONE.test(e.outcome || ''));
  return touch ? touch.at : null;
}

const fmtDate = ms => new Date(ms).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
const dateMs = (s) => {
  const d = parseLocalDate(s);
  return d ? d.getTime() : null;
};

function missedAppointments(events, now) {
  const appts = events.filter(e => e.kind === 'appointment');
  return appts
    .filter(e => e.at < now - DAY && e.at >= now - MISSED_LOOKBACK_DAYS * DAY)
    .filter(e => /no.?show|missed|cancel|scheduled|booked|confirmed/i.test(e.outcome || ''))
    // Rebooked: a later visit of the same kind is already on the calendar.
    .filter(e => !appts.some(o => o.title === e.title && o.at > now))
    .map((e) => {
      const noShow = /no.?show|missed/i.test(e.outcome || '');
      const cancelled = /cancel/i.test(e.outcome || '');
      return {
        id: `appt:${e.id}`,
        kind: 'appointment',
        severity: noShow ? 'high' : 'medium',
        icon: 'solar:calendar-mark-linear',
        title: `${cancelled ? 'Cancelled' : 'Missed'} ${e.title}`,
        detail: [fmtDate(e.at), noShow || cancelled ? e.outcome : 'Never checked in', 'Not rebooked'].join(' • '),
        at: e.at,
        action: { key: 'schedule', label: 'Reschedule' },
      };
    });
}

function streamChanges(events, since) {
  return events.filter(e => e.at >= since).flatMap((e) => {
    if (e.kind === 'lab' && e.outcome === 'Out of range') {
      return [{
        id: `lab:${e.id}`, kind: 'lab', severity: 'high', icon: 'solar:test-tube-linear',
        title: `Abnormal lab: ${e.title}`,
        detail: [fmtDate(e.at), e.detail].filter(Boolean).join(' • '),
        at: e.at, action: { key: 'addTask', label: 'Create Task' },
      }];
    }
    if (e.kind === 'adt' && e.tone === 'warning') {
      return [{
        id: `adt:${e.id}`, kind: 'adt', severity: 'high', icon: 'solar:hospital-linear',
        title: e.title,
        detail: [fmtDate(e.at), e.outcome ? `Follow-up: ${e.outcome}` : 'Follow-up not planned'].join(' • '),
        at: e.at, action: { key: 'addTask', label: 'TOC Task' },
      }];
    }
    if (e.kind === 'med_start' || e.kind === 'med_stop') {
      return [{
        id: `med:${e.id}`, kind: 'medication', severity: 'medium', icon: 'solar:pill-linear',
        title: e.title,
        detail: [fmtDate(e.at), e.outcome].filter(Boolean).join(' • '),
        at: e.at, action: { key: 'reviewMeds', label: 'Review Meds' },
      }];
    }
    return [];
  });
}

// ED visits recorded as encounters (claims) rather than ADT feeds: repeat use
// is the signal, since a single past visit is history the Recap already shows.
function edUtilization(events, now) {
  const ed = events.filter(e => e.kind === 'encounter' && /emergency|\bED\b/i.test(e.title || '')
    && e.at <= now && e.at >= now - ED_WINDOW_DAYS * DAY);
  if (ed.length < 2) return [];
  return [{
    id: `ed:${ed.map(e => e.id).sort().join(',')}`,
    kind: 'adt',
    severity: 'high',
    icon: 'solar:hospital-linear',
    title: `${ed.length} ED visits in 6 months`,
    detail: ed.map(e => fmtDate(e.at)).join(' • '),
    at: ed[0].at,
    action: { key: 'addTask', label: 'Create Task' },
  }];
}

// The patient_overview row marks a vital off goal with tone 'error'.
function vitalsOffGoal(vitals) {
  return (vitals || []).filter(v => v.tone === 'error' && v.value != null).map((v) => {
    const trend = v.change ? `${v.direction === 'down' ? '↓' : '↑'} ${v.change}` : null;
    return {
      id: `vital:${v.key}:${v.measuredAt || ''}:${v.value}`,
      kind: 'vital',
      label: v.label,
      severity: 'medium',
      icon: 'solar:heart-pulse-linear',
      title: `${v.label} ${v.value}${v.unit ? `${v.unit === '%' ? '' : ' '}${v.unit}` : ''}`,
      detail: [v.goalTo && `Goal ${v.goalTo}`, trend, v.measuredAt].filter(Boolean).join(' • '),
      at: dateMs(v.measuredAt),
      action: { key: 'addTask', label: 'Create Task' },
    };
  });
}

function overdueGaps(gaps, now) {
  return (gaps || []).flatMap((g) => {
    const due = String(g.detail || '').match(/Due (\d{1,2}\/\d{1,2}\/\d{4})/);
    const dueAt = due ? dateMs(due[1]) : null;
    if (!dueAt || dueAt >= now || !/open/i.test(g.status || '')) return [];
    return [{
      id: `gap:${g.id}`,
      kind: 'gap',
      severity: 'medium',
      icon: 'solar:danger-triangle-linear',
      title: `Overdue: ${g.title}`,
      detail: g.detail,
      at: dueAt,
      action: { key: 'addTask', label: 'Create Task' },
    }];
  });
}

function overdueTasks(overdue) {
  if (!overdue?.length) return [];
  const ids = overdue.map(t => t.id).sort().join(',');
  return [{
    id: `tasks:${ids}`,
    kind: 'tasks',
    severity: 'medium',
    icon: 'solar:checklist-minimalistic-linear',
    title: `${overdue.length} overdue task${overdue.length === 1 ? '' : 's'}`,
    detail: overdue.slice(0, 2).map(t => t.title).join(' • '),
    at: dateMs(overdue[0].due),
    action: { key: 'openTasks', label: 'Open Tasks' },
  }];
}

function unanswered(conversations, now) {
  const waiting = awaitingReply(conversations);
  if (!waiting.length) return [];
  const oldest = waiting[0];
  const wait = waitLabel(oldest.last_message_at, now);
  return [{
    id: `reply:${waiting.map(c => `${c.id}@${c.last_message_at}`).join(',')}`,
    kind: 'reply',
    severity: wait.tone === 'error' ? 'high' : 'medium',
    icon: 'solar:chat-unread-linear',
    title: `${waiting.length} message${waiting.length === 1 ? '' : 's'} awaiting reply`,
    detail: [`Oldest waiting ${wait.label}`, oldest.assigned_to ? `Reply: ${oldest.assigned_to}` : 'Unassigned'].join(' • '),
    at: new Date(oldest.last_message_at).getTime() || null,
    action: { key: 'reply', label: 'Reply' },
    conversation: oldest,
  }];
}

function riskJump(profile) {
  const change = Number(profile?.raf_change) || 0;
  if (change < RAF_JUMP) return [];
  return [{
    id: `raf:${profile.raf_score}`,
    kind: 'risk',
    severity: 'medium',
    icon: 'solar:graph-up-linear',
    title: `RAF up ${change} to ${profile.raf_score}`,
    detail: profile.acuity ? `Acuity ${profile.acuity}` : 'Since the last score',
    at: null,
    action: null,
  }];
}

/**
 * @returns {{ since: number, sinceIsLastTouch: boolean, signals: Array }}
 */
export function buildAttentionSignals({
  events = [], vitals, gaps, overdue, conversations, profile, now = Date.now(),
} = {}) {
  const touch = lastTouchAt(events, now);
  const since = touch ?? now - FALLBACK_DAYS * DAY;
  const signals = [
    ...streamChanges(events, since),
    ...missedAppointments(events, now),
    ...edUtilization(events, now),
    ...unanswered(conversations, now),
    ...vitalsOffGoal(vitals),
    ...overdueTasks(overdue),
    ...overdueGaps(gaps, now),
    ...riskJump(profile),
  ].map(s => ({ ...s, isNew: s.at != null && s.at >= since }));

  signals.sort((a, b) => (SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
    || (Number(b.isNew) - Number(a.isNew))
    || ((KIND_RANK[a.kind] ?? 9) - (KIND_RANK[b.kind] ?? 9))
    || ((b.at ?? 0) - (a.at ?? 0)));
  return { since, sinceIsLastTouch: touch != null, signals };
}

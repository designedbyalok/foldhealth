/* Episodic care plan templates (care_plan_episodic_templates migration).
   An episodic template covers one event (a transition of care, a home health
   episode) instead of an ongoing condition. Applied, it runs from day 1 to day
   `episodeDays` and then closes on its own, or runs until someone closes it
   when there is no length. While it runs it can pause the patient's other
   care plans. Plain JS so the store and tests share it. */

import { parseLocalDate } from '../../../../../../../lib/localDate';

/** Common episode lengths, offered as presets when a template is set up. */
export const EPISODE_PRESETS = [
  { key: 'toc-ip', days: 30, label: '30 days', hint: 'Inpatient discharge (TOC-IP)' },
  { key: 'toc-ed', days: 14, label: '14 days', hint: 'Emergency department visit (TOC-ED)' },
  { key: 'until-closed', days: null, label: 'Until closed', hint: 'Home health and other episodes with no fixed end. Ends when someone closes it.' },
];

export const DEFAULT_EPISODE_DAYS = 30;
export const MAX_EPISODE_DAYS = 365;

/** Days left at or under this show the episode as ending soon. */
const ENDING_SOON_DAYS = 3;

/** The template's episode settings, or null when it is not episodic. */
export function episodeOf(template) {
  if (!template?.episodic) return null;
  const days = Number(template.episodeDays);
  return {
    days: Number.isInteger(days) && days > 0 ? days : null,
    pausesOngoing: template.episodePausesOngoing !== false,
  };
}

/** "30-day episode" / "Episode until closed", for badges and titles. */
export function episodeLengthLabel(days) {
  return days ? `${days}-day episode` : 'Episode until closed';
}

const pad = (n) => String(n).padStart(2, '0');
const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
// A date-only string is a local calendar day; a timestamp (started_at) is
// read in local time, since slicing its UTC date can land on the next day.
const toDay = (value) => {
  if (!value) return null;
  if (value instanceof Date) return startOfDay(value);
  const s = String(value);
  const d = s.length > 10 ? new Date(s) : parseLocalDate(s);
  return d && !Number.isNaN(d.getTime()) ? startOfDay(d) : null;
};
const DAY_MS = 24 * 60 * 60 * 1000;
const daysBetween = (from, to) => Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS);

/** The last day of an episode that starts on `start` (day 1) and lasts `days`. Null when open-ended. */
export function episodeEndsOn(start, days) {
  if (!days) return null;
  const d = startOfDay(start);
  d.setDate(d.getDate() + days - 1);
  return isoDay(d);
}

/** The day after `iso`, as YYYY-MM-DD: when plans paused for an episode resume. */
export function dayAfter(iso) {
  const d = toDay(iso);
  if (!d) return null;
  d.setDate(d.getDate() + 1);
  return isoDay(d);
}

/**
 * Where an active episodic run is: `day` (1 on the day it started),
 * `totalDays` (null when open-ended), `daysLeft` including today (null when
 * open-ended), `endingSoon`, and `due` once its last day has passed.
 */
export function episodeProgress(run, today = new Date()) {
  const start = toDay(run?.startedAt);
  const end = toDay(run?.endsOn);
  const now = startOfDay(today);
  const day = start ? Math.max(1, daysBetween(start, now) + 1) : null;
  const totalDays = start && end ? daysBetween(start, end) + 1 : null;
  const daysLeft = end ? daysBetween(now, end) + 1 : null;
  return {
    day,
    totalDays,
    daysLeft,
    endingSoon: daysLeft != null && daysLeft > 0 && daysLeft <= ENDING_SOON_DAYS,
    due: !!end && now > end,
  };
}

/** An active episodic run whose last day has passed: it closes when the plan is next opened. */
export function isEpisodeDue(run, today = new Date()) {
  return !!run?.episodic && run.status === 'active' && episodeProgress(run, today).due;
}

/** The pause note on a plan paused for an episode. */
export function episodePauseNote(templateName) {
  return `${templateName || 'Care plan'} episode`;
}

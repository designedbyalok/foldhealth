import { parseLocalDate } from '../../../../../../lib/localDate';

/**
 * Appointments in the recent past the patient didn't attend: no-shows,
 * cancellations, and visits still marked scheduled after their date (never
 * checked in). Each says whether a later visit of the same kind is already
 * booked, so the care team can see what still needs rescheduling.
 *
 * @param {Array} events – patient stream events (data/patientStream.js); appointments
 *   have kind 'appointment', title = appointment type, outcome = status, actor = provider
 * @param {Array} [upcoming] – P360 upcoming appointments ({ date, type }), also counted as rebooked
 * @returns {Array<{ id, at, title, provider, status, reason, rebookedAt }>} newest first
 */

const DAY = 24 * 3600 * 1000;
const NO_SHOW = /no.?show|missed/i;
const CANCELLED = /cancel/i;
const STILL_BOOKED = /scheduled|booked|confirmed|pending/i;

const sameKind = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

// A year back, the same window the Recap's missed-visit item uses, so the two agree.
export const MISSED_LOOKBACK_DAYS = 365;

export function missedAppointments({ events = [], upcoming = [], now = Date.now(), days = MISSED_LOOKBACK_DAYS } = {}) {
  const appts = events.filter(e => e.kind === 'appointment' && Number.isFinite(e.at));
  const future = [
    ...appts.filter(e => e.at > now).map(e => ({ title: e.title, at: e.at })),
    ...upcoming
      .map(u => ({ title: u.type, at: parseLocalDate(u.date)?.getTime() }))
      .filter(u => Number.isFinite(u.at) && u.at > now),
  ];

  return appts
    // A visit is only "never checked in" once its day is over.
    .filter(e => e.at < now - DAY && e.at >= now - days * DAY)
    .flatMap((e) => {
      const status = e.outcome || '';
      let reason = null;
      if (NO_SHOW.test(status)) reason = 'No show';
      else if (CANCELLED.test(status)) reason = 'Cancelled';
      else if (STILL_BOOKED.test(status)) reason = 'Never checked in';
      if (!reason) return [];
      const rebooked = future.filter(f => sameKind(f.title, e.title)).sort((a, b) => a.at - b.at)[0];
      return [{
        id: e.id,
        at: e.at,
        title: e.title,
        provider: e.actor || null,
        status,
        reason,
        rebookedAt: rebooked ? rebooked.at : null,
      }];
    })
    .sort((a, b) => b.at - a.at);
}

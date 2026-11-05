import { parseLocalDate } from '../../../../../../lib/localDate';

/**
 * Which active care programs need someone to act, and why, for the
 * Overview's programs card. Flagged programs come first; the rest are on
 * track. Reads only the enrollment's own fields.
 *
 *  Unable to reach / Declined   the patient isn't engaging (error)
 *  No owner                     nobody is assigned (warning)
 *  Attempted                    outreach tried, not yet engaged (warning)
 *  Paused                       (warning)
 *  Not started                  still New with no progress 14 days after enrollment (warning)
 *  Ends soon                    planned end within 30 days (info)
 */

const DAY = 24 * 3600 * 1000;
const TONE_RANK = { error: 0, warning: 1, info: 2 };

function reasonFor(p, now) {
  const status = p.status || '';
  if (/unable to reach/i.test(status)) return { reason: 'Unable to reach', tone: 'error' };
  if (/declined/i.test(status)) return { reason: 'Declined', tone: 'error' };
  if (!p.assignee || p.assignee === 'Unassigned') return { reason: 'No owner', tone: 'warning' };
  if (/attempted/i.test(status)) return { reason: 'Outreach attempted', tone: 'warning' };
  if (/paused/i.test(status)) return { reason: 'Paused', tone: 'warning' };
  const start = parseLocalDate(p.startDate)?.getTime();
  if (/^new$/i.test(status) && !Number(p.progress) && start != null && now - start > 14 * DAY) {
    return { reason: 'Not started', tone: 'warning' };
  }
  const end = parseLocalDate(p.plannedEndDate)?.getTime();
  if (end != null && end >= now && end - now <= 30 * DAY) {
    return { reason: `Ends ${p.plannedEndDate}`, tone: 'info' };
  }
  return null;
}

/** [{ program, reason, tone }] for flagged programs first, then the rest with reason null. */
export function programAttention(programs = [], now = Date.now()) {
  const rows = programs.map((program) => {
    const why = reasonFor(program, now);
    return { program, reason: why?.reason || null, tone: why?.tone || null };
  });
  return rows.sort((a, b) => (a.tone ? TONE_RANK[a.tone] : 9) - (b.tone ? TONE_RANK[b.tone] : 9));
}

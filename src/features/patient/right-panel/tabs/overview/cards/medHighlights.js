import { parseLocalDate } from '../../../../../../lib/localDate';

/**
 * What changed in a patient's medications, for the Overview card: started or
 * stopped in the last RECENT_DAYS, and refills due within REFILL_LEAD_DAYS
 * (or already run out). Read from recorded fields only: start_date,
 * stop_date, last_filled_on and days_supply. A medication without a fill
 * date or a supply is never flagged for refill.
 *
 * Returns { rows, counts }: rows are the active medications plus recently
 * stopped ones, changes first (out, refill due, new, stopped), each
 * { med, change, date } with change null when nothing changed.
 */

export const RECENT_DAYS = 90;
export const REFILL_LEAD_DAYS = 7;
const DAY = 24 * 3600 * 1000;
const RANK = { out: 0, refill: 1, new: 2, stopped: 3 };

const startOfDay = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };

export function medHighlights(meds = [], now = Date.now()) {
  const today = startOfDay(now);
  const since = today - RECENT_DAYS * DAY;
  const rows = [];
  for (const med of meds) {
    const stopped = med.status === 'Stopped';
    if (stopped) {
      const stop = parseLocalDate(med.stop)?.getTime();
      if (stop != null && stop >= since && stop <= today) rows.push({ med, change: 'stopped', date: stop });
      continue;
    }
    const filled = parseLocalDate(med.lastFilledOn)?.getTime();
    const supply = Number(med.daysSupply);
    const runsOut = filled != null && supply > 0 ? filled + supply * DAY : null;
    const start = parseLocalDate(med.start)?.getTime();
    if (runsOut != null && runsOut < today) rows.push({ med, change: 'out', date: runsOut });
    else if (runsOut != null && runsOut <= today + REFILL_LEAD_DAYS * DAY) rows.push({ med, change: 'refill', date: runsOut });
    else if (start != null && start >= since && start <= today) rows.push({ med, change: 'new', date: start });
    else rows.push({ med, change: null, date: null });
  }
  rows.sort((a, b) => (RANK[a.change] ?? 9) - (RANK[b.change] ?? 9)
    // Refills: soonest first. Starts and stops: most recent first.
    || (a.change === 'out' || a.change === 'refill' ? a.date - b.date : (b.date ?? 0) - (a.date ?? 0)));
  const counts = { out: 0, refill: 0, new: 0, stopped: 0 };
  rows.forEach(r => { if (r.change) counts[r.change] += 1; });
  return { rows, counts };
}

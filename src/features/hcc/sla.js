// SLA logic for the HCC (Astrana, DOS-structured) worklist.
//
// Confirmed rules (Prospect / Astrana working sessions):
//  • 14-calendar-day window. The clock starts at Support-Team receipt, which
//    the worklist represents as the record's Created Date ("when it gets
//    loaded"): and ends at Coder / Reviewer-1 completion.
//  • On breach the record is simply flagged "Overdue" (no re-routing).
//  • The window is NOT hardcoded, it is configurable per client/tenant. The
//    default lives here so a future per-tenant org setting can override it in
//    one place.
//  • SLA weighting applies only to the DOS-structured (Astrana) worklist;
//    member-level, non-DOS worklists sort by plain date ordering only.

export const SLA_CONFIG = {
  windowDays: 14, // Support-Team receipt (Created Date) → Coder completion
  dueSoonDays: 3, // flag amber when this many calendar days or fewer remain
};

const MS_PER_DAY = 86400000;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// "MM/DD/YYYY" → Date at local midnight; null if unparseable/absent.
function parseMDY(value) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(value || '').trim());
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * computeSla: SLA state for a Created Date on the DOS worklist.
 *
 * elapsed   = today − createdDate (calendar days)
 * remaining = windowDays − elapsed  (negative once breached)
 *
 * @param {string} createdDate  "MM/DD/YYYY"
 * @param {{windowDays:number,dueSoonDays:number}} [cfg]
 * @returns {{status:'overdue'|'due-soon'|'on-track', remaining:number, elapsed:number, label:string, colorVar:string}|null}
 */
export function computeSla(createdDate, cfg = SLA_CONFIG) {
  const created = parseMDY(createdDate);
  if (!created) return null;

  const elapsed = Math.round((startOfDay(new Date()) - startOfDay(created)) / MS_PER_DAY);
  const remaining = cfg.windowDays - elapsed;

  if (remaining < 0) {
    const over = -remaining;
    return {
      status: 'overdue',
      remaining,
      elapsed,
      colorVar: 'var(--status-error)',
      label: over >= 7 ? `Overdue: ${Math.floor(over / 7)}w` : `Overdue: ${over}d`,
    };
  }
  if (remaining <= cfg.dueSoonDays) {
    return {
      status: 'due-soon',
      remaining,
      elapsed,
      colorVar: 'var(--status-warning)',
      label: remaining === 0 ? 'Due today' : `Due in ${remaining}d`,
    };
  }
  return {
    status: 'on-track',
    remaining,
    elapsed,
    // Blue as the SLA clock ticks down within the week, calm grey when there's
    // still plenty of runway.
    colorVar: remaining <= 7 ? 'var(--status-info)' : 'var(--neutral-300)',
    label: `Due in ${remaining}d`,
  };
}

/**
 * slaOutcome: the resolved SLA verdict once Support AND Coder are done.
 * "SLA Met" when the Coder completed within the 14-day window from the Created
 * Date, otherwise "SLA Breached". Uses the real Coder completion timestamp
 * when available; falls back to today as the completion proxy.
 *
 * @param {string} createdDate      "MM/DD/YYYY"
 * @param {string|null} coderDoneAt ISO datetime of the Coder completion (or null)
 * @returns {{met:boolean,label:string,colorVar:string,icon:string}|null}
 */
export function slaOutcome(createdDate, coderDoneAt, cfg = SLA_CONFIG) {
  const created = parseMDY(createdDate);
  if (!created) return null;
  const due = startOfDay(new Date(created.getTime() + cfg.windowDays * MS_PER_DAY));
  let completed = null;
  if (coderDoneAt) {
    const d = new Date(coderDoneAt);
    completed = Number.isNaN(d.getTime()) ? null : d;
  }
  const met = startOfDay(completed || new Date()) <= due;
  return met
    ? { met: true,  label: 'SLA Met',      colorVar: 'var(--status-success)', icon: 'solar:check-circle-linear' }
    : { met: false, label: 'SLA Breached', colorVar: 'var(--status-error)',   icon: 'solar:close-circle-linear' };
}

/**
 * Map a record's live SLA state to the Due Date filter buckets, so the
 * "Due Date" filter agrees with the colour-coded Created Date column (rather
 * than the legacy static `due` string). The SLA clock stops at Coder
 * (Reviewer 1) completion: resolved records fall into no bucket.
 *
 * Buckets mirror DUE_OPTIONS: Overdue / Due Today / Due This Week /
 * Due Next Week / Due More Than 2 Weeks.
 *
 * @returns {string|null}
 */
export function slaDueCategory(member, cfg = SLA_CONFIG) {
  if (member?.cdrS === 'Completed') return null;
  const sla = computeSla(member?.date, cfg);
  if (!sla) return null;
  if (sla.status === 'overdue') return 'Overdue';
  const r = sla.remaining;
  if (r === 0) return 'Due Today';
  if (r <= 7) return 'Due This Week';
  if (r <= 14) return 'Due Next Week';
  return 'Due More Than 2 Weeks';
}

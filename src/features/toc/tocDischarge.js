/* TOC IP discharge workflow (care management redesign prototype): the
   2-business-day interactive contact, the agent relay, the face-to-face
   visit window and medication reconciliation, read from the TOC row. */

const DAY_MS = 86400000;
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad = n => String(n).padStart(2, '0');
const mmdd = d => `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
const dayOf = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const daysBetween = (a, b) => Math.round((dayOf(b) - dayOf(a)) / DAY_MS);

export function parseMdy(mdy) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(mdy || '');
  return m ? new Date(+m[3], +m[1] - 1, +m[2]) : null;
}

/** `n` business days after `date` (weekends skipped). */
export function addBusinessDays(date, n) {
  const d = dayOf(date);
  let left = n;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) left -= 1;
  }
  return d;
}

/** Interactive contact: due by end of day 2 business days after discharge. */
export function contactState(p, now = new Date()) {
  const met = parseMdy(p.contactMetAt);
  if (met) return { label: `Met ${mmdd(met)}`, tone: 'success', sort: 3 };
  const discharged = parseMdy(p.dischargeDate);
  if (!discharged) return { label: '-', tone: 'neutral', sort: 4 };
  const due = addBusinessDays(discharged, 2);
  const late = daysBetween(due, now);
  if (late > 0) return { label: `Overdue ${late}d`, tone: 'danger', sort: 0 };
  if (late === 0) return { label: 'Today 5:00 PM', tone: 'danger', sort: 1 };
  return { label: `${WEEKDAY[due.getDay()]} ${mmdd(due)}`, tone: 'warning', sort: 2 };
}

/**
 * Face-to-face visit after discharge. Inpatient (TCM): 7 days when the
 * transition is high complexity (99496), else 14 (99495); TOC Acuity stands
 * in for complexity unless the row sets `visitWindowDays` (e.g. 7 after a
 * psychiatric stay, HEDIS FUH). An ED visit isn't TCM-eligible: it gets the
 * 7-day ED follow-up instead, labelled as such.
 */
export function visitState(p, now = new Date()) {
  const ed = p.tocType === 'ED';
  const days = p.visitWindowDays || (ed || String(p.lace).toLowerCase() === 'high' ? 7 : 14);
  const kind = ed ? `ED ${days}-day` : `${days}-day`;
  const booked = parseMdy(p.visitBookedAt);
  if (booked) return { label: `${kind} booked ${mmdd(booked)}`, tone: 'success' };
  const discharged = parseMdy(p.dischargeDate);
  if (!discharged) return { label: '-', tone: 'neutral' };
  const by = new Date(discharged.getTime() + days * DAY_MS);
  const left = daysBetween(now, by);
  if (left < 0) return { label: `${kind} missed`, tone: 'danger' };
  return { label: `${kind} by ${WEEKDAY[by.getDay()]} ${mmdd(by)}`, tone: left <= 2 ? 'warning' : 'neutral' };
}

/** What the agent (or care manager) has done with the patient so far. */
export function relayState(p) {
  const agent = p.relayBy || p.agentAssigned || 'Agent';
  if (p.relayStatus === 'live') return { label: `${agent} holding for RN`, sub: p.relayNote || 'Live call', tone: 'primary' };
  if (p.relayStatus === 'attempts') {
    const n = p.relayAttempts || 1;
    return { label: `${agent}: ${n} ${n === 1 ? 'attempt' : 'attempts'}`, sub: p.relayNote || "Agent calls don't count as TCM contact", tone: 'warning' };
  }
  if (p.relayStatus === 'completed') return { label: `${agent} completed`, sub: p.relayNote || '', tone: 'success' };
  return { label: 'Not started', sub: '', tone: 'neutral' };
}

/** Medication reconciliation after discharge. */
export function medRecState(p) {
  if (p.medRecStatus === 'Done') {
    const at = parseMdy(p.medRecAt);
    return { label: at ? `Done ${mmdd(at)}` : 'Done', tone: 'success' };
  }
  if (p.medRecStatus === 'Pending') return { label: 'Pending', tone: 'warning' };
  return { label: 'Not started', tone: 'neutral' };
}

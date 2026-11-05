import { cycleStart, daysFromToday, isActiveGap, parseMdy, prescribersOf } from './pharmacyWorklist.utils';

// Outreach and escalation rules from the status model spec
// (onboarding call; Sessions 1, 4 and 5; prototype review). Pure functions of
// an enriched member (enrichPharmacyMember) so the worklist, the drawer and
// the store read them the same way. Thresholds marked "to confirm" are open
// questions for Monique and Astrana.

// Queue timing: a member enters outreach when a fill or fail date is within
// 14 days (onboarding call). The PDC spec says 7 days to supply end; to confirm.
export const QUEUE_WINDOW_DAYS = 14;

// Escalation (Session 4): after two failed attempts a borderline PDC goes to
// the prescriber; a comfortable PDC waits for a third. "Borderline" is below
// 85% here (the examples were 72% and 89.5%); to confirm.
export const BORDERLINE_PDC = 85;
const PRESCRIBER_CONTACTS = /prescriber|provider|physician|\bmd\b|doctor/i;
// Calls that were not an attempt to reach the member.
const NOT_MEMBER_CONTACTS = /pharmac/i;

export function inOutreachQueue(gap) {
  if (!isActiveGap(gap.status)) return false;
  const near = (mdy) => { const d = daysFromToday(mdy); return d != null && d <= QUEUE_WINDOW_DAYS; };
  return near(gap.nextFillDue) || near(gap.failDate);
}

// Failed attempts to reach the member on this gap since the last success this
// fill cycle, newest first. A prescriber call since then means the gap was
// already escalated.
function failedAttempts(gap, member) {
  const from = cycleStart(gap);
  let count = 0;
  for (const c of member.callHistory || []) {
    if (!(c.measures || []).includes(gap.code) || (parseMdy(c.date) || 0) < from) continue;
    if (PRESCRIBER_CONTACTS.test(c.contact || '')) return { count, escalated: true };
    if (c.kind === 'pharmacy-verification' || c.result === 'note' || NOT_MEMBER_CONTACTS.test(c.contact || '')) continue;
    if (c.result === 'success') break;
    count += 1;
  }
  return { count, escalated: false };
}

// Whether the gap goes to the prescriber of its drug now (not the PCP).
export function escalation(gap, member) {
  if (!isActiveGap(gap.status)) return null;
  const { count, escalated } = failedAttempts(gap, member);
  if (escalated) return null;
  const borderline = gap.pdc != null && gap.pdc < BORDERLINE_PDC;
  const needed = borderline ? 2 : 3;
  if (count < needed) return null;
  const prescriber = prescribersOf({ measures: [gap] })[0] || null;
  return {
    prescriber,
    attempts: count,
    reason: `${count} failed attempts to reach the member and PDC ${gap.pdc ?? 'unknown'}%${borderline ? ' (borderline)' : ''}`,
  };
}

// Health plans and IPAs in the pharmacy gap files, for routing rules in the
// Care Teams drawer, until the plan files feed a shared plan / IPA list.
export const PHARMACY_ROUTING_VALUES = {
  'Health Plan': ['Aetna Medicare Advantage', 'Blue Shield Medicare', 'Humana Gold Plus', 'SCAN Classic'],
  IPA: ['Astrana IPA', 'Prospect Medical Group'],
};

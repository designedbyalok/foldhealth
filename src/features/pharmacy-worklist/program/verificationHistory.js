import { toActivityLogEntries } from '../../hedis-worklist/CareGapDetailDrawer.utils';

// Saved titles join their parts with a middle dot (·); show the same bullet
// (•) the meta line above them uses.
export const withBullets = (text) => (typeof text === 'string' ? text.replaceAll(' · ', ' • ') : text);

// Calls saved before any party could be picked were all to the pharmacy.
export const VERIFICATION_TITLE = /^(Pharmacy verification|Verification call)/;
const VERIFICATION_ANSWER = /^(MAD|MAH|MAC) · (.+?): (.+)$/;

// A verification call saves its answers as "MAD · Drug: steps" lines ahead of
// the call note; show them as one row per drug, the rest as the note.
export function withVerificationDetails(e) {
  if (!VERIFICATION_TITLE.test(e.title || '') || !e.note) return e;
  const lines = e.note.split('\n');
  const details = [];
  const rest = [];
  for (const line of lines) {
    const hit = line.match(VERIFICATION_ANSWER);
    if (hit) details.push({ label: `${hit[1]} • ${hit[2]}`, value: hit[3] });
    else rest.push(line);
  }
  return details.length ? { ...e, details, note: rest.join('\n') } : e;
}

// A member's locked verification calls as Activity timeline entries, newest
// first, each with its per-drug answers behind View details.
export function verificationTimeline(member) {
  const raw = (member?.activityLog || [])
    .filter(e => VERIFICATION_TITLE.test(e.title || ''))
    .map(withVerificationDetails)
    .map(e => ({ ...e, when: e.at, title: withBullets(e.title), note: withBullets(e.note), outcome: withBullets(e.outcome) }));
  return toActivityLogEntries(raw);
}

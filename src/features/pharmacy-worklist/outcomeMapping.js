// Outreach outcome (Medication Adherence Intervention Schema) → the Barrier &
// Intervention picklists, so a barrier or intervention captured while logging
// outreach also lands in that measure's Barrier & Intervention log.
// Keys are matched on the outcome label without its "Stakeholder · " prefix.

const RULES = [
  // Barriers
  { match: /^cost\/financial barrier|^cost or insurance coverage issues/, barrier: 'Cost Issue' },
  { match: /^insurance coverage issue/, barrier: 'Insurance Coverage' },
  { match: /^forgetfulness or confusion/, barrier: 'Forgetfulness' },
  { match: /^side effects/, barrier: 'Side Effects' },
  { match: /^transportation barrier/, barrier: 'Transportation' },
  { match: /^does not want to take medication/, barrier: 'Refused to Refill' },
  // Interventions
  { match: /^new 90\/100ds conversion|^max day supply 90-100/, intervention: '90/100-day conversion' },
  { match: /^enrolled in auto-refill/, intervention: 'Autofill Set-Up' },
  { match: /^pill box organizer sent/, intervention: 'Pill Box Sent' },
  { match: /^follow up appointment\/lab(?: \u2014|:) appointment scheduled|^need follow up appointment/, intervention: 'Schedule MD Appointment/Labs' },
  // Results
  { match: /^confirmed medication pickup/, result: 'Rx Pick Up Confirmed' },
  { match: /^pending(?: \u2014|:) pick up|^notification\/reminder medication ready for pickup/, result: 'Rx Pick Up Pending' },
  { match: /^pending(?: \u2014|:) refill approval|^refill approval pending|^refill approval sent to pharmacy/, result: 'Pending Refill Approval' },
  { match: /^medication (changed|discontinued|paused|stopped)/, result: 'Rx Changed/Discontinued by MD or Member' },
];

const stripStakeholder = (o) => (o.includes(' · ') ? o.split(' · ').slice(1).join(' · ') : o);

// Outcomes for one measure → { barriers, interventions, result } (result =
// the last mapped one). Returns null when nothing maps.
export function mapOutcomesToIntervention(outcomes) {
  const rec = { barriers: [], interventions: [], result: null };
  for (const raw of outcomes || []) {
    const label = stripStakeholder(raw || '').toLowerCase();
    for (const r of RULES) {
      if (!r.match.test(label)) continue;
      if (r.barrier && !rec.barriers.includes(r.barrier)) rec.barriers.push(r.barrier);
      if (r.intervention && !rec.interventions.includes(r.intervention)) rec.interventions.push(r.intervention);
      if (r.result) rec.result = r.result;
    }
  }
  return rec.barriers.length || rec.interventions.length || rec.result ? rec : null;
}

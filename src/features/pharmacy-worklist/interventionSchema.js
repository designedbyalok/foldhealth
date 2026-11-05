// Medication Adherence Intervention Schema (MAD / MAH / MAC outreach).
// Source: "Medication Adherence Intervention Schema" PDF.
//
// Each stakeholder has:
//   contactOutcomes: results of reaching (or not reaching) the contact.
//   measureOutcomes: interventions logged against a measure. An entry with
//                     `options` is picked as "Label: Option".

const MEMBER_CONTACT = [
  'Expired', 'In hospice', 'In LTC/SNF', 'Opt-Out', 'Termed', 'Out of state/country',
  'Requested a call back', 'Uncooperative', 'UTC', 'Wrong Number',
];

const MEMBER_MEASURE = [
  { label: 'Confirmed medication pickup' },
  { label: 'New 90/100DS conversion' },
  { label: 'Cost/financial barrier' },
  { label: 'Discussed daily medication routine and timing' },
  { label: 'Does not want to take medication' },
  { label: 'Document patient-reported adherence level (e.g., missed doses in last days)' },
  { label: 'Enrolled in auto-refill' },
  { label: 'Enrolled in mail-order' },
  { label: 'Forgetfulness or confusion' },
  { label: 'Follow up appointment/lab', options: ['Needed', 'Appointment scheduled'] },
  { label: 'Insurance coverage issue' },
  { label: 'Mail-Order conversion', options: ['Accepted', 'Completed', 'Declined'] },
  { label: 'Medication changed/DC/paused by provider', options: ['Changed', 'Discontinued', 'Paused'] },
  { label: 'Medication stopped by member' },
  { label: 'Notification/Reminder medication ready for pickup' },
  { label: 'Pill box organizer sent' },
  { label: 'Side effects', options: ['Concern', 'Experienced'] },
  { label: 'Synchronized medication' },
  { label: 'Transportation barrier' },
];

export const STAKEHOLDERS = [
  { key: 'Member', contactOutcomes: MEMBER_CONTACT, measureOutcomes: MEMBER_MEASURE },
  {
    key: 'Caregiver',
    contactOutcomes: ['Member expired', 'Member in hospice', 'Member in LTC/SNF', 'Member opt-Out', 'Member termed',
      'Member out of state/country', 'Requested a call back', 'Uncooperative', 'UTC', 'Wrong Number'],
    measureOutcomes: MEMBER_MEASURE,
  },
  {
    key: 'Facility',
    contactOutcomes: ['Uncooperative', 'UTC', 'Wrong Number'],
    measureOutcomes: [
      { label: 'Discussed daily medication routine and timing' },
      { label: 'Medication paused/discontinued by provider' },
      { label: 'Side effects or adverse reactions' },
    ],
  },
  {
    key: 'Pharmacy',
    contactOutcomes: ['Uncooperative', 'UTC', 'Wrong Number'],
    measureOutcomes: [
      { label: 'Confirmed medication pickup date' },
      { label: 'New 90/100DS conversion' },
      { label: 'Cost or insurance coverage issues' },
      { label: 'Medication changed/DC/paused by provider', options: ['Changed', 'Discontinued', 'Paused'] },
      { label: 'Pending', options: ['Pick up', 'Refill approval'] },
      { label: 'Refill approval received' },
    ],
  },
  {
    key: 'Provider Office',
    contactOutcomes: ['Uncooperative', 'UTC', 'Wrong Number'],
    measureOutcomes: [
      { label: 'Max day supply 90-100 request/follow up' },
      { label: 'Medication changed by provider' },
      { label: 'Medication discontinued by provider' },
      { label: 'Need follow up appointment' },
      { label: 'Refill approval pending' },
      { label: 'Refill approval sent to pharmacy' },
    ],
  },
  { key: 'Health Plan Services', contactOutcomes: [], measureOutcomes: [{ label: 'Health Plan Services' }] },
  {
    key: 'Network Manager Case Escalation',
    contactOutcomes: [],
    measureOutcomes: [{ label: 'Case escalation', options: ['LA Inland', 'OC', 'SD', 'Other region'] }],
  },
];

// "Select Outcome" menu items for a measure note panel: one section per
// stakeholder, each outcome keyed "Stakeholder · Outcome" so the saved log
// keeps who was contacted. The Successful / Unsuccessful radio narrows the
// list: reaching nobody (UTC, wrong number…) is Unsuccessful, interventions
// are Successful; Note shows everything.
export function schemaOutcomeItems(status) {
  const items = [];
  for (const s of STAKEHOLDERS) {
    const labels = [];
    if (status !== 'Successful') labels.push(...s.contactOutcomes);
    if (status !== 'Unsuccessful') {
      for (const o of s.measureOutcomes) {
        if (o.options) labels.push(...o.options.map(opt => `${o.label}: ${opt}`));
        else labels.push(o.label);
      }
    }
    if (!labels.length) continue;
    items.push({ section: s.key });
    for (const l of labels) items.push({ key: `${s.key} · ${l}`, label: l, hint: `${s.key} · ${l}` });
  }
  return items;
}

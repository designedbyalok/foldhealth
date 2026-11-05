/* Seed data for Settings > Automations: the template library, the account's
   automations, and their run history.

   Used by scripts/seed.js (upserts into Supabase) and by the store's
   fallback when the automations tables don't exist yet, so both show the
   same records. Run history is not hand-written: buildSeedActivity() puts
   patients through lib/simulate.js, so every total, branch count and
   failure reason adds up (the Figma's sample numbers don't; see
   docs/features/automations-design-review.md).

   Sample content is written per automation: one population per automation,
   copy that matches each step, and {{key}} merge tags only. */

import { simulateRun } from '../lib/simulate';
import { hash01 } from '../lib/conditionFields';
import { emailByKey } from './automationEmails';

// ── Graph DSL ──
// step(type, config, next) chains; split(type, config, { branch: [steps] })
// branches. Several steps in one array run in parallel.
const step = (type, config = {}, next = []) => ({ type, config, next });
const split = (type, config, branches) => ({ type, config, branches });

function buildGraph(prefix, triggerType, triggerConfig, roots) {
  const nodes = [{ id: 'trigger', type: triggerType, parentId: null, branch: null, order: 0, config: triggerConfig || {} }];
  let i = 0;
  const add = (spec, parentId, branch, order) => {
    const id = `${prefix}-${++i}`;
    nodes.push({ id, type: spec.type, parentId, branch, order, config: spec.config || {} });
    if (spec.branches) Object.entries(spec.branches).forEach(([b, kids]) => kids.forEach((k, j) => add(k, id, b, j)));
    (spec.next || []).forEach((k, j) => add(k, id, 'next', j));
  };
  roots.forEach((r, j) => add(r, 'trigger', 'next', j));
  return { nodes };
}

// An email-backed step: wires the shared email by key (the seed resolves the
// campaigns id) and keeps its name for display before then.
const mail = (key) => {
  const e = emailByKey(key);
  return { templateKey: key, templateName: e?.name || key, subject: e?.subject || '' };
};

const JACOB = { id: null, name: 'Jacob Miller (Care manager)' };
const MAYA = { id: null, name: 'Maya Chen (Front desk)' };
const task = (title, description, assignee = JACOB, priority = 'High') => ({ title, description, assignee, priority, pool: 'Automation Tasks' });
const rules = (r) => ({ rules: r });
const tagRule = (...tags) => ({ tags: { op: 'are', value: tags } });

// ── Templates ──

const ONBOARDING_GRAPH = (p) => buildGraph(p, 'patientRegistered', {}, [
  step('matchingConditions', rules({
    contactType: { op: 'is', value: 'Patient' },
    membership: { op: 'is', value: 'Active member' },
    ...tagRule('High Risk', 'Hypertensive'),
  }), [
    step('microAutomation', { title: 'Connect a wearable device' }, [
      split('education', { contentTitle: 'How to connect your wearable', ...mail('wearable-education') }, {
        opened: [
          step('generalTask', task('Confirm wearable is syncing', 'Make sure the patient’s wearable is connected and readings sync to their chart.'), [
            step('generalTask', task('Review first week of RPM readings', 'Review the first week of remote monitoring data. If readings are out of range, call the patient and schedule a visit.')),
          ]),
        ],
        notOpened: [
          step('delay', { amount: 2, unit: 'days' }, [
            step('reminder', { ...mail('wearable-reminder') }, [
              step('repeat', { every: 2, unit: 'days', times: 3 }),
            ]),
          ]),
        ],
      }),
    ]),
    split('form', { formIds: ['health-history', 'consent-to-treat'], formNames: ['Health history', 'Consent to treat'], ...mail('intake-forms') }, {
      allSubmitted: [step('generalTask', task('Review intake forms', 'Review the new patient’s health history and consent before their first visit.'))],
      fewSubmitted: [
        step('delay', { amount: 1, unit: 'days' }, [
          step('reminder', { ...mail('intake-forms-reminder') }),
        ]),
      ],
      noneSubmitted: [
        step('delay', { amount: 1, unit: 'days' }, [
          step('reminder', { ...mail('intake-forms-reminder') }, [
            step('generalTask', task('Call about missing intake forms', 'Call the patient to help them complete their intake forms before the first visit.', MAYA, 'Medium')),
          ]),
        ]),
      ],
    }),
  ]),
]);

const T = [
  // Recommended
  {
    slug: 'patient-onboarding', name: 'Patient onboarding and welcome automation', category: 'careDelivery', recommended: true, used: 982,
    description: 'Welcomes new high-risk patients: sends intake forms, helps them connect a wearable, and creates follow-up tasks for the care manager.',
    graph: ONBOARDING_GRAPH,
  },
  {
    slug: 'nps-90-days', name: 'Measure patient NPS every 90 days', category: 'feedback', recommended: true, used: 640, schedule: 'monthly',
    description: 'Sends a one-question NPS survey to active members every 90 days and flags detractors for a follow-up call.',
    graph: (p) => buildGraph(p, 'contactAddedOrUpdated', {}, [
      step('matchingConditions', rules({ membership: { op: 'is', value: 'Active member' } }), [
        split('email', { ...mail('nps-survey') }, {
          opened: [step('generalTask', task('Follow up on NPS response', 'Read the member’s NPS answer and call detractors (0–6) within two days.', JACOB, 'Medium'))],
          notOpened: [step('delay', { amount: 3, unit: 'days' }, [step('reminder', { ...mail('nps-survey') })])],
        }),
      ]),
    ]),
  },
  {
    slug: 'appointment-reminders', name: 'Set appointment reminders for patients', category: 'careDelivery', recommended: true, used: 1210, schedule: 'daily',
    description: 'Reminds patients of upcoming appointments by their preferred channel to reduce no-shows, with an easy reschedule link.',
    graph: (p) => appointmentRemindersGraph(p),
  },
  {
    slug: 'visit-feedback', name: 'Get patient feedback after appointment', category: 'feedback', recommended: true, used: 455,
    description: 'Sends a three-question satisfaction survey the day after each appointment and routes low scores to the practice manager.',
    graph: (p) => buildGraph(p, 'contactAddedOrUpdated', {}, [
      step('delay', { amount: 1, unit: 'days' }, [
        split('email', { ...mail('visit-feedback') }, {
          opened: [step('generalTask', task('Review visit feedback', 'Review the survey answers and reach out if the patient rated the visit 3 or lower.', JACOB, 'Medium'))],
          notOpened: [],
        }),
      ]),
    ]),
  },
  // Care compliance
  {
    slug: 'medication-adherence', name: 'Medication Adherence Reminder System', category: 'careCompliance', used: 388, schedule: 'weekly',
    description: 'Sends refill reminders to members on maintenance medications and opens a pharmacist task when a refill is missed.',
    graph: (p) => buildGraph(p, 'contactAddedOrUpdated', {}, [
      step('matchingConditions', rules({ membership: { op: 'is', value: 'Active member' } }), [
        split('email', { ...mail('medication-refill') }, {
          opened: [],
          notOpened: [step('delay', { amount: 3, unit: 'days' }, [step('sms', { message: 'Hi {{first_name}}, it’s time to refill your medication. Reply YES and we’ll send the request.' }, [
            step('generalTask', task('Check missed refill', 'The member hasn’t requested a refill. Call to check on adherence and barriers.', JACOB, 'Medium')),
          ])])],
        }),
      ]),
    ]),
  },
  {
    slug: 'insurance-renewal', name: 'Health Insurance Renewal and Preventive Care Compliance Checks', category: 'careCompliance', used: 142, schedule: 'monthly',
    description: 'Before coverage renews, checks for open preventive care and reminds members to book what’s due while it’s covered.',
    graph: (p) => buildGraph(p, 'membershipStatusChanged', {}, [
      step('email', { ...mail('screening-due') }),
    ]),
  },
  {
    slug: 'pre-procedure', name: 'Pre-Procedure Preparation Checklist Notifications', category: 'careCompliance', used: 210,
    description: 'Sends the preparation checklist before a scheduled procedure and confirms the patient has read it.',
    graph: (p) => buildGraph(p, 'contactAddedOrUpdated', {}, [
      step('sms', { message: 'Hi {{first_name}}, your procedure prep checklist is in the Fold Health app. Please review it 48 hours before.' }),
    ]),
  },
  {
    slug: 'post-surgery', name: 'Post-Surgery Recovery Plan Compliance Reminders', category: 'careCompliance', used: 305,
    description: 'Checks in daily during the first two weeks after surgery and alerts the care team when a check-in is missed.',
    graph: (p) => buildGraph(p, 'contactAddedOrUpdated', {}, [
      step('matchingConditions', rules({ registeredFor: { op: 'is registered for', value: 'TCM' } }), [
        step('push', { message: 'Time for today’s recovery check-in. It takes one minute.' }, [
          step('repeat', { every: 1, unit: 'days', times: 14 }),
        ]),
      ]),
    ]),
  },
  {
    slug: 'diet-exercise-surveys', name: 'Bi-weekly Diet and Exercise Compliance Surveys', category: 'careCompliance', used: 96, schedule: 'weekly',
    description: 'Every two weeks, asks members on a lifestyle plan how their diet and exercise goals are going.',
    graph: (p) => buildGraph(p, 'contactAddedOrUpdated', {}, [
      split('form', { formIds: ['diet-exercise-check-in'], formNames: ['Diet and exercise check-in'], ...mail('intake-forms') }, { allSubmitted: [], fewSubmitted: [], noneSubmitted: [] }),
    ]),
  },
  {
    slug: 'screening-alerts', name: 'Automated Alerts for Regular Health Screenings', category: 'careCompliance', used: 520, schedule: 'monthly',
    description: 'Finds members due for preventive screenings and sends a reminder with a booking link.',
    graph: (p) => buildGraph(p, 'contactAddedOrUpdated', {}, [
      step('demographics', rules({ age: { op: 'is over', value: 45, unit: 'years' } }), [
        split('appointmentLink', { appointmentType: 'a preventive screening', ...mail('screening-due') }, { booked: [], notBooked: [] }),
      ]),
    ]),
  },
  {
    slug: 'vaccination-schedule', name: 'Personalized Vaccination Schedule Reminders', category: 'careCompliance', used: 233,
    description: 'Reminds members of vaccines due for their age and conditions, and books a nurse visit when they reply.',
    graph: (p) => buildGraph(p, 'contactAddedOrUpdated', {}, [
      step('sms', { message: 'Hi {{first_name}}, you’re due for a vaccine. Reply BOOK to schedule a nurse visit.' }),
    ]),
  },
  {
    slug: 'rpm-submission', name: 'Remote Monitoring Data Submission Reminders', category: 'careCompliance', used: 410, schedule: 'daily',
    description: 'Reminds RPM members who haven’t sent a reading in three days and alerts the care manager after a week.',
    graph: (p) => buildGraph(p, 'contactAddedOrUpdated', {}, [
      step('matchingConditions', rules({ registeredFor: { op: 'is registered for', value: 'RPM' } }), [
        step('push', { message: 'We haven’t received a reading in 3 days. Take a quick reading today.' }),
      ]),
    ]),
  },
  // Care delivery
  {
    slug: 'symptom-triage', name: 'AI-Powered Symptom Checker and Triage Tool', category: 'careDelivery', used: 77,
    description: 'Sends a symptom checker when a member reports feeling unwell and creates an urgent task for high-acuity answers.',
    graph: (p) => buildGraph(p, 'contactAddedOrUpdated', {}, [
      step('push', { message: 'Not feeling well? Answer a few questions and we’ll tell you where to get care.' }),
    ]),
  },
  {
    slug: 'rpm-alerts', name: 'Remote Patient Monitoring and Alert System', category: 'careDelivery', used: 365,
    description: 'Escalates out-of-range remote readings to the care manager with the latest trend attached.',
    graph: (p) => buildGraph(p, 'contactAddedOrUpdated', {}, [
      step('generalTask', task('Review out-of-range reading', 'A remote reading was out of range. Review the trend and contact the patient.')),
    ]),
  },
  {
    slug: 'care-plan-adjustment', name: 'Personalized Care Plan Adjustment Notifications', category: 'careDelivery', used: 188,
    description: 'Lets members know when their care plan changes and asks them to confirm they’ve read the update.',
    graph: (p) => buildGraph(p, 'contactAddedOrUpdated', {}, [
      step('push', { message: 'Your care plan was updated. Open the app to see what changed.' }),
    ]),
  },
  {
    slug: 'telehealth-scheduling', name: 'Telehealth Visit Scheduling and Confirmation System', category: 'careDelivery', used: 290,
    description: 'Sends a booking link for a virtual visit, then a confirmation and a reminder the day before.',
    graph: (p) => buildGraph(p, 'contactAddedOrUpdated', {}, [
      split('appointmentLink', { appointmentType: 'a virtual visit', ...mail('virtual-visit-booking') }, {
        booked: [step('email', { ...mail('appointment-reminder') })],
        notBooked: [step('delay', { amount: 2, unit: 'days' }, [step('reminder', { ...mail('virtual-visit-booking-reminder') })])],
      }),
    ]),
  },
  {
    slug: 'prescription-refill', name: 'Automated Prescription Refill and Delivery Coordination', category: 'careDelivery', used: 270, schedule: 'manual',
    description: 'Coordinates refills for members whose prescriptions run out within a week and confirms the delivery address.',
    graph: (p) => buildGraph(p, 'contactAddedOrUpdated', {}, [
      step('email', { ...mail('medication-refill') }, []),
    ]),
  },
  {
    slug: 'wearable-education', name: 'Send patient education for connecting a wearable', category: 'careDelivery', used: 512,
    description: 'Emails the wearable setup guide, follows up with members who don’t open it, and asks the care manager to confirm data is syncing.',
    graph: (p) => buildGraph(p, 'contactAddedOrUpdated', {}, [
      split('education', { contentTitle: 'How to connect your wearable', ...mail('wearable-education') }, {
        opened: [step('generalTask', task('Confirm wearable is syncing', 'Make sure the patient’s wearable is connected and readings sync to their chart.'))],
        notOpened: [step('delay', { amount: 2, unit: 'days' }, [step('reminder', { ...mail('wearable-reminder') }, [step('repeat', { every: 2, unit: 'days', times: 3 })])])],
      }),
    ]),
  },
  // Feedback
  {
    slug: 'post-treatment-survey', name: 'Post-Treatment Satisfaction Survey Dispatch', category: 'feedback', used: 168,
    description: 'Asks members how their treatment went a week after it ends.',
    graph: (p) => buildGraph(p, 'contactAddedOrUpdated', {}, [step('delay', { amount: 7, unit: 'days' }, [step('email', { ...mail('visit-feedback') })])]),
  },
  {
    slug: 'quarterly-quality', name: 'Quarterly Health Service Quality Assessment', category: 'feedback', used: 64, schedule: 'monthly',
    description: 'A short quarterly survey on access, communication and wait times.',
    graph: (p) => buildGraph(p, 'contactAddedOrUpdated', {}, [step('email', { ...mail('nps-survey') })]),
  },
  {
    slug: 'experience-calls', name: 'Automated Patient Experience Follow-Up Calls', category: 'feedback', used: 59,
    description: 'Places an IVR call after a visit and creates a task when the member asks to speak to someone.',
    graph: (p) => buildGraph(p, 'contactAddedOrUpdated', {}, [step('ivr', { script: 'Post-visit experience (3 questions)' })]),
  },
  {
    slug: 'newsletter-feedback', name: 'Monthly Healthcare Newsletter Feedback Collection', category: 'feedback', used: 41, schedule: 'monthly',
    description: 'Asks newsletter readers which topics they want next month.',
    graph: (p) => buildGraph(p, 'contactAddedOrUpdated', {}, [step('email', { ...mail('nps-survey') })]),
  },
  {
    slug: 'support-ticket-feedback', name: 'Real-Time Patient Support Ticket Resolution Feedback', category: 'feedback', used: 120,
    description: 'Asks members to rate the help they got as soon as a support request closes.',
    graph: (p) => buildGraph(p, 'contactAddedOrUpdated', {}, [step('sms', { message: 'Hi {{first_name}}, was your question answered? Reply 1 (yes) or 2 (no).' })]),
  },
  {
    slug: 'annual-feedback', name: 'Annual Comprehensive Healthcare Feedback Solicitation', category: 'feedback', used: 33, schedule: 'monthly',
    description: 'Once a year, invites every active member to a longer survey about their care.',
    graph: (p) => buildGraph(p, 'contactAddedOrUpdated', {}, [step('email', { ...mail('nps-survey') })]),
  },
  {
    slug: 'pre-discharge-survey', name: 'Pre-Discharge Patient Expectations Survey', category: 'feedback', used: 88,
    description: 'Asks inpatients what they expect after discharge so the transition team can plan.',
    graph: (p) => buildGraph(p, 'contactAddedOrUpdated', {}, [step('push', { message: 'Before you go home, tell us what support you’ll need.' })]),
  },
  // Outreach
  {
    slug: 'health-awareness', name: 'Health Awareness Campaign Distribution System', category: 'outreach', used: 150, schedule: 'monthly',
    description: 'Sends monthly health awareness content to members, tailored by condition.',
    graph: (p) => buildGraph(p, 'contactAddedOrUpdated', {}, [step('email', { ...mail('wearable-education') })]),
  },
  {
    slug: 'community-events', name: 'Community Health Event Invitation and Registration', category: 'outreach', used: 72,
    description: 'Invites members near an upcoming community health event and confirms their registration.',
    graph: (p) => buildGraph(p, 'contactAddedOrUpdated', {}, [step('sms', { message: 'Hi {{first_name}}, join us for a free health fair this Saturday. Reply YES to save your spot.' })]),
  },
  {
    slug: 'preventive-care-assistant', name: 'Preventive Care Awareness and Scheduling Assistant', category: 'outreach', used: 196,
    description: 'Explains which preventive services a member is due for and helps them book.',
    graph: (p) => buildGraph(p, 'contactAddedOrUpdated', {}, [
      split('appointmentLink', { appointmentType: 'a preventive visit', ...mail('screening-due') }, { booked: [], notBooked: [] }),
    ]),
  },
];

export const SEED_TEMPLATES = T.map((t, i) => ({
  slug: t.slug,
  name: t.name,
  description: t.description,
  category: t.category,
  recommended: !!t.recommended,
  schedule: t.schedule || 'onTrigger',
  usedCount: t.used,
  sortOrder: i,
  graph: t.graph(t.slug),
}));

// ── The account's automations ──
// Fixed ids so re-seeding updates in place.
const AUTOMATIONS = [
  { id: '4f1a0c2e-0b1d-4c55-9a01-000000000001', slug: 'patient-onboarding', status: 'active', schedule: 'onTrigger', population: 'High-risk hypertensive patients', createdBy: 'Dr. Jedee Potter' },
  { id: '4f1a0c2e-0b1d-4c55-9a01-000000000002', slug: 'appointment-reminders', status: 'active', schedule: 'daily', runTime: '08:00', population: 'Patients with upcoming appointments', createdBy: 'Dr. Jedee Potter' },
  { id: '4f1a0c2e-0b1d-4c55-9a01-000000000003', slug: 'medication-adherence', status: 'active', schedule: 'weekly', runTime: '09:00', population: 'Members on maintenance medications', createdBy: 'Jacob Miller' },
  { id: '4f1a0c2e-0b1d-4c55-9a01-000000000004', slug: 'post-surgery', status: 'active', schedule: 'onTrigger', population: 'TCM patients', createdBy: 'Jacob Miller' },
  { id: '4f1a0c2e-0b1d-4c55-9a01-000000000005', slug: 'prescription-refill', status: 'active', schedule: 'manual', population: 'Members with refills due', createdBy: 'Maya Chen' },
  { id: '4f1a0c2e-0b1d-4c55-9a01-000000000006', slug: 'nps-90-days', status: 'active', schedule: 'monthly', runTime: '10:00', population: 'Active members', createdBy: 'Dr. Jedee Potter' },
  { id: '4f1a0c2e-0b1d-4c55-9a01-000000000007', slug: 'health-awareness', status: 'inactive', schedule: 'monthly', population: 'All members', createdBy: 'Maya Chen' },
  { id: '4f1a0c2e-0b1d-4c55-9a01-000000000008', slug: 'community-events', status: 'inactive', schedule: 'manual', population: 'Members near the event', createdBy: 'Maya Chen' },
  { id: '4f1a0c2e-0b1d-4c55-9a01-000000000009', slug: 'preventive-care-assistant', status: 'inactive', schedule: 'onTrigger', population: 'Members due for preventive care', createdBy: 'Jacob Miller' },
  { id: '4f1a0c2e-0b1d-4c55-9a01-000000000010', slug: 'care-plan-adjustment', status: 'draft', schedule: 'onTrigger', population: null, createdBy: 'Jacob Miller' },
  { id: '4f1a0c2e-0b1d-4c55-9a01-000000000011', slug: 'visit-feedback', status: 'draft', schedule: 'onTrigger', population: null, createdBy: 'Dr. Jedee Potter' },
];

// Appointment reminders: one branch per preferred channel.
function appointmentRemindersGraph(prefix) {
  return buildGraph(prefix, 'contactAddedOrUpdated', {}, [
    split('preferredChannel', { channels: ['email', 'sms', 'none'] }, {
      email: [step('email', { ...mail('appointment-reminder') })],
      sms: [step('sms', { message: 'Hi {{first_name}}, reminder: you have an appointment with {{provider_name}} tomorrow. Reply C to confirm or R to reschedule.' })],
      none: [step('generalTask', task('Call to confirm appointment', 'The patient has no preferred channel on file. Call to confirm tomorrow’s appointment and record their preference.', MAYA, 'Medium'))],
    }),
  ]);
}

export const SEED_AUTOMATIONS = AUTOMATIONS.map((a, i) => {
  const tpl = SEED_TEMPLATES.find(t => t.slug === a.slug);
  const created = new Date(Date.UTC(2026, 6, 1 + i * 3, 15));
  return {
    id: a.id,
    templateSlug: a.slug,
    name: tpl.name,
    description: tpl.description,
    status: a.status,
    schedule: a.schedule,
    runTime: a.runTime || null,
    populationGroupName: a.population,
    graph: tpl.graph,
    createdBy: a.createdBy,
    updatedBy: a.createdBy,
    createdAt: created.toISOString(),
    updatedAt: new Date(created.getTime() + 20 * 86400000).toISOString(),
  };
});

// Edits shown in History, newest last.
export const SEED_EDIT_LOG = [
  { automationId: SEED_AUTOMATIONS[0].id, actor: 'Dr. Jedee Potter', summary: 'Created the automation from the onboarding template.', daysAgo: 40 },
  { automationId: SEED_AUTOMATIONS[0].id, actor: 'Jacob Miller', summary: 'Added a delay before the intake form reminders.', daysAgo: 21 },
  { automationId: SEED_AUTOMATIONS[0].id, actor: 'Dr. Jedee Potter', summary: 'Updated the wearable reminder email.', daysAgo: 9 },
  { automationId: SEED_AUTOMATIONS[1].id, actor: 'Dr. Jedee Potter', summary: 'Moved the daily run to 8:00 AM.', daysAgo: 15 },
  { automationId: SEED_AUTOMATIONS[2].id, actor: 'Jacob Miller', summary: 'Added an SMS before the pharmacist task.', daysAgo: 12 },
];

/** Set templateId on every email step from its templateKey (campaigns ids once seeded). */
export function wireTemplateIds(graph, idForKey) {
  return {
    nodes: graph.nodes.map(n => (n.config?.templateKey && !n.config.templateId
      ? { ...n, config: { ...n.config, templateId: idForKey(n.config.templateKey) ?? null } }
      : n)),
  };
}

// ── Run history ──
// Event-triggered automations get a small batch most days; scheduled ones
// run on their schedule; manual ones were run a few times on a group.
const RUN_PLAN = {
  'patient-onboarding': { every: 1, size: [3, 9], days: 28 },
  'appointment-reminders': { every: 1, size: [8, 16], days: 28 },
  'medication-adherence': { every: 7, size: [20, 30], days: 28 },
  'post-surgery': { every: 2, size: [1, 4], days: 28 },
  'prescription-refill': { every: 9, size: [12, 18], days: 28, manual: 'Members with refills due' },
  'nps-90-days': { every: 30, size: [40, 60], days: 30 },
  'health-awareness': { every: 30, size: [30, 40], days: 60, before: 25 },
  'community-events': { every: 20, size: [10, 20], days: 60, before: 30, manual: 'Members near the event' },
};

const pickMembers = (patients, key, n) => [...patients]
  .sort((a, b) => hash01(`${key}:${a.id}`) - hash01(`${key}:${b.id}`))
  .slice(0, n);

/**
 * Runs, run members and messages for the seeded automations, from real
 * patient records. `newId` makes ids (uuid in the seed, local ids in the
 * fallback). Returns { runs, members, messages } in table shape (camelCase).
 */
export function buildSeedActivity(automations, patients, { now = new Date(), newId } = {}) {
  const runs = [];
  const members = [];
  const messages = [];
  if (!patients?.length) return { runs, members, messages };
  for (const a of automations) {
    const plan = RUN_PLAN[a.templateSlug];
    if (!plan) continue;
    for (let d = plan.days; d >= (plan.before || 0); d -= plan.every) {
      const startAt = new Date(now.getTime() - d * 86400000 - 6 * 3600000);
      const key = `${a.templateSlug}:${d}`;
      const [lo, hi] = plan.size;
      const n = lo + Math.floor(hash01(key) * (hi - lo + 1));
      const cohort = pickMembers(patients, key, Math.min(n, patients.length));
      const runId = newId();
      const sim = simulateRun(a.graph, cohort, { runKey: runId, startAt: startAt.toISOString(), now: now.toISOString() });
      const counts = { completed: 0, in_progress: 0, failed: 0 };
      sim.members.forEach(m => { counts[m.status] += 1; });
      const memberIds = new Map();
      sim.members.forEach(m => {
        const id = newId();
        memberIds.set(m.patientId, id);
        members.push({ ...m, id, runId, automationId: a.id });
      });
      sim.messages.forEach(msg => messages.push({ ...msg, id: newId(), runId, automationId: a.id, runMemberId: memberIds.get(msg.patientId) }));
      const finished = sim.members.map(m => m.finishedAt).filter(Boolean).sort().at(-1) || null;
      runs.push({
        id: runId,
        automationId: a.id,
        kind: plan.manual ? 'manual' : a.schedule === 'onTrigger' ? 'event' : 'scheduled',
        targetType: plan.manual ? 'patientGroup' : 'trigger',
        targetLabel: plan.manual || null,
        memberCount: sim.members.length,
        completedCount: counts.completed,
        inProgressCount: counts.in_progress,
        failedCount: counts.failed,
        minutesSaved: sim.members.reduce((s, m) => s + m.minutesSaved, 0),
        graph: a.graph,
        triggeredBy: plan.manual ? a.createdBy : null,
        startedAt: startAt.toISOString(),
        finishedAt: counts.in_progress ? null : finished,
      });
    }
  }
  return { runs, members, messages };
}

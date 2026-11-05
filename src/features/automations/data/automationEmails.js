/* eslint-disable no-restricted-syntax -- email block data: sizes are px in the
   rendered email HTML (as in accountEmailTemplates.js), not app styles. */
/**
 * The shared emails the seeded automations send. They are ordinary Content >
 * Emails rows (campaigns, channel 'email', category per row) with a
 * `system_key` of `automation:<key>`, so they open in the email builder and
 * the delete guard on Content > Emails can tell which automations use them.
 * Automation nodes point at them by id once seeded and carry `templateKey` so
 * the seed can wire the id in.
 *
 * Copy is written for the automation that sends it (the Figma previews show
 * an appointment confirmation inside a weekly check-in step; see
 * docs/features/automations-design-review.md). Merge tags use the
 * `{{key}}` tokens of src/features/email-builder/mergeTags.js only.
 * Colors are literal hex: this is email HTML, not app CSS.
 */
import { renderEmailHtml } from '../../email-builder/patchEmailHtml';

const BRAND = '#8C5AE2';
const TEXT = '#3A485F';
const MUTED = '#6F7A90';
const pad = (top, bottom) => ({ top, bottom, left: 32, right: 32 });

const block = {
  heading: (text) => ({ type: 'Heading', data: { props: { text, level: 'h2' }, style: { color: '#16181D', fontSize: 22, fontWeight: 'bold', textAlign: 'left', padding: pad(28, 8) } } }),
  text: (text, { muted = false, bottom = 12 } = {}) => ({ type: 'Text', data: { props: { text }, style: { color: muted ? MUTED : TEXT, fontSize: muted ? 13 : 14, textAlign: 'left', lineHeight: 1.5, padding: pad(0, bottom) } } }),
  button: (text, url) => ({ type: 'Button', data: { props: { text, url, size: 'medium', buttonStyle: 'rounded', buttonBackgroundColor: BRAND, buttonTextColor: '#FFFFFF' }, style: { textAlign: 'left', padding: pad(8, 20) } } }),
};

function documentOf(key, body) {
  const ids = body.map((_, i) => `${key}-body-${i + 1}`);
  return {
    root: { type: 'EmailLayout', data: { backdropColor: '#F6F7F8', canvasColor: '#FFFFFF', textColor: TEXT, fontFamily: 'MODERN_SANS', childrenIds: [`${key}-header`, ...ids, `${key}-footer`] } },
    [`${key}-header`]: { type: 'Container', data: { role: 'header', style: { backgroundColor: '#F2EEFE', padding: { top: 0, bottom: 0, left: 0, right: 0 } }, props: { childrenIds: [`${key}-brand`] } } },
    [`${key}-brand`]: { type: 'Heading', data: { props: { text: '{{clinic_name}}', level: 'h3' }, style: { color: BRAND, fontSize: 18, fontWeight: 'bold', textAlign: 'left', padding: pad(20, 20) } } },
    ...Object.fromEntries(body.map((b, i) => [ids[i], b])),
    [`${key}-footer`]: { type: 'Container', data: { role: 'footer', style: { backgroundColor: '#F6F7F8', padding: { top: 0, bottom: 0, left: 0, right: 0 } }, props: { childrenIds: [`${key}-footer-text`] } } },
    [`${key}-footer-text`]: { type: 'Text', data: { props: { text: 'Questions? Reply to this email or call your care team. {{clinic_name}}' }, style: { color: MUTED, fontSize: 12, textAlign: 'center', lineHeight: 1.5, padding: pad(16, 16) } } },
  };
}

const SIGN = (who = 'Your care team') => block.text(`Thank you,\n${who}\n{{clinic_name}}`, { bottom: 28 });

export const AUTOMATION_EMAILS = [
  {
    key: 'wearable-education', category: 'Education', name: 'Connect your wearable',
    subject: 'How to connect your wearable with the Fold Care app',
    description: 'Education content: step-by-step guide to pairing a wearable.',
    body: [
      block.heading('Connect your wearable in two minutes'),
      block.text('Hi {{first_name}},'),
      block.text('Connecting your wearable to the Fold Care app lets {{provider_name}} see your heart rate, activity and blood pressure trends between visits.'),
      block.button('Open the setup guide', 'https://fold.health/help/wearables'),
      SIGN(),
    ],
  },
  {
    key: 'wearable-reminder', category: 'Reminders', name: 'Connect your wearable reminder',
    subject: 'Reminder: connect your wearable to the Fold Care app',
    description: 'Follow-up for members who haven’t opened the wearable guide.',
    body: [
      block.heading('Your care team is waiting on your readings'),
      block.text('Hi {{first_name}},'),
      block.text('We noticed your wearable isn’t connected yet. It takes about two minutes, and you only do it once.'),
      block.button('Connect my wearable', 'https://fold.health/help/wearables'),
      SIGN(),
    ],
  },
  {
    key: 'intake-forms', category: 'Forms', name: 'New patient intake forms',
    subject: 'Welcome to {{clinic_name}}: please complete your intake forms',
    description: 'Sends the health history and consent forms to new patients.',
    body: [
      block.heading('Welcome, {{first_name}}'),
      block.text('Before your first visit, please complete your health history and consent forms. They take about 10 minutes.'),
      block.button('Start my forms', 'https://fold.health/forms'),
      SIGN(),
    ],
  },
  {
    key: 'intake-forms-reminder', category: 'Reminders', name: 'Intake forms reminder',
    subject: 'Reminder: your intake forms are still waiting',
    description: 'Follow-up for members with forms not yet submitted.',
    body: [
      block.heading('A quick reminder, {{first_name}}'),
      block.text('Some of your intake forms are still open. Finishing them before your visit means more time with {{provider_name}}.'),
      block.button('Finish my forms', 'https://fold.health/forms'),
      SIGN(),
    ],
  },
  {
    key: 'virtual-visit-booking', category: 'Scheduling', name: 'Book your first virtual visit',
    subject: 'Book your first virtual visit with {{provider_name}}',
    description: 'Appointment booking link for a first virtual visit.',
    body: [
      block.heading('Pick a time that works for you'),
      block.text('Hi {{first_name}}, your first virtual visit with {{provider_name}} is a 30-minute video call. Choose any open time below.'),
      block.button('Book my visit', 'https://fold.health/book'),
      SIGN(),
    ],
  },
  {
    key: 'virtual-visit-booking-reminder', category: 'Reminders', name: 'Book your visit reminder',
    subject: 'Reminder: you haven’t booked your first visit yet',
    description: 'Follow-up for members who haven’t booked.',
    body: [
      block.heading('Your first visit is one click away'),
      block.text('Hi {{first_name}}, open times with {{provider_name}} fill up quickly. Book now to keep your care plan on track.'),
      block.button('Book my visit', 'https://fold.health/book'),
      SIGN(),
    ],
  },
  {
    key: 'app-invitation', category: 'Onboarding', name: 'Fold Health app invitation',
    subject: '{{first_name}}, your Fold Health app is ready',
    description: 'Invites members who aren’t using the patient app.',
    body: [
      block.heading('Your care team, in your pocket'),
      block.text('Hi {{first_name}}, message your care team, see your care plan and track your readings in the Fold Health app.'),
      block.button('Set up the app', 'https://fold.health/app'),
      SIGN(),
    ],
  },
  {
    key: 'nps-survey', category: 'Feedback', name: 'NPS survey',
    subject: 'How likely are you to recommend {{clinic_name}}?',
    description: 'One-question NPS survey.',
    body: [
      block.heading('One quick question'),
      block.text('Hi {{first_name}}, on a scale from 0 to 10, how likely are you to recommend {{clinic_name}} to a friend or family member?'),
      block.button('Answer the question', 'https://fold.health/survey/nps'),
      SIGN(),
    ],
  },
  {
    key: 'visit-feedback', category: 'Feedback', name: 'Post-visit feedback',
    subject: 'How was your visit with {{provider_name}}?',
    description: 'Short satisfaction survey after an appointment.',
    body: [
      block.heading('Tell us how it went'),
      block.text('Hi {{first_name}}, thank you for visiting {{clinic_name}}. Three quick questions help us improve your next visit.'),
      block.button('Share feedback', 'https://fold.health/survey/visit'),
      SIGN(),
    ],
  },
  {
    key: 'appointment-reminder', category: 'Scheduling', name: 'Upcoming appointment reminder',
    subject: 'Reminder: your appointment with {{provider_name}} is coming up',
    description: 'Reminder ahead of a scheduled appointment.',
    body: [
      block.heading('See you soon, {{first_name}}'),
      block.text('This is a reminder of your upcoming appointment with {{provider_name}}. If you need to reschedule, use the link below.'),
      block.button('View or reschedule', 'https://fold.health/appointments'),
      SIGN(),
    ],
  },
  {
    key: 'medication-refill', category: 'Reminders', name: 'Medication refill reminder',
    subject: 'Time to refill your medication',
    description: 'Refill reminder for members on maintenance medication.',
    body: [
      block.heading('Running low?'),
      block.text('Hi {{first_name}}, based on your last fill you may be running low. Request a refill so you don’t miss a dose.'),
      block.button('Request a refill', 'https://fold.health/refills'),
      SIGN(),
    ],
  },
  {
    key: 'screening-due', category: 'Reminders', name: 'Screening due reminder',
    subject: '{{first_name}}, you’re due for a health screening',
    description: 'Preventive screening reminder.',
    body: [
      block.heading('A screening is due'),
      block.text('Hi {{first_name}}, our records show you’re due for a preventive screening. Most screenings are covered at no cost.'),
      block.button('Schedule my screening', 'https://fold.health/book'),
      SIGN(),
    ],
  },
];

export const automationEmailDoc = (e) => documentOf(e.key, e.body);

/** campaigns row for scripts/seed.js (upsert on system_key). */
export const automationEmailToRow = (e) => {
  const doc = automationEmailDoc(e);
  return {
    system_key: `automation:${e.key}`,
    name: e.name,
    description: e.description,
    channel: 'email',
    section: 'running',
    category: e.category,
    subject_line: e.subject,
    email_template: doc,
    email_html: renderEmailHtml(doc, { theme: 'light', compliance: null }),
  };
};

export const emailByKey = (key) => AUTOMATION_EMAILS.find(e => e.key === key) || null;

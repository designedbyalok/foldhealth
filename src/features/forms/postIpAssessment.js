import { parseLocalDate } from '../../lib/localDate';
import { isEmptyDash } from '../../lib/emptyDash';
/**
 * Post IP (Inpatient) Assessment: the AstraConnect post-discharge follow-up
 * form. Shared definition consumed by:
 *   - the TOC queue AssessmentDrawer (pre-filled by the TOC agent)
 *   - Content → Forms (listed as an authored form, editable in the builder)
 *   - the shared FormRenderer / AssessmentFormView
 *
 * The `schema.items` shape matches the forms builder's field model
 * (linkId + type + text + options + control), so the same renderer that
 * powers the builder preview draws these questions.
 */

export const POST_IP_FORM_NAME = 'Post IP Assessment';
export const POST_IP_FORM_TITLE = 'Post IP Assessment';
const COORDINATOR_NAME = 'Robert Fox';
const ORG_NAME = 'Astrana Health';

function timeOfDayGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

function honorific(gender) {
  const g = (gender || '').toString().trim().toLowerCase();
  if (g === 'm' || g === 'male') return 'Mr.';
  if (g === 'f' || g === 'female') return 'Mrs.';
  return 'Mx.';
}

function lastNameOf(fullName) {
  const parts = (fullName || '').trim().split(/\s+/);
  return parts.length ? parts[parts.length - 1] : '';
}

function formatVisitDate(iso) {
  if (!iso) return '';
  const d = parseLocalDate(iso);
  if (!d) return iso;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/** Build the personalized intro paragraph from a patient object. */
export function buildPostIpIntro(patient) {
  if (!patient) return POST_IP_INTRO_TEMPLATE;
  const salutation = honorific(patient.gender);
  const last = lastNameOf(patient.name);
  const provider = patient.pcp && !isEmptyDash(patient.pcp) ? patient.pcp : 'Dr. William Wang, DO';
  const visitType = 'Hospital';
  const facility = patient.facility || 'Providence St. Joseph Medical Center';
  const visitDate = formatVisitDate(patient.dischargeDate || patient.lastAdmission) || 'August 8, 2026';
  return `Good ${timeOfDayGreeting()}, ${salutation} ${last}. My name is ${COORDINATOR_NAME}, and I’m your Coordinator from ${ORG_NAME}. We work closely with your provider, ${provider}, to ensure your health and well-being. I’m reaching out today to follow up and check in on how you’re doing. I see that you recently had a visit to the ${visitType} at ${facility} on ${visitDate}.`;
}

/** Placeholder intro used when the form is opened outside a patient context
 *  (e.g. Content → Forms preview). Mirrors the AstraConnect print template. */
export const POST_IP_INTRO_TEMPLATE = 'Good [morning/afternoon], Mr./Mrs. [Last Name]. My name is [Your Name], and I’m your [Nurse/Coordinator] from [Astrana Health/XXX IPA]. We work closely with your provider, [Provider’s Name], to ensure your health and well-being. I’m reaching out today to follow up and check in on how you’re doing. I see that you recently had a visit to the [ER/Hospital/SNF] at [Facility Name] on [Date].';

const YES_NO = [{ value: 'Yes' }, { value: 'No' }];
const dropdown = (options) => ({ type: 'choice', control: 'dropdown', options: options.map(v => ({ value: v })) });
const yesNo = () => ({ type: 'choice', options: YES_NO });
const textarea = () => ({ type: 'text' });
const shortText = () => ({ type: 'string' });
const dateField = () => ({ type: 'date' });

/** Question fields (everything after the intro paragraph). Kept module-level
 *  so the same array feeds the builder, the drawer, and any renderer. */
export const POST_IP_QUESTIONS = [
  { linkId: 'q1', text: 'How are you feeling today compared to when you left the hospital?', ...dropdown([
    'Much better', 'Somewhat better', 'About the same', 'Somewhat worse', 'Much worse',
  ]) },
  { linkId: 'q2', text: 'Can you please tell me what made you decide to call 911 or go to ER/Hospital?', ...dropdown([
    'Shortness of breath', 'Chest pain', 'Severe pain', 'Fall / injury', 'Worsening chronic condition', 'Fever / infection', 'Other',
  ]) },

  { linkId: 'sec-disease', type: 'group', text: 'Disease-Specific Interventions', items: [
    { linkId: 'q3', text: 'What were you diagnosed with at the hospital/ER?', ...shortText() },
    { linkId: 'q4', text: 'Breakout to disease-specific questions.', required: true, ...textarea() },
    { linkId: 'disp-cmh', type: 'display', text: '(Please refer to Notion “Care Management Hub” page)' },
    { linkId: 'q5', text: 'List all the admission drivers and interventions.', ...textarea() },
    { linkId: 'driver1', text: 'Driver #1 and Interventions', required: true, ...shortText() },
    { linkId: 'driver2', text: 'Driver #2 and Interventions', ...shortText() },
    { linkId: 'driver3', text: 'Driver #3 and Interventions', ...shortText() },
    { linkId: 'driverN', text: 'Additional Drivers and Interventions', ...shortText() },
  ] },

  { linkId: 'sec-med', type: 'group', text: 'Medication', items: [
    { linkId: 'q6', text: 'Did you receive a new prescription?', ...yesNo() },
    { linkId: 'q7', text: 'Did you have any problems getting your medicine(s)?', ...yesNo() },
    { linkId: 'disp-medrec', type: 'display', text: 'Please go to "Medication Management" tab to complete Medication Reconciliation.' },
  ] },

  { linkId: 'sec-emergency', type: 'group', text: 'Emergency Planning', items: [
    { linkId: 'q11', text: 'Do you know what to do if you experience a medical emergency or worsening symptoms?', ...yesNo() },
    { linkId: 'q12', text: 'Do you have a list of emergency contacts and healthcare providers for immediate assistance?', ...yesNo() },
  ] },

  { linkId: 'sec-cont', type: 'group', text: 'Continuity of Care', items: [
    { linkId: 'q13', text: 'Were you provided discharge instructions when you left the facility?', ...yesNo() },
    { linkId: 'q14', text: 'Do you have any questions regarding your discharge instructions?', ...yesNo() },
    { linkId: 'q15', text: 'Do you have any follow-up doctor appointment(s)?', ...yesNo() },
    { linkId: 'q16', text: 'Do you have reliable transportation to go to these appointment(s)?', ...yesNo() },
  ] },

  { linkId: 'sec-urgent', type: 'group', text: 'Urgent Care', items: [
    { linkId: 'q17', text: 'Are you familiar with the Urgent Care Centers in your neighborhood?', ...yesNo() },
  ] },

  { linkId: 'sec-home-health', type: 'group', text: 'Home Health', items: [
    { linkId: 'q18', text: 'Was home health nurse visit ordered for you at discharge?', ...yesNo() },
  ] },

  { linkId: 'sec-dme', type: 'group', text: 'DME', items: [
    { linkId: 'q19', text: 'Did the facility order any special equipment for you to use at home?', ...yesNo() },
    { linkId: 'q20', text: 'Do you have issue obtaining or using it?', ...yesNo() },
  ] },

  { linkId: 'sec-support', type: 'group', text: 'Support System', items: [
    { linkId: 'q21', text: 'Do you have someone who can help you with your daily needs (e.g., transportation, assistance with activities of daily living)?', ...yesNo() },
    { linkId: 'q21b', text: 'List names and numbers', ...textarea() },
  ] },

  { linkId: 'sec-home-env', type: 'group', text: 'Home Environment', items: [
    { linkId: 'q22', text: 'Do you live in a single-story or multi-story home? If multi-story home, assess living area condition for safety.', ...yesNo() },
    { linkId: 'q23', text: 'Are you able to get out of the apt/house?', ...yesNo() },
    { linkId: 'q24', text: 'Is your home environment safe for you to recover in (e.g., any hazards that could cause falls or injuries)?', ...yesNo() },
    { linkId: 'q25', text: 'Do you need any additional support or equipment at home (e.g., mobility aids, home care services)?', ...yesNo() },
    { linkId: 'q26', text: 'List all intervention(s)', ...textarea() },
  ] },

  { linkId: 'sec-prev', type: 'group', text: 'Preventive Care', items: [
    { linkId: 'q27', text: 'Have you received education about lifestyle changes or preventive care that can help you avoid future hospitalizations?', ...yesNo() },
    { linkId: 'q28', text: 'Are there any health goals you are working on (e.g., quitting smoking, managing blood pressure)?', ...yesNo() },
  ] },

  { linkId: 'sec-other', type: 'group', text: 'Other', items: [
    { linkId: 'q29', text: '1st week additional note', ...textarea() },
    { linkId: 'q30', text: '2nd week follow-up note.', ...textarea() },
    { linkId: 'q31', text: '3rd week follow-up note.', ...textarea() },
    { linkId: 'q32', text: '4th week follow-up note.', ...textarea() },
  ] },

  { linkId: 'sec-quality', type: 'group', text: 'Quality Measures', items: [
    { linkId: 'q-note', text: 'Note', ...shortText() },
    { linkId: 'q33', text: 'AWV Appointment Date', ...dateField() },
    { linkId: 'q34', text: 'MRP Completion Date', ...dateField() },
  ] },

  { linkId: 'provider', text: 'Rendering Provider', type: 'choice', options: [
    { value: 'William Wang, DO' },
    { value: 'Carlos Palacios, DO' },
    { value: 'Ricardo Cuadra, DO' },
  ] },
];

/**
 * Build the full form object (name + schema + scoring) for a given patient.
 * Pass `null` to get the generic intro used by Content → Forms preview.
 */
export function buildPostIpForm(patient) {
  return {
    name: POST_IP_FORM_TITLE,
    schema: { items: [
      { linkId: 'intro', type: 'display', text: buildPostIpIntro(patient) },
      ...POST_IP_QUESTIONS,
    ] },
    scoring: { scores: [], criticalTriggers: [] },
  };
}

/**
 * Sample TOC-agent-completed answers. Modeled after a patient recently
 * discharged following an acute CHF exacerbation, realistic driver
 * breakdown, interventions, and week-over-week follow-up notes.
 */
export const POST_IP_PREFILLED_ANSWERS = {
  q1: 'Somewhat better',
  q2: 'Shortness of breath',
  q3: 'Acute exacerbation of congestive heart failure (CHF)',
  q4: 'Patient reports 3-day history of progressive lower-extremity edema, orthopnea (2-pillow), and dyspnea on minimal exertion. Weight up 6 lbs from dry weight. Reviewed daily weight tracking, low-sodium diet, and diuretic titration plan with patient and daughter.',
  driver1: 'Medication non-adherence: patient reports missing furosemide doses due to $$ concerns. Intervention: enrolled in manufacturer PAP; pharmacy 90-day refill authorized.',
  driver2: 'Dietary: high-sodium meals over holiday weekend. Intervention: RD teleconsult scheduled; provided low-sodium meal guide.',
  driver3: 'Missed cardiology follow-up on 07/15. Intervention: rescheduled for 08/22; transportation coordinated via LogistiCare.',
  driverN: 'Social work referral placed for prescription assistance and utility support (SDoH screen positive for financial strain).',
  q5: 'See Drivers #1–#3 above. Overall discharge plan: TCM enrollment, home health nursing 2x/week x 30 days, telemonitoring for daily weight + BP.',
  q6: 'Yes',
  q7: 'No',
  q11: 'Yes',
  q12: 'Yes',
  q13: 'Yes',
  q14: 'No',
  q15: 'Yes',
  q16: 'Yes',
  q17: 'Yes',
  q18: 'Yes',
  q19: 'Yes',
  q20: 'No',
  q21: 'Yes',
  q21b: 'Daughter, Sarah Reyes (555) 213-4467, primary caregiver, lives 10 min away.\nNeighbor, Ms. Alma Chen (555) 987-6543, weekday check-ins.',
  q22: 'Yes',
  q23: 'Yes',
  q24: 'Yes',
  q25: 'No',
  q26: 'Home health RN visits 2x/week x 30 days. TCM enrollment complete. Medication reconciliation performed at bedside on 08/11; discrepancies resolved with prescribing MD. Enrolled in remote weight + BP monitoring. Cardiology follow-up on 08/22 confirmed.',
  q27: 'Yes',
  q28: 'Yes',
  q29: 'Day 3 post-discharge call: patient afebrile, weight stable at 178 lb (dry weight 176), no new dyspnea. Confirmed Rx pickup for furosemide and metoprolol. Reinforced daily weight log + when to call. No red-flag symptoms.',
  q30: 'Day 10 follow-up: patient feeling stronger, resumed light housework. Weight trending down (175 lb). Home health RN reports lungs clear, no LE edema. PCP appointment attended 08/18; labs stable.',
  q31: 'Day 17: attended cardiology follow-up 08/22 with Dr. Palacios. Echo shows preserved EF (55%). Diuretic dose maintained. Patient ambulating 15 min/day per PT plan.',
  q32: 'Day 25: patient stable, no symptom recurrence. Home health discharge planned for 09/10. TCM billing documented. Patient graduated to APCM long-term care management.',
  'q-note': 'Patient meets criteria for post-discharge APCM enrollment. AWV due within 90 days.',
  q33: '2026-09-10',
  q34: '2026-08-14',
  provider: 'William Wang, DO',
};

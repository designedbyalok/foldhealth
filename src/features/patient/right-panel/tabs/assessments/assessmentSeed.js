/**
 * Demo rows for the P360 Assessments tab (scripts/seed.js): sends and
 * responses for real Forms library forms, on one patient. Fixed ids and
 * session ids so re-seeding updates the rows instead of adding more.
 */

const SEND_PLANS = [
  { daysAgo: 2, programs: ['HIU', 'TCM'], requiresSignature: true, signed: true, response: 'completed' },
  { daysAgo: 9, programs: ['CCM'], requiresSignature: true, signed: false, response: 'completed' },
  { daysAgo: 4, programs: ['TCM'], requiresSignature: false, response: 'in_progress' },
  { daysAgo: 1, programs: ['HIU'], requiresSignature: false, response: null },
];
const SENDERS = ['Dr. Jenny Wilson', 'Nathan Williams'];

const daysAgo = (n, hour = 10) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 15, 0, 0);
  return d.toISOString();
};

const leaves = items => (items || []).flatMap(f => (f.items ? leaves(f.items) : f.type === 'display' ? [] : [f]));

function sampleAnswer(field) {
  const first = field.options?.[0]?.value;
  if (field.type === 'choice') return field.control === 'checkbox' ? (first != null ? [first] : []) : first;
  if (field.type === 'integer' || field.type === 'decimal') return 2;
  if (field.type === 'boolean') return true;
  if (field.type === 'date') return daysAgo(30).slice(0, 10);
  return 'No concerns reported.';
}

// Screening instruments first (PHQ-9, AUDIT-C, HRA, GAD-7), then the other
// assessment forms. Note templates (form_type 'Note') are never assessments.
const RANK = [/phq/i, /audit/i, /\bhra\b/i, /gad/i, /assessment|questionnaire|screening/i];

/** The forms to seed sends for: assessments only, best known first. */
export function pickAssessmentForms(forms, count = SEND_PLANS.length) {
  const rank = f => { const i = RANK.findIndex(r => r.test(f.name || '')); return i === -1 ? RANK.length : i; };
  return forms
    .filter(f => f.form_type !== 'Note' && rank(f) < RANK.length)
    .sort((a, b) => rank(a) - rank(b) || String(a.name).localeCompare(String(b.name)))
    .slice(0, count);
}

/** forms: [{ id, schema }] from the forms table, at most four used. */
export function sampleAssessmentSeed(patientId, forms) {
  const sends = [];
  const responses = [];
  forms.slice(0, SEND_PLANS.length).forEach((form, i) => {
    const plan = SEND_PLANS[i];
    const sentAt = daysAgo(plan.daysAgo, 9);
    sends.push({
      id: `00000000-0000-4000-9000-${String(i + 1).padStart(12, '0')}`,
      patient_id: patientId,
      form_id: form.id,
      sent_by_name: SENDERS[i % SENDERS.length],
      sent_at: sentAt,
      channels: ['email'],
      program_codes: plan.programs,
      requires_signature: plan.requiresSignature,
      signed_by_name: plan.signed ? SENDERS[0] : null,
      signed_at: plan.signed ? daysAgo(plan.daysAgo - 1, 14) : null,
    });
    if (!plan.response) return;
    const fields = leaves(form.schema?.items);
    const answerCount = plan.response === 'completed' ? fields.length : Math.ceil(fields.length / 2);
    const answers = Object.fromEntries(fields.slice(0, answerCount).map(f => [f.linkId, sampleAnswer(f)]));
    responses.push({
      form_id: form.id,
      patient_id: patientId,
      session_id: `p360-seed:${patientId}:${form.id}`,
      answers,
      answered_count: answerCount,
      status: plan.response,
      completed_at: plan.response === 'completed' ? daysAgo(plan.daysAgo, 12) : null,
    });
  });
  return { sends, responses };
}

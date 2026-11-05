/**
 * POST /api/referral-email
 *
 * Server-side AI drafting (OpenAI; see _lib/aiJson.js) for the Care Gap
 * "Send Referral" email: drafts a { subject, body } from the referral details.
 * Keeps the AI keys off the client. The signature is added by the UI, so the body ends at the
 * sign-off.
 *
 * Body: { patientName, patientAge?, patientSex?, gap?, providerName,
 *         providerSpecialty?, reason, note?, attachments?: string[], senderName? }
 *
 * With `mode: 'patient'` it drafts the Compose Email message to a patient
 * instead (same endpoint, so the deploy keeps one AI function):
 * Body: { mode: 'patient', patientName?, subject?, notes?, senderName? }
 */

import { requireUser } from '../_lib/requireUser.js';
import { bodyWithinLimit } from '../_lib/limits.js';
import { aiConfigured, generateJson } from '../_lib/aiJson.js';

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: { subject: { type: 'string' }, body: { type: 'string' } },
  required: ['subject', 'body'],
};

const REFERRAL_FIELDS = ['patientName', 'patientAge', 'patientSex', 'gap', 'providerName', 'providerSpecialty', 'reason', 'note', 'attachments', 'senderName'];
const PATIENT_FIELDS = ['patientName', 'subject', 'notes', 'senderName'];

// Only the documented fields reach the prompt, so extra body keys can't pad it.
function pickFields(body, patient) {
  if (!body || typeof body !== 'object') return null;
  const d = {};
  for (const k of patient ? PATIENT_FIELDS : REFERRAL_FIELDS) {
    if (body[k] != null) d[k] = body[k];
  }
  return d;
}

function buildPatientPrompt(d) {
  return [
    'You are a care coordinator writing a short email from a care team to a patient.',
    '',
    'Rules:',
    '- Warm, plain language a patient understands; no medical jargon.',
    '- Use only the facts provided. Never invent diagnoses, results, dates or history.',
    '- Keep the subject under 70 characters.',
    '- Body: a greeting by first name if given, 1 to 2 short paragraphs, then',
    '  "Warm regards," on its own line.',
    '- Plain text only. No markdown, no placeholders in brackets, no signature block.',
    '',
    'Email details (JSON; "notes" is what the sender wants to say, if any):',
    JSON.stringify(d),
  ].join('\n');
}

function buildPrompt(d) {
  return [
    'You are a care coordinator writing a referral email from a primary care',
    'practice to another provider. Write a short, professional email.',
    '',
    'Rules:',
    '- Use only the facts provided. Never invent diagnoses, results, dates or history.',
    '- Keep the subject under 70 characters and do not put the patient name in it.',
    '- Body: a greeting to the provider, 2 short paragraphs (who the patient is and',
    '  why they are referred; what is attached and the ask, such as scheduling an',
    '  evaluation and sending findings back), then "Thank you," on its own line.',
    '- Plain text only. No markdown, no placeholders in brackets, no signature block.',
    '',
    'Referral details (JSON):',
    JSON.stringify(d),
  ].join('\n');
}

export default async function handler(req, res) {
  if (!(await requireUser(req, res))) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }
  if (!aiConfigured()) {
    console.error('[referral-email] no AI key is set');
    return res.status(500).json({ error: { message: 'AI drafting is not set up on this deployment.' } });
  }
  if (!bodyWithinLimit(req, res)) return;
  const patientMode = req.body?.mode === 'patient';
  const d = pickFields(req.body, patientMode);
  if (!d || (!patientMode && !d.providerName)) {
    return res.status(400).json({ error: { message: 'Missing referral details' } });
  }

  try {
    const ai = await generateJson({
      prompt: patientMode ? buildPatientPrompt(d) : buildPrompt(d),
      schema: RESPONSE_SCHEMA,
      name: 'email_draft',
      temperature: 0.4,
      logTag: 'referral-email',
      timeoutMs: 25000,
      deadlineMs: 50000,
    });
    if (!ai.ok) return res.status(502).json({ error: { message: 'The AI service is unavailable right now.' } });
    const draft = ai.data;
    return res.status(200).json({
      email: { subject: String(draft.subject || ''), body: String(draft.body || '') },
    });
  } catch (err) {
    console.error('[referral-email]', err?.message || err);
    return res.status(502).json({ error: { message: 'Could not reach the AI service.' } });
  }
}

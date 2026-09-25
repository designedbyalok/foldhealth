/**
 * POST /api/referral-email
 *
 * Server-side Gemini proxy for the Care Gap "Send Referral" email: drafts a
 * { subject, body } from the referral details. Keeps GOOGLE_AI_API_KEY off
 * the client. The signature is added by the UI, so the body ends at the
 * sign-off.
 *
 * Body: { patientName, patientAge?, patientSex?, gap?, providerName,
 *         providerSpecialty?, reason, note?, attachments?: string[], senderName? }
 */

const MODEL = process.env.GOOGLE_AI_MODEL || 'gemini-3.8-flash';
const ENDPOINT = (key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: { subject: { type: 'string' }, body: { type: 'string' } },
  required: ['subject', 'body'],
};

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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }
  const key = process.env.GOOGLE_AI_API_KEY;
  if (!key) {
    return res.status(500).json({ error: { message: 'GOOGLE_AI_API_KEY is not set.' } });
  }
  const d = req.body && typeof req.body === 'object' ? req.body : null;
  if (!d?.providerName) {
    return res.status(400).json({ error: { message: 'Missing referral details' } });
  }

  const requestBody = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: buildPrompt(d) }] }],
    generationConfig: { temperature: 0.4, responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
  });

  try {
    let upstream;
    for (let attempt = 0; attempt < 3; attempt++) {
      upstream = await fetch(ENDPOINT(key), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
      });
      if (upstream.ok || (upstream.status !== 503 && upstream.status !== 429)) break;
      await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
    }
    if (!upstream.ok) {
      console.error('[referral-email] gemini error', upstream.status, await upstream.text());
      return res.status(502).json({ error: { message: 'The AI service is unavailable right now.' } });
    }
    const json = await upstream.json();
    const text = json?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    let draft;
    try {
      draft = JSON.parse(text);
    } catch {
      console.error('[referral-email] non-JSON model output:', text.slice(0, 500));
      return res.status(502).json({ error: { message: 'AI returned an unreadable draft.' } });
    }
    return res.status(200).json({
      email: { subject: String(draft.subject || ''), body: String(draft.body || '') },
    });
  } catch (err) {
    console.error('[referral-email]', err?.message || err);
    return res.status(502).json({ error: { message: 'Could not reach the AI service.' } });
  }
}

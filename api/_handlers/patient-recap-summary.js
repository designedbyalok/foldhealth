/**
 * POST /api/patient-recap-summary
 *
 * Unity's per-section summaries for the patient Overview's Recap: one short
 * plain-language paragraph for each section (touchpoints, clinical events,
 * vitals, medications, programs, open items, and an overall one) saying what
 * happened and what changed. Server-side (see _lib/aiJson.js), like
 * care-plan-summary, so the AI keys stay off the client. One call covers
 * every section.
 *
 * Body: { patientName, period, sections: [{ key, title, headline, changes, events, items }] }
 *   changes: [{ label, from, to, delta, note }]  (computed client-side, already accurate)
 *   events:  [{ date, type, title, detail, by, outcome }]
 *   items:   [{ title, detail, severity }]       (open items needing attention)
 * Returns: { summaries: { [key]: string } }
 */

import { requireUser } from '../_lib/requireUser.js';
import { bodyWithinLimit } from '../_lib/limits.js';
import { aiBusy, aiConfigured, generateJson } from '../_lib/aiJson.js';

// A hung upstream would hold the function (and the Recap's loading state)
// until the platform kills it; give up and let the Recap show its own summary.
const ATTEMPT_TIMEOUT_MS = 20000;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: { key: { type: 'string' }, summary: { type: 'string' } },
        required: ['key', 'summary'],
      },
    },
  },
  required: ['sections'],
};

// Keep the prompt a sane size on busy charts; counts arrive in `changes`.
const CAP = 25;
const cap = (arr) => (Array.isArray(arr) ? arr.slice(0, CAP) : []);

function buildPrompt(body) {
  const { patientName = 'the patient', period = 'recently', sections = [] } = body || {};
  const payload = sections.map(s => ({
    key: String(s.key),
    title: s.title,
    headline: s.headline,
    changes: cap(s.changes),
    events: cap(s.events),
    items: cap(s.items),
  }));
  return [
    'You are a care-coordination assistant writing a recap for a care manager',
    `who is about to contact ${patientName}. The period is ${period}.`,
    '',
    'For EACH section below, write one short summary (2 to 3 sentences, at most',
    '60 words) of what happened in that section and what changed, and why it',
    'matters for the next contact.',
    '',
    'Rules:',
    '- Use only the facts given. Never invent values, dates, people or events.',
    '  The numbers in "changes" are exact; prefer them over counting yourself.',
    '- Plain language, short sentences, no filler, no bullet points, no headings.',
    '- Name people, results and dates when they are given.',
    '- If a section has nothing in it, say so in one short sentence.',
    '- The "glance" section is the overall picture: lead with the most important',
    '  change across all sections.',
    '- Return one entry per section, with the same key.',
    '',
    'Sections (JSON):',
    JSON.stringify(payload),
  ].join('\n');
}

export default async function handler(req, res) {
  if (!(await requireUser(req, res))) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }

  if (!aiConfigured()) {
    console.error('[patient-recap-summary] no AI key is set');
    return res.status(500).json({ error: { message: 'AI summaries are not set up on this deployment.' } });
  }

  if (!bodyWithinLimit(req, res, 120 * 1024)) return;
  const body = req.body && typeof req.body === 'object' ? req.body : null;
  if (!body || !Array.isArray(body.sections) || !body.sections.length) {
    return res.status(400).json({ error: { message: 'Missing or invalid recap body' } });
  }

  try {
    const ai = await generateJson({
      prompt: buildPrompt(body),
      schema: RESPONSE_SCHEMA,
      name: 'recap_summaries',
      temperature: 0.3,
      logTag: 'patient-recap-summary',
      timeoutMs: ATTEMPT_TIMEOUT_MS,
      deadlineMs: ATTEMPT_TIMEOUT_MS * 2,
    });
    if (!ai.ok) {
      const msg = aiBusy(ai.status)
        ? 'The AI service is busy right now. Please try again in a moment.'
        : `AI service returned ${ai.status}. Please try again.`;
      return res.status(502).json({ error: { message: msg } });
    }
    const parsed = ai.data;

    // Only keys that were asked for, as strings.
    const asked = new Set(body.sections.map(s => String(s.key)));
    const summaries = {};
    for (const s of Array.isArray(parsed?.sections) ? parsed.sections : []) {
      if (s && asked.has(String(s.key)) && typeof s.summary === 'string' && s.summary.trim()) {
        summaries[String(s.key)] = s.summary.trim();
      }
    }
    return res.status(200).json({ summaries });
  } catch (err) {
    console.error('[patient-recap-summary]', err?.message || err);
    return res.status(502).json({ error: { message: 'Could not reach the AI service. Please try again.' } });
  }
}

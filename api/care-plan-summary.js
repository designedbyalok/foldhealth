/**
 * POST /api/care-plan-summary
 *
 * Server-side proxy for Google's Gemini (Generative Language) API. Keeps
 * GOOGLE_AI_API_KEY off the client — the browser posts the plan data, this
 * function builds the prompt, calls Gemini, and returns a structured summary
 * the UI renders as { intro, points:[{title, body}], actions:[string] }.
 *
 * Body: { patientName, programs, conditions, goals, interventions, barriers }
 * where each list item is a small { title, status, progress?, ... } object.
 *
 * Always keeps the API key server-side. Errors return a soft message the
 * client can toast; upstream error bodies stay in the server log.
 */

import { requireUser } from './_lib/requireUser.js';

const MODEL = process.env.GOOGLE_AI_MODEL || 'gemini-3.8-flash';
const ENDPOINT = (key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;

// Force Gemini to answer in exactly the shape the SummaryCard renders.
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    intro: { type: 'string' },
    points: {
      type: 'array',
      items: {
        type: 'object',
        properties: { title: { type: 'string' }, body: { type: 'string' } },
        required: ['title', 'body'],
      },
    },
    actions: { type: 'array', items: { type: 'string' } },
  },
  required: ['intro', 'points', 'actions'],
};

// Count a list by its `status` field so the model gets an accurate roll-up
// instead of having to tally ~170 rows itself (and risk hallucinating totals).
function statusBreakdown(items = []) {
  const by = {};
  for (const it of items) {
    const s = it?.status || 'Unknown';
    by[s] = (by[s] || 0) + 1;
  }
  return by;
}

function avgProgress(goals = []) {
  const vals = goals.map(g => Number(g?.progress)).filter(n => Number.isFinite(n));
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

// Trim each list so the prompt stays a sane size on large plans; the model
// still sees the full counts via the stats block above.
const CAP = 60;
const capList = (arr = []) => (arr.length > CAP ? arr.slice(0, CAP) : arr);

function buildPrompt(plan) {
  const {
    patientName = 'the patient',
    programs = [],
    conditions = [],
    goals = [],
    interventions = [],
    barriers = [],
  } = plan || {};

  const stats = {
    programs: programs.length,
    conditions: conditions.length,
    goals: { total: goals.length, byStatus: statusBreakdown(goals), avgProgress: avgProgress(goals) },
    interventions: { total: interventions.length, byStatus: statusBreakdown(interventions) },
    barriers: { total: barriers.length, byStatus: statusBreakdown(barriers) },
  };

  const payload = {
    patientName,
    programs,
    conditions,
    stats,
    goals: capList(goals),
    interventions: capList(interventions),
    barriers: capList(barriers),
  };

  return [
    'You are a clinical care-coordination assistant. Summarize this patient\'s',
    'care plan for a busy clinician who has about 30 seconds to read it.',
    '',
    'How to write:',
    '- Use plain, everyday language at roughly an 8th-grade reading level.',
    '- Explain any medical term in a few words the first time you use it.',
    '- Be accurate. Use only the facts and numbers provided below. Never invent',
    '  diagnoses, values, dates, or events. Prefer the numbers in "stats".',
    '- Be concise. Short sentences. No filler, no repetition.',
    '',
    'Organize the summary into clear, labelled sections:',
    '- intro: ONE short sentence naming the patient and the overall picture',
    '  (how many programs, and overall goal progress if available).',
    '- points: 3 to 6 items, each a DIFFERENT section of the plan. Give each a',
    '  short Title (2-4 words) and a Body of 1-2 short sentences. Cover, only',
    '  when data exists: Conditions being managed; Goals and how they are',
    '  progressing; Interventions (what the care team is doing); Barriers',
    '  getting in the way; and Program coverage. Skip any section with no data.',
    '- actions: 2 to 5 specific next steps the care team should take, focused on',
    '  what is stalled, overdue, not started, or blocked by a barrier.',
    '',
    'Patient care plan data (JSON):',
    JSON.stringify(payload),
  ].join('\n');
}

export default async function handler(req, res) {
  if (!(await requireUser(req, res))) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }

  const key = process.env.GOOGLE_AI_API_KEY;
  if (!key) {
    return res.status(500).json({
      error: {
        message:
          'GOOGLE_AI_API_KEY is not set. Add it to your Vercel project env vars ' +
          '(Production + Preview + Development) and to .env for local dev.',
      },
    });
  }

  const plan = req.body && typeof req.body === 'object' ? req.body : null;
  if (!plan) {
    return res.status(400).json({ error: { message: 'Missing or invalid plan body' } });
  }

  const requestBody = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: buildPrompt(plan) }] }],
    generationConfig: {
      temperature: 0.4,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  try {
    // Gemini intermittently returns 503 (overloaded) / 429 (rate limit); a
    // couple of short backoff retries turn most of those into a clean result.
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
      const detail = await upstream.text();
      console.error('[care-plan-summary] gemini error', upstream.status, detail);
      const msg = upstream.status === 503 || upstream.status === 429
        ? 'The AI service is busy right now. Please try again in a moment.'
        : `AI service returned ${upstream.status}. Please try again.`;
      return res.status(502).json({ error: { message: msg } });
    }

    const json = await upstream.json();
    const text = json?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    let summary;
    try {
      summary = JSON.parse(text);
    } catch {
      console.error('[care-plan-summary] non-JSON model output:', text.slice(0, 500));
      return res.status(502).json({ error: { message: 'AI returned an unreadable summary. Please try again.' } });
    }

    // Guard the shape so the client never renders undefined.
    const safe = {
      intro: typeof summary.intro === 'string' ? summary.intro : '',
      points: Array.isArray(summary.points)
        ? summary.points.filter(p => p && p.title && p.body).map(p => ({ title: String(p.title), body: String(p.body) }))
        : [],
      actions: Array.isArray(summary.actions) ? summary.actions.filter(Boolean).map(String) : [],
    };

    return res.status(200).json({ summary: safe });
  } catch (err) {
    console.error('[care-plan-summary]', err?.message || err);
    return res.status(502).json({ error: { message: 'Could not reach the AI service. Please try again.' } });
  }
}

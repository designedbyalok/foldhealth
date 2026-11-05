/**
 * POST /api/care-plan-summary
 *
 * Server-side AI summary (OpenAI; see _lib/aiJson.js). Keeps the AI keys
 * off the client: the browser posts the plan data, this function builds the
 * prompt, calls the model, and returns a structured summary
 * the UI renders as { intro, points:[{title, body}], actions:[{text, refType, refId}] }.
 * Each action names the goal, intervention or barrier it is about (refType +
 * refId, from the ids sent), or refType 'plan' for the plan as a whole, so the
 * care plan screen can open that item.
 *
 * Body: { patientName, programs, conditions, goals, interventions, barriers }
 * where each list item is a small { id?, title, status, progress?, ... } object.
 *
 * Always keeps the API key server-side. Errors return a soft message the
 * client can toast; upstream error bodies stay in the server log.
 */

import { requireUser } from '../_lib/requireUser.js';
import { bodyWithinLimit } from '../_lib/limits.js';
import { aiBusy, aiConfigured, generateJson } from '../_lib/aiJson.js';

// Force the model to answer in exactly the shape the SummaryCard renders.
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
    actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          refType: { type: 'string', enum: ['goal', 'intervention', 'barrier', 'plan'] },
          refId: { type: 'string' },
        },
        required: ['text', 'refType', 'refId'],
      },
    },
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
    '  what is stalled, overdue, not started, or blocked by a barrier. Each one',
    '  is a short instruction (text) about ONE goal, intervention or barrier:',
    '  set refType to "goal", "intervention" or "barrier" and refId to that',
    '  item\'s "id" exactly as given. Only when a step is about the whole plan,',
    '  set refType to "plan" and refId to "".',
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

  if (!aiConfigured()) {
    console.error('[care-plan-summary] no AI key is set');
    return res.status(500).json({ error: { message: 'AI summaries are not set up on this deployment.' } });
  }

  // Roughly 170 rows per list fit well under this; the prompt caps them anyway.
  if (!bodyWithinLimit(req, res, 200 * 1024)) return;
  const plan = req.body && typeof req.body === 'object' ? req.body : null;
  if (!plan) {
    return res.status(400).json({ error: { message: 'Missing or invalid plan body' } });
  }

  try {
    const ai = await generateJson({
      prompt: buildPrompt(plan),
      schema: RESPONSE_SCHEMA,
      name: 'care_plan_summary',
      temperature: 0.4,
      logTag: 'care-plan-summary',
      timeoutMs: 30000,
      deadlineMs: 60000,
    });
    if (!ai.ok) {
      const msg = aiBusy(ai.status)
        ? 'The AI service is busy right now. Please try again in a moment.'
        : `AI service returned ${ai.status}. Please try again.`;
      return res.status(502).json({ error: { message: msg } });
    }
    const summary = ai.data;
    // An action's item must be one that was sent, else it is about the plan.
    const ids = {
      goal: new Set((plan.goals || []).map(g => String(g?.id ?? ''))),
      intervention: new Set((plan.interventions || []).map(i => String(i?.id ?? ''))),
      barrier: new Set((plan.barriers || []).map(b => String(b?.id ?? ''))),
    };
    const action = (a) => {
      if (typeof a === 'string') return { text: a, refType: 'plan', refId: '' };
      const known = ids[a?.refType]?.has(String(a?.refId ?? '')) && String(a.refId) !== '';
      return { text: String(a?.text || ''), refType: known ? a.refType : 'plan', refId: known ? String(a.refId) : '' };
    };

    // Guard the shape so the client never renders undefined.
    const safe = {
      intro: typeof summary.intro === 'string' ? summary.intro : '',
      points: Array.isArray(summary.points)
        ? summary.points.filter(p => p && p.title && p.body).map(p => ({ title: String(p.title), body: String(p.body) }))
        : [],
      actions: Array.isArray(summary.actions) ? summary.actions.filter(Boolean).map(action).filter(a => a.text) : [],
    };

    return res.status(200).json({ summary: safe });
  } catch (err) {
    console.error('[care-plan-summary]', err?.message || err);
    return res.status(502).json({ error: { message: 'Could not reach the AI service. Please try again.' } });
  }
}

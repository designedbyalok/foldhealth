/**
 * POST /api/template-optimization
 *
 * Plain-language wording for care plan template suggestions
 * (care_plan_template_suggestions). The nightly SQL analyzer decides what to
 * flag and writes a one-line rule rationale; this writes the "why it matters
 * and what to do" a supervisor reads before accepting. For split and merge it
 * proposes how, from the template's own goals.
 *
 * Body: { suggestions: [{ id, kind, rationale, metrics,
 *   template: { name, conditions, goals: [title] },
 *   related?: { name, conditions, goals: [title] } }] }
 * Returns { rationales: [{ id, text }] }.
 */

import { requireUser } from '../_lib/requireUser.js';
import { bodyWithinLimit } from '../_lib/limits.js';
import { aiBusy, aiConfigured, generateJson } from '../_lib/aiJson.js';

const MAX_SUGGESTIONS = 20;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    rationales: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, text: { type: 'string' } },
        required: ['id', 'text'],
      },
    },
  },
  required: ['rationales'],
};

const KIND_GUIDE = {
  retire: 'Rarely used. Say what retiring means (it leaves the library; plans that use it keep it) and whether anything suggests keeping it.',
  abandon: 'Often removed while a care plan is being built. Suggest what likely makes it a poor fit (too broad, wrong goals for the conditions) and one change to try.',
  goal_attainment: 'Its goals are rarely met. Suggest which goals look unrealistic or vague and how to make targets achievable.',
  split: 'Care teams use only part of it, or it covers many conditions. Propose 2 or 3 smaller templates by grouping its goals, naming each.',
  merge: 'Overlaps with another template. Say which goals they share and propose one combined template name.',
};

function buildPrompt(suggestions) {
  return [
    'You help a clinical supervisor maintain a library of care plan templates.',
    'For each suggestion below, write 2 or 3 short sentences: why it matters,',
    'then one concrete next step. Plain language, no filler.',
    'Use only the numbers and goal titles given. Never invent usage figures,',
    'patients, dates or clinical facts. Refer to goals by their exact titles.',
    '',
    'What each kind means:',
    ...Object.entries(KIND_GUIDE).map(([k, v]) => `- ${k}: ${v}`),
    '',
    'Return one entry per suggestion, with its id unchanged.',
    '',
    'Suggestions (JSON):',
    JSON.stringify(suggestions),
  ].join('\n');
}

const titles = (list) => (Array.isArray(list) ? list.filter(x => typeof x === 'string').slice(0, 40) : []);
const templateOf = (t) => (t && typeof t === 'object'
  ? { name: String(t.name || ''), conditions: titles(t.conditions), goals: titles(t.goals) }
  : null);

export default async function handler(req, res) {
  if (!(await requireUser(req, res))) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }
  if (!aiConfigured()) {
    console.error('[template-optimization] no AI key is set');
    return res.status(500).json({ error: { message: 'AI wording is not set up on this deployment.' } });
  }
  if (!bodyWithinLimit(req, res, 100 * 1024)) return;

  const list = Array.isArray(req.body?.suggestions) ? req.body.suggestions.slice(0, MAX_SUGGESTIONS) : [];
  const suggestions = list
    .filter(s => s && typeof s.id === 'string' && KIND_GUIDE[s.kind])
    .map(s => ({
      id: s.id,
      kind: s.kind,
      rationale: String(s.rationale || ''),
      metrics: s.metrics && typeof s.metrics === 'object' ? s.metrics : {},
      template: templateOf(s.template),
      ...(s.related ? { related: templateOf(s.related) } : {}),
    }));
  if (!suggestions.length) {
    return res.status(400).json({ error: { message: 'No suggestions to word' } });
  }

  try {
    const ai = await generateJson({
      prompt: buildPrompt(suggestions),
      schema: RESPONSE_SCHEMA,
      name: 'template_optimization',
      temperature: 0.3,
      logTag: 'template-optimization',
      timeoutMs: 30000,
      deadlineMs: 60000,
    });
    if (!ai.ok) {
      const msg = aiBusy(ai.status)
        ? 'The AI service is busy right now. Please try again in a moment.'
        : `AI service returned ${ai.status}. Please try again.`;
      return res.status(502).json({ error: { message: msg } });
    }
    const ids = new Set(suggestions.map(s => s.id));
    const rationales = (Array.isArray(ai.data?.rationales) ? ai.data.rationales : [])
      .filter(r => r && ids.has(r.id) && typeof r.text === 'string' && r.text.trim())
      .map(r => ({ id: r.id, text: r.text.trim() }));
    return res.status(200).json({ rationales });
  } catch (err) {
    console.error('[template-optimization]', err?.message || err);
    return res.status(502).json({ error: { message: 'Could not reach the AI service. Please try again.' } });
  }
}

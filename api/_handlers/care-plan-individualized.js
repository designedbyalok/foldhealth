/**
 * POST /api/care-plan-individualized
 *
 * Individualized Plan AI. The client sends the patient's numbered facts
 * (conditions, lab trends, recent events, assessments, barriers), the
 * published templates and a compact library catalog; the model picks the best
 * templates and drafts a tailored GBI set, each item citing facts.
 * normalizeIndividualizedDraft keeps only what's grounded in those inputs.
 * The AI keys stay server-side (see _lib/aiJson.js).
 *
 * Body: { facts, templates, catalog, programName, recommended? }
 * `recommended` lists templates the enrollment automations matched
 * ({ templateId, rule, criteria }); the model then merges all of them.
 * Returns: { draft } or { error: { message } }
 */

import { aiBusy, aiConfigured, generateJson } from '../_lib/aiJson.js';
import { requireUser } from '../_lib/requireUser.js';
import { bodyWithinLimit } from '../_lib/limits.js';
import {
  INDIVIDUALIZED_SCHEMA,
  buildIndividualizedPrompt,
  normalizeIndividualizedDraft,
} from '../../src/features/patient/right-panel/tabs/care-programs/care-plan/lib/individualizedPlan.js';

const asList = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);

export default async function handler(req, res) {
  if (!(await requireUser(req, res))) return;
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'Method not allowed' } });

  if (!aiConfigured()) return res.status(500).json({ error: { message: 'AI drafting is not set up on this deployment.' } });

  // Patient facts and library items ride along, so allow more than the default cap.
  if (!bodyWithinLimit(req, res, 200 * 1024)) return;

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const facts = asList(body.facts, 80).filter(f => f && typeof f.id === 'string' && typeof f.text === 'string');
  if (!facts.length) {
    return res.status(400).json({ error: { message: 'There’s nothing on this patient’s record to plan from yet (conditions, labs, events, assessments or barriers).' } });
  }
  const templates = asList(body.templates, 150);
  const catalog = {
    goals: asList(body.catalog?.goals, 400),
    interventions: asList(body.catalog?.interventions, 400),
    barriers: asList(body.catalog?.barriers, 400),
  };

  const recommended = asList(body.recommended, 20);

  try {
    const ai = await generateJson({
      prompt: buildIndividualizedPrompt({ facts, templates, catalog, programName: String(body.programName || '').slice(0, 100), recommended }),
      schema: INDIVIDUALIZED_SCHEMA,
      name: 'individualized_plan',
      temperature: 0.2,
      geminiThinking: 'low',
      logTag: 'care-plan-individualized',
      timeoutMs: 30000,
      deadlineMs: 75000,
    });
    if (!ai.ok) {
      return res.status(502).json({ error: { message: aiBusy(ai.status)
        ? 'The AI service is busy right now. Please try again in a moment.'
        : 'Could not draft the plan. Please try again.' } });
    }
    const parsed = ai.data;
    const draft = normalizeIndividualizedDraft(parsed, { facts, templates, catalog, recommended });
    if (!draft) return res.status(422).json({ error: { message: 'Could not draft goals grounded in this patient’s record. Add conditions or recent labs and try again.' } });
    return res.status(200).json({ draft });
  } catch (err) {
    console.error('[care-plan-individualized]', err?.message || err);
    return res.status(502).json({ error: { message: 'Could not reach the AI service. Please try again.' } });
  }
}

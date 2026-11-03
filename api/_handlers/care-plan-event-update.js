/**
 * POST /api/care-plan-event-update
 *
 * Event-based care plan updates (#84). The client sends one event the rules
 * matched against a care plan (care-plan/lib/eventImpact.js), why it matched,
 * the changes the rules already propose and the plan itself; the model drafts
 * further changes (status, target, new items). normalizeEventDraft keeps only
 * changes that point at real items on the plan. The AI keys stay server-side
 * (see _lib/aiJson.js).
 *
 * Body: { event, reasons, ruleChanges, plan, programName }
 * Returns: { draft: { summary, changes } } or { error: { message } }
 */

import { aiBusy, aiConfigured, generateJson } from '../_lib/aiJson.js';
import { requireUser } from '../_lib/requireUser.js';
import { bodyWithinLimit } from '../_lib/limits.js';
import {
  EVENT_UPDATE_SCHEMA,
  buildEventUpdatePrompt,
  normalizeEventDraft,
} from '../../src/features/patient/right-panel/tabs/care-programs/care-plan/lib/eventImpact.js';

const asList = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);

export default async function handler(req, res) {
  if (!(await requireUser(req, res))) return;
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'Method not allowed' } });
  if (!aiConfigured()) return res.status(500).json({ error: { message: 'AI drafting is not set up on this deployment.' } });
  if (!bodyWithinLimit(req, res, 100 * 1024)) return;

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const event = body.event && typeof body.event === 'object' ? body.event : null;
  if (!event?.kind) return res.status(400).json({ error: { message: 'No event to evaluate.' } });
  const plan = {
    goals: asList(body.plan?.goals, 60),
    interventions: asList(body.plan?.interventions, 80),
    barriers: asList(body.plan?.barriers, 60),
  };

  try {
    const ai = await generateJson({
      prompt: buildEventUpdatePrompt({
        event,
        reasons: asList(body.reasons, 10).map(String),
        plan,
        ruleChanges: asList(body.ruleChanges, 10),
        programName: String(body.programName || '').slice(0, 100),
      }),
      schema: EVENT_UPDATE_SCHEMA,
      name: 'care_plan_event_update',
      temperature: 0.1,
      geminiThinking: 'low',
      logTag: 'care-plan-event-update',
      timeoutMs: 20000,
      deadlineMs: 45000,
    });
    if (!ai.ok) {
      return res.status(502).json({ error: { message: aiBusy(ai.status)
        ? 'The AI service is busy right now. Please try again in a moment.'
        : 'Could not draft plan updates for this event.' } });
    }
    const draft = normalizeEventDraft(ai.data, plan);
    if (!draft) return res.status(422).json({ error: { message: 'Could not draft plan updates for this event.' } });
    return res.status(200).json({ draft });
  } catch (err) {
    console.error('[care-plan-event-update]', err?.message || err);
    return res.status(502).json({ error: { message: 'Could not reach the AI service. Please try again.' } });
  }
}

/**
 * POST /api/care-plan-template-draft
 *
 * Drafts a care plan template from a plain-English description (OpenAI; see _lib/aiJson.js).
 * The client sends the description and a compact catalog of the care plan
 * library; the answer is checked against that catalog (normalizeTemplateDraft)
 * so every library reference is real. The AI keys stay server-side.
 *
 * Body: { description: string, catalog: { goals, interventions, barriers },
 *         protocol?: { title, version, organization, guidance },
 *         options?: { categories?: boolean, libraryOnly?: boolean } }
 * Returns: { draft } or { error: { message } }
 */

import { aiBusy, aiConfigured, generateJson } from '../_lib/aiJson.js';
import { requireUser } from '../_lib/requireUser.js';
import { bodyWithinLimit } from '../_lib/limits.js';
import {
  TEMPLATE_DESCRIPTION_MAX,
  TEMPLATE_DRAFT_SCHEMA,
  buildTemplateDraftPrompt,
  normalizeTemplateDraft,
} from '../../src/features/settings/care-plan-library/lib/aiTemplateDraft.js';

const asList = (v) => (Array.isArray(v) ? v : []);

export default async function handler(req, res) {
  if (!(await requireUser(req, res))) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }

  if (!aiConfigured()) {
    return res.status(500).json({ error: { message: 'AI drafting is not set up on this deployment.' } });
  }

  // The library catalog rides along, so allow more than the default cap.
  if (!bodyWithinLimit(req, res, 200 * 1024)) return;

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  if (description.length < 10) {
    return res.status(400).json({ error: { message: 'Describe the template in a sentence or two.' } });
  }
  if (description.length > TEMPLATE_DESCRIPTION_MAX) {
    return res.status(400).json({ error: { message: `Keep the description under ${TEMPLATE_DESCRIPTION_MAX} characters.` } });
  }
  // An Active clinical protocol the draft must follow, as plain guidance lines.
  const p = body.protocol && typeof body.protocol === 'object' ? body.protocol : null;
  const protocol = p && typeof p.guidance === 'string' && p.guidance.trim()
    ? { title: String(p.title || ''), version: String(p.version || ''), organization: String(p.organization || ''), guidance: p.guidance }
    : null;
  // Drafting from an approved protocol: Common + categories, library items only.
  const options = {
    categories: !!protocol && body.options?.categories === true,
    libraryOnly: body.options?.libraryOnly === true,
  };
  const catalog = {
    goals: asList(body.catalog?.goals),
    interventions: asList(body.catalog?.interventions),
    barriers: asList(body.catalog?.barriers),
  };

  try {
    const ai = await generateJson({
      prompt: buildTemplateDraftPrompt(description, catalog, protocol, options),
      schema: TEMPLATE_DRAFT_SCHEMA,
      name: 'care_plan_template',
      temperature: 0.3,
      geminiThinking: 'low',
      logTag: 'care-plan-template-draft',
      // A stalled call fails over instead of leaving the editor waiting; a
      // busy model's quick 503 falls through to the next, within a minute.
      timeoutMs: 25000,
      deadlineMs: 60000,
    });
    if (!ai.ok) {
      const message = aiBusy(ai.status)
        ? 'The AI service is busy right now. Please try again in a moment.'
        : 'Could not draft the template. Please try again.';
      return res.status(502).json({ error: { message } });
    }
    const parsed = ai.data;

    const draft = normalizeTemplateDraft(parsed, catalog, options);
    if (!draft) {
      return res.status(422).json({ error: { message: 'Could not draft goals from that description. Try adding the condition or focus.' } });
    }
    return res.status(200).json({ draft });
  } catch (err) {
    console.error('[care-plan-template-draft]', err?.message || err);
    return res.status(502).json({ error: { message: 'Could not reach the AI service. Please try again.' } });
  }
}

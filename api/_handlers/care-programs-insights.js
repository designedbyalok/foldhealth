/**
 * POST /api/care-programs-insights
 *
 * The Care Programs overview's two narrative cards, written by the AI model
 * (see _lib/aiJson.js) from facts the overview already computed from the
 * records:
 *   why:     { takeaways: [{ text, tone: 'danger'|'warning', ref }], paragraph }
 *            Why the patient is prioritized now.
 *   summary: { lead, points: [{ title, body }] }
 *            The clinical picture across the programs.
 *
 * A takeaway's `ref` is the key of the action, reading or concern it is
 * about (from the keys sent), or '' when it is about the patient overall, so
 * the card can open it.
 *
 * Body: { firstName, acuity, conditions, programs, actions, totals, readings, concerns }.
 * Only what the overview shows is sent: no identifiers beyond the first name.
 * The API key stays server-side; errors return a soft message to toast.
 */

import { requireUser } from '../_lib/requireUser.js';
import { bodyWithinLimit } from '../_lib/limits.js';
import { aiBusy, aiConfigured, generateJson } from '../_lib/aiJson.js';

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    why: {
      type: 'object',
      properties: {
        takeaways: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              tone: { type: 'string', enum: ['danger', 'warning'] },
              ref: { type: 'string' },
            },
            required: ['text', 'tone', 'ref'],
          },
        },
        paragraph: { type: 'string' },
      },
      required: ['takeaways', 'paragraph'],
    },
    summary: {
      type: 'object',
      properties: {
        lead: { type: 'string' },
        points: {
          type: 'array',
          items: {
            type: 'object',
            properties: { title: { type: 'string' }, body: { type: 'string' } },
            required: ['title', 'body'],
          },
        },
      },
      required: ['lead', 'points'],
    },
  },
  required: ['why', 'summary'],
};

const CAP = 40;
const cap = (arr) => (Array.isArray(arr) ? arr.slice(0, CAP) : []);

function buildPrompt(facts) {
  const payload = {
    firstName: facts.firstName || 'The patient',
    acuity: facts.acuity || null,
    conditions: cap(facts.conditions),
    programs: cap(facts.programs),
    totals: facts.totals || null,
    actions: cap(facts.actions),
    readings: cap(facts.readings),
    concerns: cap(facts.concerns),
  };
  return [
    'You are a clinical care-coordination assistant. A care manager is opening',
    'this patient\'s Care Programs tab and has about 20 seconds to read it.',
    '',
    'How to write:',
    '- Plain, everyday language at roughly an 8th-grade reading level.',
    '- Use only the facts and numbers given below. Never invent diagnoses,',
    '  values, dates, steps or events. Prefer the numbers in "totals".',
    '- Short sentences. No filler. Refer to the patient by first name.',
    '- Name programs by their code (for example CCM, SNP).',
    '',
    'Write two things:',
    '1. why: why this patient is prioritized right now.',
    '   - takeaways: 1 to 4 short lines (under 12 words each), most urgent',
    '     first. tone "danger" for overdue or urgent work, "warning" for',
    '     goals off target, unaddressed barriers or a high acuity. Set ref to',
    '     the "key" of the action, reading or concern the line is about,',
    '     exactly as given, or "" when it is about the patient overall.',
    '   - paragraph: 2 to 3 sentences tying it together: what is urgent, how',
    '     the care plans are going, and where the programs stand.',
    '2. summary: the clinical picture across the programs.',
    '   - lead: 1 to 2 sentences on who the patient is clinically (acuity,',
    '     chronic conditions) and how the monitored goals stand.',
    '   - points: 2 to 4 items, each a different topic (for example Readings,',
    '     Open concerns, Program progress). A short title (2 to 3 words) and',
    '     a body of 1 to 2 sentences. Skip a topic with no data.',
    '',
    'If nothing is urgent, say so plainly instead of inventing urgency.',
    '',
    'Patient facts (JSON):',
    JSON.stringify(payload),
  ].join('\n');
}

const str = (v) => (typeof v === 'string' ? v : '');

export default async function handler(req, res) {
  if (!(await requireUser(req, res))) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }

  if (!aiConfigured()) {
    console.error('[care-programs-insights] no AI key is set');
    return res.status(500).json({ error: { message: 'AI summaries are not set up on this deployment.' } });
  }

  if (!bodyWithinLimit(req, res, 100 * 1024)) return;
  const facts = req.body && typeof req.body === 'object' ? req.body : null;
  if (!facts) {
    return res.status(400).json({ error: { message: 'Missing or invalid body' } });
  }

  try {
    const ai = await generateJson({
      prompt: buildPrompt(facts),
      schema: RESPONSE_SCHEMA,
      name: 'care_programs_insights',
      temperature: 0.3,
      logTag: 'care-programs-insights',
      timeoutMs: 30000,
      deadlineMs: 60000,
    });
    if (!ai.ok) {
      const msg = aiBusy(ai.status)
        ? 'The AI service is busy right now. Please try again in a moment.'
        : `AI service returned ${ai.status}. Please try again.`;
      return res.status(502).json({ error: { message: msg } });
    }

    // A takeaway's ref must be a key that was sent, else it's about the patient.
    const keys = new Set(
      [...cap(facts.actions), ...cap(facts.readings), ...cap(facts.concerns)].map(x => String(x?.key ?? '')).filter(Boolean),
    );
    const why = ai.data?.why || {};
    const summary = ai.data?.summary || {};
    const insights = {
      why: {
        takeaways: (Array.isArray(why.takeaways) ? why.takeaways : [])
          .filter(t => t && str(t.text))
          .slice(0, 4)
          .map(t => ({
            text: str(t.text),
            tone: t.tone === 'danger' ? 'danger' : 'warning',
            ref: keys.has(str(t.ref)) ? str(t.ref) : '',
          })),
        paragraph: str(why.paragraph),
      },
      summary: {
        lead: str(summary.lead),
        points: (Array.isArray(summary.points) ? summary.points : [])
          .filter(p => p && str(p.title) && str(p.body))
          .slice(0, 4)
          .map(p => ({ title: str(p.title), body: str(p.body) })),
      },
    };
    return res.status(200).json({ insights });
  } catch (err) {
    console.error('[care-programs-insights]', err?.message || err);
    return res.status(502).json({ error: { message: 'Could not reach the AI service. Please try again.' } });
  }
}

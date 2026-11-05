/**
 * POST /api/clinical-protocol-parse
 *
 * Extracts a structured clinical protocol (condition scope, thresholds,
 * decision rules, cadence, medication titration, cross-references) from a
 * client's clinical practice guidance (OpenAI; see _lib/aiJson.js). The browser sends the text
 * it extracted from the PDF / Word / JSON file; the answer is normalized
 * against the Fold protocol schema and every item keeps the passage it came
 * from, for the supervisor's review. The AI keys stay server-side.
 *
 * Body: { text: string, fileName?: string, programs?: [{ code, name }] }
 * Returns: { metadata, protocol, warnings, model } or { error: { message } }
 */

import { aiBusy, aiConfigured, generateJson } from '../_lib/aiJson.js';
import { requireUser } from '../_lib/requireUser.js';
import { bodyWithinLimit } from '../_lib/limits.js';
import {
  PROTOCOL_PARSE_SCHEMA,
  PROTOCOL_TEXT_MAX,
  buildProtocolParsePrompt,
  normalizeProtocol,
  protocolCounts,
} from '../../src/features/settings/clinical-protocols/lib/protocolSchema.js';

const asList = (v) => (Array.isArray(v) ? v : []);

export default async function handler(req, res) {
  if (!(await requireUser(req, res))) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }

  if (!aiConfigured()) {
    return res.status(500).json({ error: { message: 'Protocol parsing is not set up on this deployment.' } });
  }

  // Document text up to PROTOCOL_TEXT_MAX characters, JSON-escaped.
  if (!bodyWithinLimit(req, res, 640 * 1024)) return;

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (text.length < 40) {
    return res.status(400).json({ error: { message: 'The document has too little text to parse.' } });
  }
  const programs = asList(body.programs)
    .filter(p => p && typeof p.code === 'string')
    .slice(0, 50)
    .map(p => ({ code: p.code.slice(0, 20), name: String(p.name || '').slice(0, 80) }));

  try {
    const ai = await generateJson({
      prompt: buildProtocolParsePrompt(text.slice(0, PROTOCOL_TEXT_MAX), { programs, fileName: body.fileName }),
      schema: PROTOCOL_PARSE_SCHEMA,
      name: 'clinical_protocol',
      temperature: 0,
      geminiThinking: 'low',
      logTag: 'clinical-protocol-parse',
      // Long guidance documents take a while; fail over rather than hang.
      timeoutMs: 75000,
      deadlineMs: 150000,
    });
    if (!ai.ok) {
      const message = aiBusy(ai.status)
        ? 'The AI service is busy right now. Please try again in a moment.'
        : 'Could not parse the protocol. Please try again.';
      return res.status(502).json({ error: { message } });
    }
    const parsed = ai.data;
    const model = ai.model;

    const result = normalizeProtocol(parsed, { programCodes: programs.map(p => p.code) });
    if (!result.metadata.title && protocolCounts(result.protocol).total === 0) {
      return res.status(422).json({ error: { message: 'No protocol content was found in this document.' } });
    }
    return res.status(200).json({ ...result, model });
  } catch (err) {
    console.error('[clinical-protocol-parse]', err?.message || err);
    return res.status(502).json({ error: { message: 'Could not reach the AI service. Please try again.' } });
  }
}

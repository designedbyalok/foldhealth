/**
 * POST /api/pop-group-rule-from-nl
 *
 * Turns natural-language population rule descriptions into a validated
 * rule tree via Gemini. GOOGLE_AI_API_KEY stays server-side.
 *
 * Body: { prompt?: string, messages?: {role, content}[], currentRule?: object }
 * Returns: { rule, summary } or { error: { message } }
 */

import { geminiGenerateContent } from './_lib/googleGemini.js';
import { buildAiFieldCatalog, buildAiRuleInstructions } from '../src/features/population-groups/rule-builder/aiRuleCatalog.js';
import { AI_RULE_RESPONSE_SCHEMA } from '../src/features/population-groups/rule-builder/aiRuleResponseSchema.js';
import { normalizeAiRuleQuery } from '../src/features/population-groups/rule-builder/normalizeAiRuleQuery.js';
import { requireUser } from './_lib/requireUser.js';

function buildPrompt({ prompt, messages, currentRule }) {
  const catalog = buildAiFieldCatalog({ compact: true });
  const lines = [
    'You are a clinical population-health rule assistant for Fold Health.',
    'Maintain a multi-turn conversation: each turn outputs an updated rule tree.',
    'When the user refines prior work, merge their intent into the current draft unless they ask to start over.',
    '',
    buildAiRuleInstructions(),
    '',
    'Chat reply (summary field): max 12 words, friendly, no condition lists.',
    '',
    'Field catalog (JSON):',
    JSON.stringify(catalog),
  ];
  if (currentRule && typeof currentRule === 'object' && Array.isArray(currentRule.rules)) {
    lines.push('', 'Current draft rule on canvas (JSON):', JSON.stringify(currentRule));
  }
  const history = Array.isArray(messages) ? messages.filter((m) => m?.role && m?.content) : [];
  const recent = history.slice(-8);
  if (recent.length) {
    lines.push('', 'Conversation (recent):');
    recent.forEach((m) => {
      lines.push(`${m.role === 'assistant' ? 'Assistant' : 'User'}: ${String(m.content).trim()}`);
    });
  }
  const latest = String(prompt || '').trim();
  if (latest) lines.push('', 'Latest user message:', latest);
  return lines.join('\n');
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
          'GOOGLE_AI_API_KEY is not available on this deployment. On Vercel (foldhealth project): ' +
          'Settings → Environment Variables → add GOOGLE_AI_API_KEY with Production enabled, then redeploy. ' +
          'Local dev uses .env in the repo root (not committed).',
      },
    });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : null;
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  const lastUser = [...messages].reverse().find((m) => m?.role === 'user' && String(m.content || '').trim());
  const effectivePrompt = prompt || (lastUser ? String(lastUser.content).trim() : '');
  if (!effectivePrompt) {
    return res.status(400).json({ error: { message: 'Enter a description of the rule you want.' } });
  }

  const requestBody = JSON.stringify({
    contents: [{
      role: 'user',
      parts: [{
        text: buildPrompt({
          prompt: effectivePrompt,
          messages,
          currentRule: body.currentRule,
        }),
      }],
    }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: AI_RULE_RESPONSE_SCHEMA,
    },
  });

  try {
    const { response: upstream, model } = await geminiGenerateContent({
      apiKey: key,
      requestBody,
      logTag: 'pop-group-rule-from-nl',
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      console.error('[pop-group-rule-from-nl] gemini error', upstream.status, model, detail.slice(0, 400));
      const msg = upstream.status === 503 || upstream.status === 429
        ? 'The AI service is busy right now. Please try again in a moment.'
        : `AI service returned ${upstream.status}. Please try again.`;
      return res.status(502).json({ error: { message: msg } });
    }

    const json = await upstream.json();
    const text = json?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      console.error('[pop-group-rule-from-nl] non-JSON:', text.slice(0, 500));
      return res.status(502).json({ error: { message: 'AI returned an unreadable rule. Please try again.' } });
    }

    const { query, errors } = normalizeAiRuleQuery(parsed.rule);
    if (!query) {
      console.error('[pop-group-rule-from-nl] validation:', errors);
      return res.status(422).json({
        error: {
          message: errors[0] || 'Could not build a valid rule from that description.',
          details: errors.slice(0, 5),
        },
      });
    }

    const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
    return res.status(200).json({ rule: query, summary });
  } catch (err) {
    console.error('[pop-group-rule-from-nl]', err?.message || err);
    return res.status(502).json({ error: { message: 'Could not reach the AI service. Please try again.' } });
  }
}

/**
 * Structured AI output for every /api AI handler: one prompt in, one JSON
 * object matching `schema` out. OpenAI (OPENAI_API_KEY) is the provider;
 * Gemini (GOOGLE_AI_API_KEY) only answers when no OpenAI key is set, so a
 * deployment without the OpenAI key keeps working.
 *
 * `schema` is written in the OpenAPI subset the handlers already use
 * (`nullable: true`, optional properties); it is converted to OpenAI's strict
 * JSON schema here, where every property is required and an optional one
 * becomes nullable; those added nulls are removed from the answer again, so
 * handlers see the same shape either provider returns.
 */

import { geminiGenerateContent } from './googleGemini.js';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
// gpt-6-luna with reasoning off: the cheapest current model, and the most
// accurate in our protocol-extraction tests. gpt-5.4-mini answers if Luna is
// unavailable. OPENAI_MODEL overrides the first pick.
const OPENAI_MODELS = ['gpt-6-luna', 'gpt-5.4-mini'];
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Whether any AI provider is configured on this deployment. */
export const aiConfigured = () => !!(process.env.OPENAI_API_KEY || process.env.GOOGLE_AI_API_KEY);

function openAiModels() {
  const override = process.env.OPENAI_MODEL?.trim();
  return [...new Set([override, ...OPENAI_MODELS].filter(Boolean))];
}

const nullableType = (s) => (Array.isArray(s.type) ? s.type : [s.type]);

/** OpenAPI-subset schema → OpenAI strict JSON schema. */
export function toStrictSchema(s, forceNullable = false) {
  if (!s || typeof s !== 'object') return s;
  const nullable = forceNullable || s.nullable === true;
  const out = {};
  if (s.description) out.description = s.description;
  if (s.type === 'object') {
    const required = new Set(s.required || []);
    const props = s.properties || {};
    out.type = nullable ? ['object', 'null'] : 'object';
    out.properties = Object.fromEntries(
      Object.entries(props).map(([k, v]) => [k, toStrictSchema(v, !required.has(k))]),
    );
    out.required = Object.keys(props);
    out.additionalProperties = false;
    return out;
  }
  if (s.type === 'array') {
    out.type = nullable ? ['array', 'null'] : 'array';
    out.items = toStrictSchema(s.items);
    return out;
  }
  out.type = nullable ? [...nullableType(s), 'null'] : s.type;
  if (Array.isArray(s.enum)) out.enum = nullable ? [...s.enum, null] : s.enum;
  return out;
}

/** Drops the nulls toStrictSchema made the model send for optional properties. */
export function stripAddedNulls(value, s) {
  if (!s || value == null) return value;
  if (s.type === 'array' && Array.isArray(value)) return value.map(v => stripAddedNulls(v, s.items));
  if (s.type !== 'object' || typeof value !== 'object' || Array.isArray(value)) return value;
  const required = new Set(s.required || []);
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    const prop = s.properties?.[k];
    if (v === null && !required.has(k) && prop?.nullable !== true) continue;
    out[k] = stripAddedNulls(v, prop);
  }
  return out;
}

async function openAiJson({ apiKey, prompt, schema, name, effort, logTag, timeoutMs, deadlineMs }) {
  const startedAt = Date.now();
  const outOfTime = () => deadlineMs && Date.now() - startedAt >= deadlineMs;
  const models = openAiModels();
  const jsonSchema = { name: name || 'result', strict: true, schema: toStrictSchema(schema) };
  let last = { status: 502, model: models[0] };

  for (const model of models) {
    const maxAttempts = models.indexOf(model) === 0 ? 3 : 2;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (outOfTime() && attempt + models.indexOf(model) > 0) return { ok: false, ...last };
      let response;
      try {
        response = await fetch(OPENAI_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_schema', json_schema: jsonSchema },
            reasoning_effort: effort,
          }),
          signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
        });
      } catch (err) {
        if (err?.name !== 'TimeoutError') throw err;
        console.warn(`[${logTag}] ${model} no answer in ${timeoutMs}ms`);
        response = new Response('{}', { status: 504 });
      }
      last = { status: response.status, model };

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        // An unknown or unavailable model: try the next one.
        if (response.status === 404 || (response.status === 400 && /model/i.test(detail))) {
          console.warn(`[${logTag}] model not available: ${model}`, detail.slice(0, 200));
          break;
        }
        if (!RETRYABLE.has(response.status)) {
          console.error(`[${logTag}] openai error`, response.status, model, detail.slice(0, 400));
          return { ok: false, ...last };
        }
        if (attempt >= maxAttempts - 1) break;
        const delay = Math.min(4000, 600 * Math.pow(2, attempt));
        console.warn(`[${logTag}] ${model} ${response.status}, retry ${attempt + 1} in ${delay}ms`);
        await sleep(delay);
        continue;
      }

      const json = await response.json();
      const message = json?.choices?.[0]?.message;
      if (message?.refusal) {
        console.error(`[${logTag}] ${model} refused:`, String(message.refusal).slice(0, 300));
        return { ok: false, status: 422, model };
      }
      try {
        return { ok: true, data: stripAddedNulls(JSON.parse(message?.content || ''), schema), model, provider: 'openai' };
      } catch {
        console.error(`[${logTag}] ${model} non-JSON:`, String(message?.content || '').slice(0, 300));
        return { ok: false, status: 502, model };
      }
    }
  }
  return { ok: false, ...last };
}

async function geminiJson({ apiKey, prompt, schema, temperature, geminiThinking, logTag, timeoutMs, deadlineMs }) {
  const generationConfig = { responseMimeType: 'application/json', responseSchema: schema };
  if (temperature != null) generationConfig.temperature = temperature;
  if (geminiThinking) generationConfig.thinkingConfig = { thinkingLevel: geminiThinking };
  const { response, model } = await geminiGenerateContent({
    apiKey,
    requestBody: { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig },
    logTag,
    timeoutMs,
    deadlineMs,
  });
  if (!response.ok) {
    console.error(`[${logTag}] gemini error`, response.status, model, (await response.text().catch(() => '')).slice(0, 400));
    return { ok: false, status: response.status, model };
  }
  const json = await response.json();
  const text = json?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
  try {
    return { ok: true, data: JSON.parse(text), model, provider: 'gemini' };
  } catch {
    console.error(`[${logTag}] gemini non-JSON:`, text.slice(0, 300));
    return { ok: false, status: 502, model };
  }
}

/**
 * @param {object} opts
 * @param {string} opts.prompt
 * @param {object} opts.schema       OpenAPI-subset response schema
 * @param {string} [opts.name]       schema name (OpenAI)
 * @param {'none'|'low'|'medium'|'high'} [opts.effort]  OpenAI reasoning effort (off by default)
 * @param {number} [opts.temperature]    Gemini only (GPT-5 models fix it)
 * @param {string} [opts.geminiThinking] Gemini thinkingLevel, when the handler used one
 * @param {string} [opts.logTag]
 * @param {number} [opts.timeoutMs]  per attempt
 * @param {number} [opts.deadlineMs] whole call
 * @returns {Promise<{ ok: true, data: object, model: string, provider: string } | { ok: false, status: number, model: string }>}
 *   `status` 429 / 503 / 504 mean the service is busy; 422 a refusal.
 */
export async function generateJson({
  prompt, schema, name, effort = 'none', temperature, geminiThinking,
  logTag = 'ai', timeoutMs, deadlineMs,
}) {
  const openAiKey = process.env.OPENAI_API_KEY;
  if (openAiKey) {
    return openAiJson({ apiKey: openAiKey, prompt, schema, name, effort, logTag, timeoutMs, deadlineMs });
  }
  const geminiKey = process.env.GOOGLE_AI_API_KEY;
  if (geminiKey) {
    return geminiJson({ apiKey: geminiKey, prompt, schema, temperature, geminiThinking, logTag, timeoutMs, deadlineMs });
  }
  return { ok: false, status: 500, model: null };
}

/** True when a failed call's status means "busy, try again". */
export const aiBusy = (status) => [429, 503, 504].includes(status);

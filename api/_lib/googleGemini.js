/**
 * Shared Gemini generateContent helper: retries + model fallback chain.
 */

const DEFAULT_MODEL_CHAIN = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
];

const RETRYABLE = new Set([429, 500, 502, 503, 504]);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function geminiModelChain() {
  const primary = process.env.GOOGLE_AI_MODEL?.trim();
  const fromEnv = (process.env.GOOGLE_AI_FALLBACK_MODELS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([primary, ...fromEnv, ...DEFAULT_MODEL_CHAIN].filter(Boolean))];
}

/**
 * `timeoutMs` (optional) caps each attempt: a request that hasn't answered by
 * then is abandoned and retried / failed over like a 503, instead of hanging
 * while the model is overloaded. When every attempt times out the result is
 * a synthetic 504. `deadlineMs` (optional) is the budget for the whole
 * chain: no new attempt starts once it has passed.
 *
 * @param {{ apiKey: string, requestBody: object | string, models?: string[], logTag?: string, timeoutMs?: number, deadlineMs?: number }} opts
 * @returns {Promise<{ response: Response, model: string }>}
 */
export async function geminiGenerateContent({
  apiKey,
  requestBody,
  models = geminiModelChain(),
  logTag = 'googleGemini',
  timeoutMs,
  deadlineMs,
}) {
  const startedAt = Date.now();
  const outOfTime = () => deadlineMs && Date.now() - startedAt >= deadlineMs;
  const bodyStr = typeof requestBody === 'string' ? requestBody : JSON.stringify(requestBody);
  let lastResponse = null;
  let lastModel = models[0] || 'unknown';

  for (const model of models) {
    lastModel = model;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const maxAttempts = models.indexOf(model) === 0 ? 3 : 2;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (outOfTime() && lastResponse) return { response: lastResponse, model: lastModel };
      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          // In a header, not the query string, so the key stays out of URL logs.
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: bodyStr,
          signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
        });
      } catch (err) {
        if (err?.name !== 'TimeoutError') throw err;
        console.warn(`[${logTag}] ${model} no answer in ${timeoutMs}ms`);
        response = new Response(JSON.stringify({ error: { message: 'Timed out' } }), { status: 504 });
      }
      lastResponse = response;

      if (response.ok) {
        return { response, model };
      }

      if (response.status === 404) {
        console.warn(`[${logTag}] model not available: ${model}`);
        break;
      }

      if (!RETRYABLE.has(response.status)) {
        return { response, model };
      }

      if (attempt >= maxAttempts - 1) break;

      const delay = Math.min(4000, 600 * Math.pow(2, attempt));
      console.warn(`[${logTag}] ${model} ${response.status}, retry ${attempt + 1} in ${delay}ms`);
      await sleep(delay);
    }
  }

  return { response: lastResponse, model: lastModel };
}

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
 * @param {{ apiKey: string, requestBody: object | string, models?: string[], logTag?: string }} opts
 * @returns {Promise<{ response: Response, model: string }>}
 */
export async function geminiGenerateContent({
  apiKey,
  requestBody,
  models = geminiModelChain(),
  logTag = 'googleGemini',
}) {
  const bodyStr = typeof requestBody === 'string' ? requestBody : JSON.stringify(requestBody);
  let lastResponse = null;
  let lastModel = models[0] || 'unknown';

  for (const model of models) {
    lastModel = model;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const maxAttempts = models.indexOf(model) === 0 ? 3 : 2;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyStr,
      });
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

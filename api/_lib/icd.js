/**
 * WHO ICD-11 API client: shared by the Vercel serverless function
 * (`api/icd-search.js`) and the Vite dev middleware. No framework deps: it
 * takes an `env` bag so it works with `process.env` in both places.
 *
 * The ClientSecret NEVER reaches the browser, this module only ever runs
 * server-side (Vercel function or the local dev-api plugin).
 *
 * Endpoints (WHO cloud defaults, all overridable via env):
 *   token   POST  https://icdaccessmanagement.who.int/connect/token
 *   search  GET   https://id.who.int/icd/release/11/{release}/{lin}/search?q=
 *
 * Docs: https://icd.who.int/docs/icd-api/APIDoc-Version2/
 */

const TOKEN_REFRESH_MARGIN_MS = 60_000;

// Module-scoped token cache. Persists across warm Vercel invocations; in dev
// the plugin re-imports the module per request, which just means a fresh token
// fetch each time: harmless.
let tokenCache = { value: null, expiresAt: 0 };

function cfg(env = {}) {
  return {
    clientId: env.ICD_CLIENT_ID || '',
    clientSecret: env.ICD_CLIENT_SECRET || '',
    tokenUrl: env.ICD_TOKEN_URL || 'https://icdaccessmanagement.who.int/connect/token',
    apiBase: (env.ICD_API_BASE || 'https://id.who.int').replace(/\/+$/, ''),
    release: env.ICD_RELEASE || '2024-01',
    linearization: env.ICD_LINEARIZATION || 'mms',
    language: env.ICD_LANGUAGE || 'en',
    supabaseUrl: (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/+$/, ''),
    serviceKey: env.SUPABASE_SERVICE_ROLE_KEY || '',
  };
}

export function isConfigured(env) {
  const c = cfg(env);
  return !!(c.clientId && c.clientSecret);
}

async function getToken(c) {
  const now = Date.now();
  if (tokenCache.value && tokenCache.expiresAt > now + TOKEN_REFRESH_MARGIN_MS) {
    return tokenCache.value;
  }
  const resp = await fetch(c.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'icdapi_access',
      client_id: c.clientId,
      client_secret: c.clientSecret,
    }),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    throw new Error(`ICD token request failed (${resp.status}): ${detail.slice(0, 200)}`);
  }
  const json = await resp.json();
  tokenCache = {
    value: json.access_token,
    expiresAt: now + (Number(json.expires_in) || 3600) * 1000,
  };
  return tokenCache.value;
}

// WHO returns highlighted titles like `Type 2 <em class='found'>diabetes</em>`.
const stripTags = (s) => (s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

function normalize(json, limit) {
  const entities = Array.isArray(json?.destinationEntities) ? json.destinationEntities : [];
  const out = [];
  const seen = new Set();
  for (const e of entities) {
    const code = (e.theCode || '').trim();
    const title = stripTags(e.title);
    if (!title) continue;
    const key = code || title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      code,
      title,
      id: e.id || '',
      chapter: e.chapter || '',
      score: typeof e.score === 'number' ? e.score : null,
      hasCode: !!code,
    });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Search ICD by keyword or code. Returns `{ results, source }` where source is
 * 'who' (live API), 'unconfigured' (no creds: caller should fall back), or
 * 'empty' (blank query).
 */
export async function searchIcd({ q, limit = 15, env }) {
  const query = (q || '').trim();
  if (!query) return { results: [], source: 'empty' };

  const c = cfg(env);
  if (!c.clientId || !c.clientSecret) return { results: [], source: 'unconfigured' };

  const token = await getToken(c);
  const url =
    `${c.apiBase}/icd/release/11/${encodeURIComponent(c.release)}/${c.linearization}/search` +
    `?q=${encodeURIComponent(query)}&flatResults=true&highlightingEnabled=false&useFlexisearch=false`;

  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Accept-Language': c.language,
      'API-Version': 'v2',
    },
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    throw new Error(`ICD search failed (${resp.status}): ${detail.slice(0, 200)}`);
  }
  const json = await resp.json();
  const results = normalize(json, limit);

  // Best-effort write-through cache into Supabase: never blocks the response.
  cacheUpsert(c, results).catch(() => {});

  return { results, source: 'who' };
}

// Upsert fetched codes into the `icd_codes` cache table via the Supabase REST
// API using the service role. Fire-and-forget: failures are swallowed so a
// cache hiccup never breaks search.
async function cacheUpsert(c, results) {
  if (!c.supabaseUrl || !c.serviceKey) return;
  const rows = [];
  for (const r of results) {
    if (!r.hasCode) continue;
    rows.push({
      code: r.code,
      title: r.title,
      chapter: r.chapter || null,
      entity_id: r.id || null,
      source: 'who',
      updated_at: new Date().toISOString(),
    });
  }
  if (!rows.length) return;
  await fetch(`${c.supabaseUrl}/rest/v1/icd_codes?on_conflict=code`, {
    method: 'POST',
    headers: {
      apikey: c.serviceKey,
      Authorization: `Bearer ${c.serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
}

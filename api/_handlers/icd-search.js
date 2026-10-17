import { searchIcd } from '../_lib/icd.js';

/**
 * GET /api/icd-search?q=<term>&limit=<n>
 *
 * Server-side proxy for the WHO ICD-11 API. Keeps the OAuth ClientSecret off
 * the client. Always responds 200 with `{ results, source }` so the frontend
 * can gracefully fall back to its bundled catalog when the API is
 * unconfigured or unreachable.
 */
export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const q = url.searchParams.get('q') || '';
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 15));

    const out = await searchIcd({ q, limit, env: process.env });

    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600');
    return res.status(200).json(out);
  } catch (err) {
    // Degrade to a soft error the client can fall back from, never a 500.
    // Details stay in the server log — upstream error bodies may include
    // request internals that don't belong in the browser.
    console.error('[icd-search]', err?.message || err);
    return res.status(200).json({ results: [], source: 'error' });
  }
}

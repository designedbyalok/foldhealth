import { searchSubstances } from '../_lib/allergySubstances.js';

/**
 * GET /api/reference/allergies/substances?q=<term>&limit=<n>
 *
 * Server-side proxy for the UMLS/SNOMED CT search the Add Allergies drawer
 * uses for non-drug allergens. Keeps UMLS_API_KEY off the client. Always
 * responds 200 with `{ results, source }` so the picker can keep showing its
 * drug (RxNorm) results when this side is unconfigured or unreachable.
 */
export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const q = url.searchParams.get('q') || '';
    const limit = Math.min(25, Math.max(1, Number(url.searchParams.get('limit')) || 10));

    const out = await searchSubstances({ q, limit, env: process.env });

    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600');
    return res.status(200).json(out);
  } catch (err) {
    // Degrade to a soft error the picker can fall back from, never a 500.
    // Upstream error bodies stay in the server log.
    console.error('[allergy-substances]', err?.message || err);
    return res.status(200).json({ results: [], source: 'error' });
  }
}

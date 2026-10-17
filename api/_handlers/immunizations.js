import { searchImmunizations, findImmunizationByCode } from '../_lib/cvxService.js';

/**
 * GET /api/reference/immunizations?q=<term>&limit=<n>&activeOnly=1
 * GET /api/reference/immunizations?code=<cvx>
 *
 * CVX vaccine lookup for the Add Immunizations drawer. Answers from the
 * cache `scripts/sync-cvx.mjs` writes, so unlike the allergy substance route
 * there is no API key and no upstream service to be unreachable.
 */
export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const code = url.searchParams.get('code');

    if (code) {
      const match = findImmunizationByCode(code);
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
      return res.status(200).json({ results: match ? [match] : [], total: match ? 1 : 0, source: 'cvx' });
    }

    const out = searchImmunizations({
      q: url.searchParams.get('q') || '',
      limit: Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 10)),
      activeOnly: url.searchParams.get('activeOnly') === '1',
    });

    // The code set changes a few times a year and the weekly sync redeploys
    // it, so this can be cached hard.
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    return res.status(200).json(out);
  } catch (err) {
    console.error('[immunizations]', err?.message || err);
    return res.status(200).json({ results: [], total: 0, source: 'error' });
  }
}

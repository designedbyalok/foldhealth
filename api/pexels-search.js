/**
 * GET /api/pexels-search?q=<term>&page=<n>&orientation=<portrait|landscape|square>
 *
 * Server-side proxy for Pexels photo search, so PEXEL_API_KEY never reaches
 * the browser. Photos only: this calls /v1/search, never the /videos API.
 * Always responds 200 with `{ photos, nextPage, source }` so the picker can
 * show an empty or error state instead of breaking.
 */
const PER_PAGE = 12;
const ORIENTATIONS = new Set(['portrait', 'landscape', 'square']);

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const q = (url.searchParams.get('q') || '').trim().slice(0, 100);
    const page = Math.min(50, Math.max(1, Number(url.searchParams.get('page')) || 1));
    const orientation = url.searchParams.get('orientation');
    const key = process.env.PEXEL_API_KEY;

    if (!key) return res.status(200).json({ photos: [], nextPage: null, source: 'unconfigured' });
    if (!q) return res.status(200).json({ photos: [], nextPage: null, source: 'pexels' });

    const params = new URLSearchParams({ query: q, page: String(page), per_page: String(PER_PAGE) });
    if (ORIENTATIONS.has(orientation)) params.set('orientation', orientation);
    const upstream = await fetch(`https://api.pexels.com/v1/search?${params}`, {
      headers: { Authorization: key },
    });
    if (!upstream.ok) throw new Error(`Pexels ${upstream.status}`);
    const data = await upstream.json();

    const photos = (data.photos || []).map(p => ({
      id: p.id,
      alt: p.alt || '',
      width: p.width,
      height: p.height,
      avgColor: p.avg_color,
      photographer: p.photographer,
      photographerUrl: p.photographer_url,
      url: p.url,
      thumb: p.src?.medium,
      // Sized for a full A4 page: sharp in print, light enough to embed.
      full: p.src?.large2x,
    }));

    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600');
    return res.status(200).json({ photos, nextPage: data.next_page ? page + 1 : null, source: 'pexels' });
  } catch (err) {
    console.error('[pexels-search]', err?.message || err);
    return res.status(200).json({ photos: [], nextPage: null, source: 'error' });
  }
}

// Thin wrapper around the OpenFDA drug endpoints. The Medication
// Reconciliation picker uses this to look up brand/generic names + dosage
// forms + strength when a user types a query. Notes:
//
//  • We hit `/drug/ndc.json` (the National Drug Code directory) because it
//    carries the fields we want for the picker rows, brand_name,
//    generic_name, dosage_form, active_ingredients (with strength), route.
//  • The API works anonymously (rate-limited to ~40 req/min per IP). When
//    the caller sets `VITE_OPENFDA_API_KEY` in .env the request adds the
//    key as `api_key` (240 req/min per key).
//  • `searchMedications` takes an AbortSignal so callers can cancel stale
//    typeahead requests when a new keystroke comes in.
//  • Wildcard prefix search (`brand_name:lipitor*`) is what makes the
//    typeahead usable for partial names.

const OPENFDA_BASE = 'https://api.fda.gov/drug/ndc.json';
const OPENFDA_KEY  = import.meta.env.VITE_OPENFDA_API_KEY;

// Escape OpenFDA search-query syntax. Their reserved characters (Lucene-ish)
// are: `+ - && || ! ( ) { } [ ] ^ " ~ * ? : \ /`. We only strip the two we
// use structurally (`:` and `"`) and keep letters/spaces; wildcard is added
// by the caller intentionally.
const cleanQuery = (q) => String(q || '')
  .replace(/[":()[\]{}^~?\\\/]/g, ' ')
  .trim();

// Turn an NDC row into a compact display object the picker can render
// directly. Falls back gracefully when brand_name is missing (generics have
// only generic_name); label matches the "Generic (Brand) Strength" shape
// already used by MED_RECON_MOCK entries.
export function toDisplayMedication(row) {
  const brand    = (row.brand_name || '').trim();
  const generic  = (row.generic_name || '').trim();
  const first    = row.active_ingredients?.[0];
  const strength = first?.strength ? String(first.strength).replace(/\/1$/, '').trim() : '';
  const genericTitle = generic ? titleCase(generic) : '';
  const brandTitle   = brand   ? titleCase(brand)   : '';

  let displayName;
  if (genericTitle && brandTitle && brandTitle.toLowerCase() !== genericTitle.toLowerCase()) {
    displayName = `${genericTitle} (${brandTitle})`;
  } else {
    displayName = genericTitle || brandTitle || row.product_ndc || 'Unnamed medication';
  }
  if (strength) displayName = `${displayName} ${strength}`;

  return {
    id: row.product_ndc,
    displayName,
    brandName: brandTitle,
    genericName: genericTitle,
    dosageForm: row.dosage_form || '',
    route: Array.isArray(row.route) ? row.route.join(', ') : (row.route || ''),
    strength,
    raw: row,
  };
}

function titleCase(s) {
  return s.toLowerCase().replace(/(^|[\s\-\/])[a-z]/g, c => c.toUpperCase());
}

/**
 * Search OpenFDA for medications matching `query`.
 *
 * @param {string} query               user-typed text (min 2 chars: caller enforces)
 * @param {object} [opts]
 * @param {AbortSignal} [opts.signal]  aborts the in-flight fetch when a newer
 *                                     keystroke supersedes this one
 * @param {number}      [opts.limit=15]
 * @returns {Promise<Array<ReturnType<typeof toDisplayMedication>>>}
 */
export async function searchMedications(query, { signal, limit = 15 } = {}) {
  const q = cleanQuery(query);
  if (!q) return [];

  // Wildcard prefix match against brand_name OR generic_name. Splitting words
  // across both fields catches "atorva" (generic) and "lipi" (brand) alike.
  const term = q.split(/\s+/)[0]; // first word, good enough for typeahead
  const searchExpr = `(brand_name:${term}*+OR+generic_name:${term}*)`;

  const params = new URLSearchParams();
  params.set('search', searchExpr);
  params.set('limit', String(limit));
  if (OPENFDA_KEY) params.set('api_key', OPENFDA_KEY);

  let response;
  try {
    // OpenFDA uses `+` as a literal in the query string (they encode it
    // themselves), so build the URL by hand rather than through
    // URLSearchParams' plus-as-space escaping.
    const url = `${OPENFDA_BASE}?search=${searchExpr}&limit=${limit}${OPENFDA_KEY ? `&api_key=${OPENFDA_KEY}` : ''}`;
    response = await fetch(url, { signal });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    console.warn('OpenFDA fetch failed:', err?.message || err);
    return [];
  }

  // 404 is OpenFDA's "no results", every other non-2xx is a real error.
  if (response.status === 404) return [];
  if (!response.ok) {
    console.warn('OpenFDA search returned', response.status);
    return [];
  }

  const body = await response.json().catch(() => null);
  if (!body?.results?.length) return [];

  // Dedupe on displayName: the NDC directory has many rows per drug
  // (different packagers) that collapse to the same picker row.
  const seen = new Set();
  const out = [];
  for (const row of body.results) {
    const item = toDisplayMedication(row);
    const key  = item.displayName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

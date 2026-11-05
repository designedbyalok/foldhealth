// Allergen lookup for the Add Allergies drawer.
//
// Two independent sources, because allergens split cleanly in two and no
// single terminology covers both well:
//
//  • Drug allergies: RxNorm ingredients via the NLM Clinical Table Search
//    Service. Public, no key, fast.
//  • Everything else (foods, environmental, latex …), SNOMED CT via the NLM
//    UMLS terminology service, which needs a personal API key.
//
// They are queried in parallel and merged, and a failure in one never takes
// the other down: a missing key, a rate limit or a slow SNOMED response still
// leaves the drug list usable. Results are cached per query so a typeahead
// does not re-ask for a term the user has already typed through.

// RxNorm is public and keyless, so the client calls it directly. SNOMED goes
// through our own backend, which holds UMLS_API_KEY, a key in the bundle is
// a key anyone can read.
const RXNORM_URL = 'https://clinicaltables.nlm.nih.gov/api/drug_ingredients/v3/search';
import { apiFetch } from './apiFetch';

const SUBSTANCES_URL = '/api/reference/allergies/substances';

export const RXNORM_SYSTEM = 'http://www.nlm.nih.gov/research/umls/rxnorm';
export const SNOMED_SYSTEM = 'http://snomed.info/sct';

const MIN_CHARS = 2;
const CACHE_MAX = 100;
// Query → results. A plain Map, trimmed oldest-first, is enough for a
// typeahead that lives as long as the drawer.
const cache = new Map();

const cacheKey = q => q.trim().toLowerCase();

function readCache(key) {
  return cache.get(key);
}

function writeCache(key, value) {
  cache.set(key, value);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
}

/** RxNorm ingredients. `[count, codes[], null, [[code, name], …]]`. */
export async function searchDrugAllergies(query, { signal, limit = 10 } = {}) {
  const term = query.trim();
  if (term.length < MIN_CHARS) return [];
  const url = `${RXNORM_URL}?terms=${encodeURIComponent(term)}&df=code,name&maxList=${limit}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`RxNorm lookup failed: ${res.status}`);
  const data = await res.json();
  return (data?.[3] || [])
    .map(([code, name]) => ({ system: RXNORM_SYSTEM, code, display: name, kind: 'drug' }))
    .filter(x => x.display);
}

/**
 * SNOMED CT concepts, through our backend. The route always answers 200 with
 * `{ results, source }`; `source` is 'unconfigured' when the server has no
 * UMLS key and 'error' when the upstream call failed.
 */
export async function searchNonDrugAllergies(query, { signal, limit = 10 } = {}) {
  const term = query.trim();
  if (term.length < MIN_CHARS) return { results: [], source: 'empty' };
  const params = new URLSearchParams({ q: term, limit: String(limit) });
  const res = await apiFetch(`${SUBSTANCES_URL}?${params}`, { signal });
  if (!res.ok) throw new Error(`Substance lookup failed: ${res.status}`);
  const data = await res.json();
  return { results: data?.results || [], source: data?.source || 'umls' };
}

/**
 * Both sources, merged. Drug hits lead because they are the precise ones;
 * duplicates by display name are dropped, keeping the first.
 *
 * Returns `{ results, snomedFailed }` so a caller can say why the non-drug
 * half is missing rather than silently showing a short list.
 */
export async function searchAllergies(query, { signal, limit = 10 } = {}) {
  const term = query.trim();
  if (term.length < MIN_CHARS) return { results: [], snomedFailed: false };

  const key = cacheKey(term);
  const hit = readCache(key);
  if (hit) return hit;

  // `allSettled`, so one source failing leaves the other's results intact.
  const [drug, nonDrug] = await Promise.allSettled([
    searchDrugAllergies(term, { signal, limit }),
    searchNonDrugAllergies(term, { signal, limit }),
  ]);
  if (signal?.aborted) return { results: [], snomedFailed: false };

  const merged = [];
  const seen = new Set();
  const lists = [
    drug.status === 'fulfilled' ? drug.value : [],
    nonDrug.status === 'fulfilled' ? (nonDrug.value.results || []) : [],
  ];
  for (const list of lists) {
    for (const item of list) {
      const dedupe = item.display.trim().toLowerCase();
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      merged.push(item);
    }
  }

  const out = {
    results: merged,
    // A missing key is a configuration state, not a failure to report: the
    // route says 'unconfigured' for that and 'error' for a real failure.
    snomedFailed: nonDrug.status === 'rejected'
      || (nonDrug.status === 'fulfilled' && nonDrug.value.source === 'error'),
  };
  writeCache(key, out);
  return out;
}


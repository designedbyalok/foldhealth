// Surgical procedure lookup for the Add Surgical History drawer.
//
// NLM Clinical Table Search Service, procedures list. Public and keyless, so
// the client calls it directly, the same way the drug-allergy (RxNorm) lookup
// does; there is nothing to keep off the bundle.
//
// Response: [total, keyIds[], extras, [[consumerName], …]]. The key is NLM's
// own id for the procedure, not CPT, not SNOMED, so it is stored under a
// code system that names this table rather than passing for either.
//
// Results are cached per query so a typeahead does not re-ask for a term the
// user has already typed through.

const PROCEDURES_URL = 'https://clinicaltables.nlm.nih.gov/api/procedures/v3/search';

export const PROCEDURE_SYSTEM = 'https://clinicaltables.nlm.nih.gov/api/procedures/v3';

const MIN_CHARS = 2;
const CACHE_MAX = 100;
const cache = new Map();

/**
 * @returns {Promise<Array<{system: string, code: string, display: string}>>}
 */
export async function searchProcedures(query, { signal, limit = 20 } = {}) {
  const term = String(query || '').trim();
  if (term.length < MIN_CHARS) return [];

  const key = term.toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;

  const url = `${PROCEDURES_URL}?terms=${encodeURIComponent(term)}&maxList=${limit}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Procedure lookup failed: ${res.status}`);
  const data = await res.json();

  const codes = data?.[1] || [];
  const names = data?.[3] || [];
  const results = codes
    .map((code, i) => ({ system: PROCEDURE_SYSTEM, code: String(code), display: names[i]?.[0] || '' }))
    .filter(r => r.display);

  cache.set(key, results);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return results;
}

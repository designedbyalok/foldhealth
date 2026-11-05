import { CVX_CODES, CVX_SYSTEM, CVX_SYNCED_ON } from './cvxCodes.generated.js';

export { CVX_SYSTEM, CVX_SYNCED_ON };

/**
 * CVX lookup, served entirely from the cache `scripts/sync-cvx.mjs` writes.
 *
 * No API key and no upstream call: unlike the allergy substance route, which
 * proxies UMLS live, this one cannot fail because a third party is down. The
 * trade-off is freshness, which the weekly sync job covers.
 */

const MIN_CHARS = 2;

/**
 * Codes a clinician can actually record.
 *
 * Dropped:
 *  • `nonVaccine` rows: administrative placeholders ("no vaccine
 *    administered"), not something to add to an immunization list.
 *  • `Never Active`, assigned but never usable, so it can only ever be a
 *    mis-pick.
 *
 * Inactive and Non-US codes stay: a patient's history legitimately contains
 * vaccines that are no longer given, or were given abroad.
 */
const SEARCHABLE = CVX_CODES.filter(c => !c.nonVaccine && c.status !== 'Never Active');

// Search text built once per process rather than per keystroke.
const INDEX = SEARCHABLE.map(c => ({
  entry: c,
  haystack: `${c.display} ${c.fullName}`.toLowerCase(),
  display: c.display.toLowerCase(),
}));

const shape = (c) => ({
  system: CVX_SYSTEM,
  code: c.code,
  display: c.display,
  fullName: c.fullName,
  status: c.status,
});

/**
 * Rank: a match at the start of the short description beats one mid-string,
 * which beats one that only appears in the full vaccine name. Active codes
 * lead within a tier, since those are what is being given today.
 */
function rank(item, q) {
  const active = item.entry.status === 'Active' ? 0 : 1;
  if (item.display.startsWith(q)) return 0 + active;
  if (item.display.includes(q)) return 2 + active;
  return 4 + active;
}

/**
 * @param {object}  opts
 * @param {string}  opts.q      – search term; under 2 characters returns nothing
 * @param {number}  opts.limit  – max results
 * @param {boolean} [opts.activeOnly] – restrict to currently-administered codes
 * @returns {{results: Array, total: number, source: string, syncedOn: string}}
 *   `source` is 'empty' for a too-short query, otherwise 'cvx'.
 */
export function searchImmunizations({ q = '', limit = 10, activeOnly = false } = {}) {
  const term = String(q).trim().toLowerCase();
  if (term.length < MIN_CHARS) {
    return { results: [], total: 0, source: 'empty', syncedOn: CVX_SYNCED_ON };
  }

  const pool = activeOnly ? INDEX.filter(i => i.entry.status === 'Active') : INDEX;
  const hits = pool.filter(i => i.haystack.includes(term));

  // Stable within a rank: ties keep CDC file order rather than shuffling
  // between requests.
  const ranked = hits
    .map((item, i) => ({ item, r: rank(item, term), i }))
    .sort((a, b) => (a.r - b.r) || (a.i - b.i));

  return {
    results: ranked.slice(0, limit).map(({ item }) => shape(item.entry)),
    total: hits.length,
    source: 'cvx',
    syncedOn: CVX_SYNCED_ON,
  };
}

/** Exact code lookup, for resolving a stored code back to its display name. */
export function findImmunizationByCode(code) {
  const entry = CVX_CODES.find(c => c.code === String(code).trim());
  return entry ? shape(entry) : null;
}

import { useState, useEffect, useRef } from 'react';
import { fetchIcdCodes } from './client';
import { filterFallbackIcds } from './catalog';
import { supabase } from '../supabase';

/**
 * Shared ICD-code search hook. Debounces the query, hits the `/api/icd-search`
 * proxy (WHO ICD-11), and cancels in-flight requests when the query changes.
 *
 * Fallback chain when the API is unconfigured/unreachable:
 *   1. Supabase `icd_codes` cache (seeded + write-through from the proxy)
 *   2. Bundled offline catalog
 *
 * Returns:
 *   query, setQuery   – controlled search string
 *   results           – [{ code, title, hcc?, chapter?, id? }]
 *   loading           – request in flight
 *   source            – 'who' | 'cache' | 'fallback' | null
 */
export function useIcdSearch({ minChars = 2, debounceMs = 250, limit = 15 } = {}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState(null);
  const abortRef = useRef(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < minChars) {
      abortRef.current?.abort();
      setResults([]);
      setLoading(false);
      setSource(null);
      return undefined;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        // ICD-10 first: the Supabase `icd_codes` cache is the app's source of
        // truth (all seed data, HCC mappings, and mock records use ICD-10). WHO
        // ICD-11 codes ("5A14") don't map back to the ICD-10 model the rest of
        // the product speaks, so we only reach for the live API when the cache
        // has nothing to offer for this query.
        const [cached, cacheSource] = await searchCache(q, limit, ac.signal);
        if (ac.signal.aborted) return;
        if (cached.length) {
          setResults(cached);
          setSource(cacheSource);
        } else {
          const { results: apiResults, source: apiSource } = await fetchIcdCodes(q, {
            signal: ac.signal,
            limit,
          });
          if (ac.signal.aborted) return;
          setResults(apiResults);
          setSource(apiSource);
        }
      } catch {
        if (ac.signal.aborted) return;
        const [cached, cacheSource] = await searchCache(q, limit, ac.signal);
        if (ac.signal.aborted) return;
        setResults(cached);
        setSource(cacheSource);
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }, debounceMs);

    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [query, minChars, debounceMs, limit]);

  return { query, setQuery, results, loading, source };
}

// Read-only lookup against the Supabase icd_codes cache table (anon key has
// SELECT-only). Falls through to the bundled catalog if the table is missing,
// empty, or the query errors.
async function searchCache(q, limit, signal) {
  try {
    // PostgREST `.or()` filters are comma/paren-delimited: strip those and
    // wildcards from user input so it can't break out of the ilike pattern.
    const safe = q.replace(/[(),%*]/g, ' ').trim();
    if (safe) {
      const { data, error } = await supabase
        .from('icd_codes')
        .select('code, title, hcc, chapter, entity_id')
        .or(`code.ilike.%${safe}%,title.ilike.%${safe}%`)
        .order('code')
        .limit(limit)
        .abortSignal(signal);
      if (!error && data?.length) {
        return [
          data.map((r) => ({
            code: r.code,
            title: r.title,
            hcc: r.hcc || '',
            chapter: r.chapter || '',
            id: r.entity_id || '',
            hasCode: true,
          })),
          'cache',
        ];
      }
    }
  } catch {
    // table missing / network down: bundled catalog below
  }
  return [filterFallbackIcds(q, limit), 'fallback'];
}

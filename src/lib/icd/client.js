import { apiFetch } from '../apiFetch';

/**
 * Thin client for the ICD search proxy (`/api/icd-search`). The proxy holds
 * the WHO OAuth secret and returns `{ results, source }`.
 */
export async function fetchIcdCodes(query, { signal, limit = 15 } = {}) {
  const resp = await apiFetch(
    `/api/icd-search?q=${encodeURIComponent(query)}&limit=${limit}`,
    { signal, headers: { Accept: 'application/json' } },
  );
  if (!resp.ok) throw new Error(`ICD search HTTP ${resp.status}`);
  return resp.json();
}

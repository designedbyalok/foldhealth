import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { apiFetch } from '@/lib/apiFetch';
import { factsHash, insightFacts } from './careProgramsOverviewModel';

async function fetchInsights(facts) {
  const res = await apiFetch('/api/care-programs-insights', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(facts),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.insights) {
    throw new Error(json?.error?.message || 'Unity couldn\'t write the summary. Please try again.');
  }
  return json.insights;
}

/**
 * Unity's Why Prioritized and Program Summary for the Care Programs
 * overview. One generation writes both cards; it runs only when someone
 * clicks Summarize (or Update once the records changed), is saved per
 * patient, and is read back on every visit. Until then, and after Dismiss,
 * the cards show the version assembled from the records.
 *
 * `data` is useCareProgramsOverview's result.
 * state: 'idle' (nothing saved) | 'loading' | 'ready'.
 */
export function useCareProgramsInsights(patientId, data) {
  const entry = useAppStore(s => s.careProgramsInsights[patientId]);
  const fetchSaved = useAppStore(s => s.fetchCareProgramsInsights);
  const save = useAppStore(s => s.saveCareProgramsInsights);
  const remove = useAppStore(s => s.deleteCareProgramsInsights);
  const showToast = useAppStore(s => s.showToast);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { if (patientId) fetchSaved(patientId); }, [patientId, fetchSaved]);

  const facts = useMemo(() => (data.ready ? insightFacts({
    firstName: data.firstName,
    acuity: data.acuity,
    problems: data.problems,
    progress: data.progress,
    actions: data.actions,
    totals: data.totals,
    clinical: data.clinical,
  }) : null), [data]);
  const hash = useMemo(() => (facts ? factsHash(facts) : null), [facts]);

  const generate = async () => {
    if (generating || !facts) return;
    setGenerating(true);
    setError(null);
    try {
      await save(patientId, await fetchInsights(facts), hash);
    } catch (err) {
      setError(err.message);
      showToast?.(err.message);
    } finally {
      setGenerating(false);
    }
  };

  return {
    state: generating ? 'loading' : entry?.insights ? 'ready' : 'idle',
    insights: entry?.insights || null,
    generatedAt: entry?.generatedAt || null,
    generatedBy: entry?.generatedBy || null,
    // Saved before the fingerprint existed, or written from other facts.
    stale: !!entry?.insights && !!hash && entry.inputHash !== hash,
    error,
    generate,
    dismiss: () => remove(patientId),
  };
}

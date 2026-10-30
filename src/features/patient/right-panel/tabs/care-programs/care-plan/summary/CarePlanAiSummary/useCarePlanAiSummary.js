import { useState } from 'react';
import { apiFetch } from '../../../../../../../../lib/apiFetch';
import { useAppStore } from '../../../../../../../../store/useAppStore';

/* The AI care plan summary's data side: the API payload, the call, and the
   generate / regenerate / copy / dismiss hook. Shared by the Comprehensive
   Care Plan (one summary per patient) and each program's plan (one per
   program). The caller saves the summary; it stays until someone
   regenerates or dismisses it. Components are in CarePlanAiSummary.jsx. */

// Compact the snapshot into the small JSON the summary API sends to the
// model: titles + status + the few fields that shape a recap, nothing
// patient-identifying beyond the name already on screen.
export function buildSummaryPayload({ patientName, programs, conditions, goals, interventions, barriers }) {
  const progName = (p) => p?.name || p?.code || 'Program';
  return {
    patientName: patientName || 'the patient',
    programs: (programs || []).map(p => ({ name: progName(p), status: p?.status || null })),
    conditions: (conditions || []).map(c => (typeof c === 'string' ? c : c?.label)).filter(Boolean),
    goals: (goals || []).map(g => ({ title: g.title, status: g.status, progress: g.progress ?? null, priority: g.priority || null, program: g.programCode || null })),
    interventions: (interventions || []).map(i => ({ title: i.title, status: i.status, assignee: i.assignee?.name || null, program: i.programCode || null })),
    barriers: (barriers || []).map(b => ({ title: b.title, status: b.status, program: b.programCode || null })),
  };
}

// Call the server-side Gemini proxy (keeps the API key off the client) and
// return one { intro, points, actions } summary. Throws a user-readable
// message the caller can toast.
async function fetchCarePlanSummary(payload) {
  const res = await apiFetch('/api/care-plan-summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson?.error?.message || 'Could not generate the summary. Please try again.');
  }
  const json = await res.json().catch(() => ({}));
  if (!json.summary) {
    throw new Error(json?.error?.message || 'Could not generate the summary. Please try again.');
  }
  return json.summary;
}

/**
 * Generate / regenerate / copy / dismiss for a saved summary.
 * `saved` is the stored { intro, points, actions } or null; `onSave` and
 * `onDelete` persist; `buildPayload()` returns the API body; `isEmpty`
 * blocks generating a summary of nothing.
 */
export function useCarePlanAiSummary({ saved, onSave, onDelete, buildPayload, isEmpty }) {
  const showToast = useAppStore(s => s.showToast);
  // In flight while the model writes; everything else derives from `saved`.
  const [generating, setGenerating] = useState(false);
  const state = generating ? 'loading' : (saved ? 'ready' : 'idle');

  const generate = async ({ regenerate = false } = {}) => {
    if (generating) return;
    if (isEmpty) {
      showToast?.('No care plan content to summarize yet');
      return;
    }
    setGenerating(true);
    if (regenerate) showToast?.('Regenerating summary…');
    try {
      await onSave(await fetchCarePlanSummary(buildPayload()));
    } catch (err) {
      showToast?.(err.message || (regenerate ? 'Could not regenerate the summary' : 'Could not generate the summary'));
    } finally {
      setGenerating(false);
    }
  };
  const copy = () => {
    if (!saved) return;
    const text = [
      saved.intro,
      ...saved.points.map((p, i) => `${i + 1}. ${p.title}: ${p.body}`),
      '',
      'Action Items :',
      ...saved.actions.map(a => `• ${a}`),
    ].join('\n');
    navigator.clipboard?.writeText(text).then(
      () => showToast?.('Summary copied'),
      () => showToast?.('Copy failed'),
    );
  };
  return {
    state,
    generate: () => generate(),
    regenerate: () => { if (saved) generate({ regenerate: true }); },
    copy,
    clear: onDelete,
  };
}

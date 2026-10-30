import { supabase } from '../../lib/supabase';
import { apiFetch } from '../../lib/apiFetch';

const isMissingTable = error => error?.code === '42P01' || error?.code === 'PGRST205';

export const mapTemplateSuggestionRow = row => ({
  id: row.id,
  templateId: row.template_id,
  relatedTemplateId: row.related_template_id || null,
  kind: row.kind,
  metrics: row.metrics || {},
  rationale: row.rationale || '',
  aiRationale: row.ai_rationale || null,
  status: row.status,
  decidedBy: row.decided_by || null,
  decidedAt: row.decided_at || null,
  detectedAt: row.detected_at,
  updatedAt: row.updated_at,
});

const goalTitles = (template, libraryGoals) => (template?.goals || []).map(g => {
  const lib = g?.id ? libraryGoals.find(x => x.id === g.id) : null;
  return lib?.title || g?.title || '';
}).filter(Boolean);

/*
 * Care Plan Library > Suggestions (care_plan_template_suggestions_migration.sql).
 * The nightly analyzer writes the rows; supervisors accept or dismiss them
 * here. Accepting a retire archives the template; the other kinds are edits a
 * person makes, so accepting records the decision and the panel opens the
 * template. Until the migration runs the table is missing and the tab says so.
 */
export const createTemplateSuggestionsSlice = (set, get) => {
  const patchLocal = (id, patch) => set(s => ({
    templateSuggestions: s.templateSuggestions.map(x => (x.id === id ? { ...x, ...patch } : x)),
  }));
  const setTemplateStatus = async (templateId, status) => {
    const { error } = await supabase.from('care_plan_templates')
      .update({ status, updated_by: get().currentActorName?.() || null, updated_at: new Date().toISOString() })
      .eq('id', templateId);
    if (error) { console.warn('setTemplateStatus:', error.message); return false; }
    set(s => ({ carePlanTemplates: s.carePlanTemplates.map(t => (t.id === templateId ? { ...t, status } : t)) }));
    return true;
  };

  return {
    templateSuggestions: [],
    templateSuggestionsLoading: false,
    templateSuggestionsDidFetch: false,
    templateSuggestionsMissing: false,
    templateSuggestionsWording: false,

    fetchTemplateSuggestions: async ({ force = false } = {}) => {
      if (get().templateSuggestionsLoading) return;
      if (get().templateSuggestionsDidFetch && !force) return;
      set({ templateSuggestionsLoading: true });
      // Open ones, plus the last 90 days of decisions for the Decided view.
      const since = new Date(Date.now() - 90 * 86400000).toISOString();
      const { data, error } = await supabase.from('care_plan_template_suggestions')
        .select('*')
        .or(`status.eq.open,decided_at.gte.${since}`)
        .order('detected_at', { ascending: false });
      if (error) {
        if (!isMissingTable(error)) console.warn('fetchTemplateSuggestions:', error.message);
        set({ templateSuggestionsLoading: false, templateSuggestionsDidFetch: true, templateSuggestionsMissing: isMissingTable(error) });
        return;
      }
      set({
        templateSuggestions: (data || []).map(mapTemplateSuggestionRow),
        templateSuggestionsLoading: false,
        templateSuggestionsDidFetch: true,
        templateSuggestionsMissing: false,
      });
    },

    /** Run the analyzer now instead of waiting for the nightly job. */
    runTemplateAnalysis: async () => {
      const { error } = await supabase.rpc('refresh_care_plan_template_suggestions');
      if (error) { console.warn('runTemplateAnalysis:', error.message); return false; }
      await get().fetchTemplateSuggestions({ force: true });
      return true;
    },

    decideTemplateSuggestion: async (id, decision) => {
      const suggestion = get().templateSuggestions.find(x => x.id === id);
      if (!suggestion) return false;
      if (decision === 'accepted' && suggestion.kind === 'retire') {
        if (!(await setTemplateStatus(suggestion.templateId, 'archived'))) return false;
      }
      const patch = { status: decision, decided_by: get().currentActorName?.() || null, decided_at: new Date().toISOString() };
      const { error } = await supabase.from('care_plan_template_suggestions').update(patch).eq('id', id);
      if (error) {
        console.warn('decideTemplateSuggestion:', error.message);
        if (decision === 'accepted' && suggestion.kind === 'retire') await setTemplateStatus(suggestion.templateId, 'published');
        return false;
      }
      patchLocal(id, { status: decision, decidedBy: patch.decided_by, decidedAt: patch.decided_at });
      return true;
    },

    /** Put a decided suggestion back to open; a retired template is published again. */
    reopenTemplateSuggestion: async (id) => {
      const suggestion = get().templateSuggestions.find(x => x.id === id);
      if (!suggestion) return false;
      if (suggestion.status === 'accepted' && suggestion.kind === 'retire') {
        if (!(await setTemplateStatus(suggestion.templateId, 'published'))) return false;
      }
      const { error } = await supabase.from('care_plan_template_suggestions')
        .update({ status: 'open', decided_by: null, decided_at: null }).eq('id', id);
      if (error) { console.warn('reopenTemplateSuggestion:', error.message); return false; }
      patchLocal(id, { status: 'open', decidedBy: null, decidedAt: null });
      return true;
    },

    /** AI wording for open suggestions that have none yet; the rule rationale stays if this fails. */
    wordTemplateSuggestions: async () => {
      if (get().templateSuggestionsWording) return;
      const templates = get().carePlanTemplates || [];
      const libraryGoals = get().carePlanGoals || [];
      const byId = new Map(templates.map(t => [t.id, t]));
      const brief = t => t && { name: t.name, conditions: t.conditions || [], goals: goalTitles(t, libraryGoals) };
      const pending = get().templateSuggestions
        .filter(x => x.status === 'open' && !x.aiRationale && byId.has(x.templateId))
        .slice(0, 20);
      if (!pending.length) return;
      set({ templateSuggestionsWording: true });
      try {
        const res = await apiFetch('/api/template-optimization', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            suggestions: pending.map(x => ({
              id: x.id,
              kind: x.kind,
              rationale: x.rationale,
              metrics: x.metrics,
              template: brief(byId.get(x.templateId)),
              ...(x.relatedTemplateId ? { related: brief(byId.get(x.relatedTemplateId)) } : {}),
            })),
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) { console.warn('wordTemplateSuggestions:', json?.error?.message || res.status); return; }
        const now = new Date().toISOString();
        await Promise.all((json.rationales || []).map(async ({ id, text }) => {
          const { error } = await supabase.from('care_plan_template_suggestions')
            .update({ ai_rationale: text, ai_generated_at: now }).eq('id', id);
          if (!error) patchLocal(id, { aiRationale: text });
        }));
      } finally {
        set({ templateSuggestionsWording: false });
      }
    },
  };
};

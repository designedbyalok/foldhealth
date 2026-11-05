import { supabase } from '../../lib/supabase';
import { matchIpa } from '../../features/settings/care-plan-library/lib/ipaOverlays';

/*
 * IPA registry and per-IPA template overlays (care_plan_ipa_overlays
 * migration). The registry maps the IPA values recorded on patients (by name
 * or alias) to one IPA; an active overlay for a template and the patient's
 * IPA is applied on top of the account template when it goes on a plan
 * (applyPatientCarePlanTemplates). Before the migration the tables are
 * missing and overlays stay out of the way.
 */

const MISSING = new Set(['42P01', 'PGRST205']);

const mapIpaRow = (r) => ({
  id: r.id, name: r.name, aliases: r.aliases || [], active: r.active !== false,
  createdBy: r.created_by || '', createdAt: r.created_at, updatedAt: r.updated_at,
});
const mapOverlayRow = (r) => ({
  id: r.id, templateId: r.template_id, ipaId: r.ipa_id, status: r.status || 'draft',
  overrides: r.overrides || {}, clonedFrom: r.cloned_from || null,
  createdBy: r.created_by || '', updatedBy: r.updated_by || '', createdAt: r.created_at, updatedAt: r.updated_at,
});

export function createIpaOverlaysSlice(set, get) {
  const patientIpaCache = new Map();
  const actor = () => get().currentUserProfile?.name || null;

  return {
    ipas: [],
    ipasLoaded: false,
    ipaOverlaysReady: false,
    templateOverlays: [],
    templateOverlaysLoaded: false,

    fetchIpas: async () => {
      const { data, error } = await supabase.from('ipas').select('*').order('name');
      if (error) {
        if (!MISSING.has(error.code)) console.warn('fetchIpas:', error.message);
        set({ ipasLoaded: true });
        return;
      }
      set({ ipas: (data || []).map(mapIpaRow), ipasLoaded: true, ipaOverlaysReady: true });
    },

    saveIpa: async ({ name, aliases = [], active = true }, id = null) => {
      const row = { name: name.trim(), aliases: aliases.map(a => a.trim()).filter(Boolean), active, updated_at: new Date().toISOString() };
      const q = id
        ? supabase.from('ipas').update(row).eq('id', id)
        : supabase.from('ipas').insert({ ...row, created_by: actor() });
      const { data, error } = await q.select().single();
      if (error) {
        get().showToast(/duplicate|unique/i.test(error.message || '') ? `An IPA named "${row.name}" already exists` : 'Could not save the IPA');
        return null;
      }
      const ipa = mapIpaRow(data);
      patientIpaCache.clear();
      set(s => ({ ipas: (id ? s.ipas.map(i => (i.id === id ? ipa : i)) : [...s.ipas, ipa]).sort((a, b) => a.name.localeCompare(b.name)) }));
      return ipa;
    },

    deleteIpa: async (id) => {
      const { error } = await supabase.from('ipas').delete().eq('id', id);
      if (error) { get().showToast('Could not delete the IPA'); return false; }
      set(s => ({ ipas: s.ipas.filter(i => i.id !== id), templateOverlays: s.templateOverlays.filter(o => o.ipaId !== id) }));
      return true;
    },

    // How many patients carry each recorded IPA value (all_patients), for mapping spellings.
    fetchIpaValueCounts: async () => {
      const { data, error } = await supabase.from('all_patients').select('ipa').not('ipa', 'is', null).limit(10000);
      if (error) { console.warn('fetchIpaValueCounts:', error.message); return []; }
      const m = new Map();
      for (const r of data || []) { const v = String(r.ipa).trim(); if (v) m.set(v, (m.get(v) || 0) + 1); }
      return [...m.entries()].map(([value, n]) => ({ value, n }));
    },

    fetchTemplateOverlays: async () => {
      const { data, error } = await supabase.from('care_plan_template_overlays').select('*').order('updated_at', { ascending: false });
      if (error) {
        if (!MISSING.has(error.code)) console.warn('fetchTemplateOverlays:', error.message);
        set({ templateOverlaysLoaded: true });
        return;
      }
      set({ templateOverlays: (data || []).map(mapOverlayRow), templateOverlaysLoaded: true });
    },

    saveTemplateOverlay: async ({ templateId, ipaId, status = 'draft', overrides = {}, clonedFrom = null }, id = null) => {
      const row = { template_id: templateId, ipa_id: ipaId, status, overrides, updated_by: actor(), updated_at: new Date().toISOString() };
      const q = id
        ? supabase.from('care_plan_template_overlays').update(row).eq('id', id)
        : supabase.from('care_plan_template_overlays').insert({ ...row, cloned_from: clonedFrom, created_by: actor() });
      const { data, error } = await q.select().single();
      if (error) {
        get().showToast(/duplicate|unique/i.test(error.message || '') ? 'That IPA already has an overlay for this template' : 'Could not save the overlay');
        return null;
      }
      const o = mapOverlayRow(data);
      set(s => ({ templateOverlays: id ? s.templateOverlays.map(x => (x.id === id ? o : x)) : [o, ...s.templateOverlays] }));
      return o;
    },

    deleteTemplateOverlay: async (id) => {
      const { error } = await supabase.from('care_plan_template_overlays').delete().eq('id', id);
      if (error) { get().showToast('Could not delete the overlay'); return false; }
      set(s => ({ templateOverlays: s.templateOverlays.filter(o => o.id !== id) }));
      return true;
    },

    // Clone: the fast path to an overlay for other IPAs. Copies land as drafts;
    // IPAs that already have one for the template are skipped.
    cloneTemplateOverlay: async (overlay, ipaIds) => {
      const taken = new Set(get().templateOverlays.filter(o => o.templateId === overlay.templateId).map(o => o.ipaId));
      const targets = ipaIds.filter(id => !taken.has(id));
      if (!targets.length) return { created: [], skipped: ipaIds.length };
      const { data, error } = await supabase.from('care_plan_template_overlays').insert(targets.map(ipaId => ({
        template_id: overlay.templateId, ipa_id: ipaId, status: 'draft', overrides: overlay.overrides,
        cloned_from: overlay.id, created_by: actor(), updated_by: actor(),
      }))).select();
      if (error) { get().showToast('Could not clone the overlay'); return null; }
      const created = (data || []).map(mapOverlayRow);
      set(s => ({ templateOverlays: [...created, ...s.templateOverlays] }));
      return { created, skipped: ipaIds.length - targets.length };
    },

    // The registry IPA of a patient, from the IPA recorded on them (all_patients).
    resolvePatientIpa: async (patientId) => {
      const key = String(patientId);
      if (!get().ipasLoaded) await get().fetchIpas();
      if (!patientIpaCache.has(key)) {
        const { data } = await supabase.from('all_patients').select('ipa').eq('member_id', key).limit(1).maybeSingle();
        patientIpaCache.set(key, data?.ipa || '');
      }
      return matchIpa(patientIpaCache.get(key), get().ipas);
    },

    // The active overlay of a template for this patient's IPA, with the IPA, or null.
    overlayForPatient: async (templateId, patientId) => {
      if (!get().ipaOverlaysReady && get().ipasLoaded) return null;
      const ipa = await get().resolvePatientIpa(patientId);
      if (!ipa) return null;
      if (!get().templateOverlaysLoaded) await get().fetchTemplateOverlays();
      const overlay = get().templateOverlays.find(o => o.templateId === templateId && o.ipaId === ipa.id && o.status === 'active');
      return overlay ? { overlay, ipa } : null;
    },
  };
}

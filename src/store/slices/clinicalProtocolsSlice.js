import { supabase } from '../../lib/supabase';
import { apiFetch } from '../../lib/apiFetch';
import { extractProtocolText } from '../../features/settings/clinical-protocols/lib/extractProtocolText';
import {
  isFoldProtocolJson,
  normalizeProtocol,
  protocolGuidanceText,
  protocolToRow,
  rowToProtocol,
} from '../../features/settings/clinical-protocols/lib/protocolSchema';
import { isFoldProtocol } from '../../features/settings/clinical-protocols/lib/foldProtocols';
import { buildTemplateCatalog, TEMPLATE_DESCRIPTION_MAX } from '../../features/settings/care-plan-library/lib/aiTemplateDraft';
import { requestTemplateDraft, templateDraftToTemplate, withoutDraftMarks } from '../../features/settings/care-plan-library/lib/templateDraftToEditor';
import { SAMPLE_PROTOCOLS } from '../../features/settings/clinical-protocols/data/sampleProtocols';

const isMissingTable = error => error?.code === '42P01' || error?.code === 'PGRST205';
const BUCKET = 'clinical-protocols';
// The library list leaves out the document text, which can run to 150k characters.
const LIST_COLUMNS = 'id, title, organization, condition_tags, program_codes, effective_date, review_date, author, version, status, source_kind, source_name, source_path, source_size, protocol, parse_meta, parse_error, supersedes_id, uploaded_by, approved_by, approved_at, created_at, updated_at';

const titleFromFile = name => String(name || 'Untitled protocol').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
const safeName = name => String(name || 'file').replace(/[^\w.-]+/g, '_').slice(-120);
const sameProtocol = (a, b) => a.title.trim().toLowerCase() === b.title.trim().toLowerCase()
  && (a.organization || '').trim().toLowerCase() === (b.organization || '').trim().toLowerCase();

/*
 * Care Plan Library > Clinical Protocols (clinical_protocols_migration.sql): the
 * library, uploads (extract text in the browser, keep the original in the
 * private bucket, parse via /api/clinical-protocol-parse or import Fold JSON
 * directly), review edits, approval with superseding, retire and delete.
 * Until the table exists the library shows the sample protocols read-only.
 */
export const createClinicalProtocolsSlice = (set, get) => {
  const patchLocal = (id, patch) => set(s => ({
    clinicalProtocols: s.clinicalProtocols.map(p => (p.id === id ? { ...p, ...patch } : p)),
  }));
  const setUpload = (key, patch) => set(s => ({
    protocolUploads: s.protocolUploads.map(u => (u.key === key ? { ...u, ...patch } : u)),
  }));

  const programOptions = () => (get().careProgramTypes || [])
    .filter(t => t.code)
    .map(t => ({ code: t.code, name: t.name }));

  // Parse extracted text into { metadata, protocol, warnings, model } (Fold JSON skips the AI).
  async function parseExtracted(extracted, fileName) {
    if (extracted.json && isFoldProtocolJson(extracted.json)) {
      const programs = programOptions();
      return { ...normalizeProtocol(extracted.json, { programCodes: programs.length ? programs.map(p => p.code) : null }), model: null, via: 'json' };
    }
    const res = await apiFetch('/api/clinical-protocol-parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: extracted.text, fileName, programs: programOptions() }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error?.message || 'Could not parse the protocol.');
    return { ...json, via: 'ai' };
  }

  async function processUpload(upload) {
    const { key, file } = upload;
    const actor = get().currentActorName?.() || null;
    let id = null;
    try {
      setUpload(key, { status: 'reading' });
      const extracted = await extractProtocolText(file);

      setUpload(key, { status: 'uploading' });
      id = crypto.randomUUID();
      const path = `${id}/${safeName(file.name)}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined });
      if (upErr) throw new Error(/bucket/i.test(upErr.message) ? 'File storage is not set up yet (run the clinical protocols migration).' : 'Could not store the file.');

      const base = {
        id,
        title: titleFromFile(file.name),
        status: 'processing',
        source_kind: extracted.kind,
        source_name: file.name,
        source_path: path,
        source_size: file.size,
        source_text: extracted.text,
        uploaded_by: actor,
      };
      const { data: inserted, error: insErr } = await supabase.from('clinical_protocols').insert(base).select(LIST_COLUMNS).single();
      if (insErr) throw new Error(isMissingTable(insErr) ? 'The clinical protocols table is not set up yet (run the migration).' : 'Could not save the protocol.');
      set(s => ({ clinicalProtocols: [rowToProtocol(inserted), ...s.clinicalProtocols] }));

      setUpload(key, { status: 'parsing', protocolId: id });
      const parsed = await parseExtracted(extracted, file.name);
      const m = parsed.metadata || {};
      const warnings = [...(parsed.warnings || [])];
      if (extracted.truncated) warnings.unshift('The document was longer than the parser reads; only the first part was parsed.');
      const next = {
        title: m.title || base.title,
        organization: m.organization || '',
        conditions: m.conditions || [],
        programCodes: m.programCodes || [],
        effectiveDate: m.effectiveDate || null,
        reviewDate: m.reviewDate || null,
        author: m.author || '',
        version: m.version || '',
        status: 'draft',
        protocol: parsed.protocol,
        parseMeta: { via: parsed.via, model: parsed.model || null, parsedAt: new Date().toISOString(), warnings, pages: extracted.pages },
        parseError: null,
      };
      const { error: updErr } = await supabase.from('clinical_protocols').update({ ...protocolToRow(next), updated_at: new Date().toISOString() }).eq('id', id);
      if (updErr) throw new Error('Could not save the parsed protocol.');
      patchLocal(id, next);
      setUpload(key, { status: 'done' });
    } catch (err) {
      const message = err?.message || 'Could not process this file.';
      setUpload(key, { status: 'failed', error: message });
      if (id) {
        await supabase.from('clinical_protocols').update({ status: 'failed', parse_error: message, updated_at: new Date().toISOString() }).eq('id', id);
        patchLocal(id, { status: 'failed', parseError: message });
      }
    }
  }

  let queueRunning = false;
  async function runQueue() {
    if (queueRunning) return;
    queueRunning = true;
    try {
      for (;;) {
        const next = get().protocolUploads.find(u => u.status === 'queued');
        if (!next) break;
        await processUpload(next);
      }
    } finally {
      queueRunning = false;
    }
  }

  return {
    clinicalProtocols: [],
    clinicalProtocolsLoading: false,
    clinicalProtocolsDidFetch: false,
    // True when the table is missing and the sample protocols are shown read-only.
    clinicalProtocolsSample: false,
    protocolUploads: [], // { key, file, name, status: queued|reading|uploading|parsing|done|failed, error, protocolId }

    fetchClinicalProtocols: async ({ force = false } = {}) => {
      if (get().clinicalProtocolsLoading || (get().clinicalProtocolsDidFetch && !force)) return;
      set({ clinicalProtocolsLoading: true });
      const { data, error } = await supabase.from('clinical_protocols').select(LIST_COLUMNS).order('updated_at', { ascending: false });
      if (error) {
        if (!isMissingTable(error)) console.warn('fetchClinicalProtocols:', error.message);
        set({
          clinicalProtocols: isMissingTable(error) ? SAMPLE_PROTOCOLS : get().clinicalProtocols,
          clinicalProtocolsSample: isMissingTable(error),
          clinicalProtocolsLoading: false,
          clinicalProtocolsDidFetch: true,
        });
        return;
      }
      set({ clinicalProtocols: (data || []).map(rowToProtocol), clinicalProtocolsSample: false, clinicalProtocolsLoading: false, clinicalProtocolsDidFetch: true });
    },

    /** Queue files for upload and parsing; they run one at a time. */
    uploadClinicalProtocols: (files) => {
      const added = [...files].map(file => ({ key: crypto.randomUUID(), file, name: file.name, status: 'queued', error: null, protocolId: null }));
      set(s => ({ protocolUploads: [...s.protocolUploads, ...added] }));
      runQueue();
    },
    clearFinishedProtocolUploads: () => set(s => ({
      protocolUploads: s.protocolUploads.filter(u => u.status !== 'done' && u.status !== 'failed'),
    })),

    /** Save review edits (metadata and protocol items). */
    saveClinicalProtocol: async (id, values) => {
      const cur = get().clinicalProtocols.find(p => p.id === id);
      if (!cur) return false;
      const next = { ...cur, ...values };
      const { error } = await supabase.from('clinical_protocols')
        .update({ ...protocolToRow(next), updated_at: new Date().toISOString() }).eq('id', id);
      if (error) {
        console.warn('saveClinicalProtocol:', error.message);
        get().showToast?.('Could not save the protocol');
        return false;
      }
      patchLocal(id, { ...values, updatedAt: new Date().toISOString() });
      return true;
    },

    /** The Active protocol an approval would replace (same title and organization), if any. */
    protocolToSupersede: (id) => {
      const cur = get().clinicalProtocols.find(p => p.id === id);
      if (!cur) return null;
      return get().clinicalProtocols.find(p => p.id !== id && p.status === 'active' && sameProtocol(p, cur)) || null;
    },

    /** Approve a reviewed draft: it becomes Active and replaces `supersede` (if given). */
    approveClinicalProtocol: async (id, values, { supersede = null } = {}) => {
      const cur = get().clinicalProtocols.find(p => p.id === id);
      if (!cur) return false;
      const now = new Date().toISOString();
      const approvedBy = get().currentActorName?.() || null;
      const next = { ...cur, ...values, status: 'active', supersedesId: supersede?.id || cur.supersedesId || null };
      const { error } = await supabase.from('clinical_protocols').update({
        ...protocolToRow(next), approved_by: approvedBy, approved_at: now, updated_at: now,
      }).eq('id', id);
      if (error) {
        console.warn('approveClinicalProtocol:', error.message);
        get().showToast?.('Could not approve the protocol');
        return false;
      }
      patchLocal(id, { ...values, status: 'active', supersedesId: next.supersedesId, approvedBy, approvedAt: now, updatedAt: now });
      if (supersede) {
        const { error: supErr } = await supabase.from('clinical_protocols').update({ status: 'superseded', updated_at: now }).eq('id', supersede.id);
        if (supErr) console.warn('approveClinicalProtocol supersede:', supErr.message);
        else patchLocal(supersede.id, { status: 'superseded', updatedAt: now });
      }
      // A client protocol gets a care plan template drafted from it, in the
      // background, for review (Fold's own come with starter templates).
      if (!isFoldProtocol(next)) get().draftTemplateFromProtocol(id);
      return true;
    },

    // protocolId -> true while UnityAI drafts its template.
    protocolTemplateDrafting: {},

    // UnityAI drafts a care plan template from an Active protocol: Common goals
    // plus categories by the protocol's measurable thresholds, library items
    // only, saved as a draft template linked to the protocol for a supervisor
    // to review and publish. Returns the saved template, or null.
    draftTemplateFromProtocol: async (id) => {
      const protocol = get().clinicalProtocols.find(p => p.id === id);
      if (!protocol || protocol.status !== 'active' || get().protocolTemplateDrafting[id]) return null;
      const setDrafting = on => set(s => {
        const next = { ...s.protocolTemplateDrafting };
        if (on) next[id] = true; else delete next[id];
        return { protocolTemplateDrafting: next };
      });
      setDrafting(true);
      try {
        if (!get().carePlanLibraryDidFetch) await get().fetchCarePlanLibrary();
        const s = get();
        const libraries = { libraryGoals: s.carePlanGoals || [], interventionLibrary: s.carePlanInterventionTemplates || [], barrierLibrary: s.carePlanBarriers || [] };
        const catalog = buildTemplateCatalog({ goals: libraries.libraryGoals, interventions: libraries.interventionLibrary, barriers: libraries.barrierLibrary });
        const forConditions = protocol.conditions.length ? ` for ${protocol.conditions.join(', ')}` : '';
        const description = `A care plan template following ${protocol.title}${forConditions}.`.slice(0, TEMPLATE_DESCRIPTION_MAX);
        const draft = await requestTemplateDraft(description, catalog, {
          title: protocol.title, version: protocol.version, organization: protocol.organization,
          guidance: protocolGuidanceText(protocol.protocol),
        }, { categories: true, libraryOnly: true });
        const content = templateDraftToTemplate(draft, libraries);
        const saved = await get().saveCarePlanTemplate({
          name: draft.name || protocol.title,
          conditions: draft.conditions || protocol.conditions,
          goals: withoutDraftMarks(content.goals),
          interventions: withoutDraftMarks(content.interventions),
          barriers: withoutDraftMarks(content.barriers),
          categories: content.categories,
          status: 'draft',
          sourceProtocol: { id: protocol.id, title: protocol.title, version: protocol.version, organization: protocol.organization },
        });
        if (saved) {
          const n = content.categories.length;
          get().showToast?.(`UnityAI drafted "${saved.name}" from ${protocol.title}${n ? ` with ${n} categor${n === 1 ? 'y' : 'ies'}` : ''}. Review it in Draft Templates.`);
        }
        return saved;
      } catch (err) {
        console.warn('draftTemplateFromProtocol:', err?.message || err);
        get().showToast?.(`Could not draft a care plan template from ${protocol.title}. ${err?.message || ''}`.trim());
        return null;
      } finally {
        setDrafting(false);
      }
    },

    setClinicalProtocolStatus: async (id, status) => {
      const now = new Date().toISOString();
      const { error } = await supabase.from('clinical_protocols').update({ status, updated_at: now }).eq('id', id);
      if (error) {
        console.warn('setClinicalProtocolStatus:', error.message);
        get().showToast?.('Could not update the protocol');
        return false;
      }
      patchLocal(id, { status, updatedAt: now });
      return true;
    },

    deleteClinicalProtocol: async (id) => {
      const cur = get().clinicalProtocols.find(p => p.id === id);
      const { error } = await supabase.from('clinical_protocols').delete().eq('id', id);
      if (error) {
        console.warn('deleteClinicalProtocol:', error.message);
        get().showToast?.('Could not delete the protocol');
        return false;
      }
      if (cur?.sourcePath) await supabase.storage.from(BUCKET).remove([cur.sourcePath]);
      set(s => ({ clinicalProtocols: s.clinicalProtocols.filter(p => p.id !== id) }));
      return true;
    },

    /** Parse the stored document text again (e.g. after a parser improvement). Replaces unsaved review edits. */
    reparseClinicalProtocol: async (id) => {
      const cur = get().clinicalProtocols.find(p => p.id === id);
      if (!cur) return false;
      const { data, error } = await supabase.from('clinical_protocols').select('source_text').eq('id', id).single();
      if (error || !data?.source_text) {
        get().showToast?.('There is no stored document text to parse');
        return false;
      }
      patchLocal(id, { status: 'processing' });
      try {
        const parsed = await parseExtracted({ text: data.source_text, json: null }, cur.sourceName);
        const values = {
          protocol: parsed.protocol,
          parseMeta: { ...cur.parseMeta, via: parsed.via, model: parsed.model || null, parsedAt: new Date().toISOString(), warnings: parsed.warnings || [] },
          parseError: null,
          status: 'draft',
        };
        const ok = await get().saveClinicalProtocol(id, values);
        if (!ok) patchLocal(id, { status: cur.status });
        return ok;
      } catch (err) {
        patchLocal(id, { status: cur.status });
        get().showToast?.(err?.message || 'Could not parse the protocol');
        return false;
      }
    },

    /** A short-lived link to the original file. */
    clinicalProtocolFileUrl: async (id) => {
      const cur = get().clinicalProtocols.find(p => p.id === id);
      if (!cur?.sourcePath) return null;
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(cur.sourcePath, 600);
      if (error) {
        console.warn('clinicalProtocolFileUrl:', error.message);
        return null;
      }
      return data?.signedUrl || null;
    },
  };
};

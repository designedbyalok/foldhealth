import { supabase } from '../../lib/supabase';
import { carePlanKey, mapCarePlanAuditRow } from '../lib/carePlanStoreLib';
import { describeTemplateRuns } from './templateVersionsSlice';
import {
  priorProtocolIds, protocolMigrationAuditEntry, protocolMigrationPlan, runFollowsPrior, runProtocol,
} from '../../features/settings/clinical-protocols/lib/protocolMigration';

/*
 * Moving care plans to a newly approved clinical protocol version
 * (clinical_protocol_migrations_migration.sql). The impact analysis finds
 * every active template run that follows an earlier version, directly or
 * through its template's sourceProtocol; the supervisor moves them all now,
 * by cohort, or at each plan's next review. Each decision is a
 * clinical_protocol_migrations row and each run that moves a care_plan_audit
 * row (entity_type 'protocol').
 */

const MISSING = new Set(['42P01', 'PGRST205', '42703', 'PGRST204']);
const chunks = (list, n = 200) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));

export function createProtocolMigrationsSlice(set, get) {
  const actorName = () => get().currentUserProfile?.name || get().currentActorName?.() || null;

  // Locally loaded plans and their History caches pick up what moved.
  const syncLocal = (rows, patch, auditRows) => {
    for (const r of rows) {
      const key = carePlanKey(r.patientId, r.programId);
      get().patchCarePlanTemplateInstances?.(key, list => list.map(i => (i.id === r.instanceId ? { ...i, ...patch } : i)));
    }
    if (!auditRows?.length) return;
    set((s) => {
      const next = { ...s.patientCarePlanAudit };
      for (const row of auditRows) {
        const key = carePlanKey(row.patient_id, row.program_id);
        if (next[key]) next[key] = [mapCarePlanAuditRow(row), ...next[key]];
      }
      return { patientCarePlanAudit: next };
    });
  };

  return {
    /**
     * Impact of approving `protocolId`: the active runs on earlier versions
     * of it, as impact rows (see describeTemplateRuns) plus fromProtocolId
     * and fromVersion. Returns { rows, priorIds }.
     */
    fetchProtocolMigrationImpact: async (protocolId) => {
      const priorIds = priorProtocolIds(get().clinicalProtocols, protocolId);
      if (!priorIds.length) return { rows: [], priorIds };
      const prior = new Set(priorIds);
      const versionOf = new Map(get().clinicalProtocols.map(p => [p.id, p.version || '']));

      const { data: templates, error: tErr } = await supabase.from('care_plan_templates')
        .select('id, name, source_protocol').in('source_protocol->>id', priorIds);
      if (tErr) console.warn('fetchProtocolMigrationImpact (templates):', tErr.message);
      const templateById = new Map((templates || []).map(t => [t.id, { ...t, sourceProtocol: t.source_protocol }]));

      const queries = [];
      if (templateById.size) {
        queries.push(supabase.from('patient_care_plan_template_instances').select('*')
          .eq('status', 'active').in('template_id', [...templateById.keys()]));
      }
      queries.push(supabase.from('patient_care_plan_template_instances').select('*')
        .eq('status', 'active').in('protocol_id', priorIds));
      const results = await Promise.all(queries);
      const byId = new Map();
      for (const { data, error } of results) {
        if (error) { if (!MISSING.has(error.code)) console.warn('fetchProtocolMigrationImpact (runs):', error.message); continue; }
        for (const r of data || []) byId.set(r.id, r);
      }

      // A run named directly may sit on a template we haven't loaded; it follows its own protocol anyway.
      const runs = [...byId.values()].filter(r => runFollowsPrior(
        { protocolId: r.protocol_id, protocolVersion: r.protocol_version }, templateById.get(r.template_id), prior,
      ));
      const described = await describeTemplateRuns(runs, get);
      const runById = new Map(runs.map(r => [r.id, r]));
      const rows = described.map((row) => {
        const r = runById.get(row.instanceId);
        const p = runProtocol({ protocolId: r.protocol_id, protocolVersion: r.protocol_version }, templateById.get(r.template_id));
        return { ...row, fromProtocolId: p.id, fromVersion: p.version || versionOf.get(p.id) || '' };
      });
      return { rows, priorIds };
    },

    /** Past decisions for a protocol, newest first. */
    fetchProtocolMigrations: async (protocolId) => {
      const { data, error } = await supabase.from('clinical_protocol_migrations')
        .select('*').eq('protocol_id', protocolId).order('created_at', { ascending: false });
      if (error) { if (!MISSING.has(error.code)) console.warn('fetchProtocolMigrations:', error.message); return []; }
      return data || [];
    },

    /**
     * Move the impact `rows` to `protocolId` by `mode` (all | cohort | review).
     * `onProgress(done, total)` while runs move. Returns
     * { migrated, deferred, stayed, failed } or null when nothing was saved.
     */
    migrateCarePlansToProtocol: async (protocolId, { mode, cohort = {}, rows = [], priorIds = [], onProgress } = {}) => {
      const to = get().clinicalProtocols.find(p => p.id === protocolId);
      if (!to) return null;
      const from = get().clinicalProtocols.find(p => p.id === priorIds[0]) || null;
      const plan = protocolMigrationPlan(rows, mode, cohort);
      const actor = actorName();

      const { data: record, error: recErr } = await supabase.from('clinical_protocol_migrations').insert({
        protocol_id: to.id, from_protocol_id: from?.id || null, from_version: from?.version || null, to_version: to.version || null,
        mode, cohort: mode === 'cohort' ? cohort : null, affected: rows.length, deferred: plan.deferred.length, actor,
      }).select().single();
      if (recErr) {
        console.warn('migrateCarePlansToProtocol:', recErr.message);
        get().showToast?.(MISSING.has(recErr.code)
          ? 'Protocol migrations are not set up yet (run supabase/clinical_protocol_migrations_migration.sql).'
          : 'Could not save the migration');
        return null;
      }

      let migrated = 0;
      let failed = 0;
      let done = 0;
      const total = plan.now.length;
      const movedPatch = { protocolId: to.id, protocolVersion: to.version || null, pendingProtocolId: null, pendingProtocolMigrationId: null };
      for (const part of chunks(plan.now, 100)) {
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        const { error } = await supabase.from('patient_care_plan_template_instances').update({
          protocol_id: to.id, protocol_version: to.version || null, pending_protocol_id: null, pending_protocol_migration_id: null,
        }).in('id', part.map(r => r.instanceId));
        if (error) {
          console.warn('migrateCarePlansToProtocol (runs):', error.message);
          failed += part.length;
        } else {
          const audit = part.map((r) => {
            const e = protocolMigrationAuditEntry({ title: to.title, fromVersion: r.fromVersion, toVersion: to.version, toId: to.id, mode, templateName: r.templateName });
            return {
              patient_id: r.patientId, program_id: r.programId, program_code: r.programCode || null,
              entity_type: e.entityType, entity_id: e.entityId, action: e.action, summary: e.summary, detail: e.detail, actor,
            };
          });
          // react-doctor-disable-next-line react-doctor/async-await-in-loop
          const { data: logged, error: aErr } = await supabase.from('care_plan_audit').insert(audit).select();
          if (aErr) console.warn('migrateCarePlansToProtocol (audit):', aErr.message);
          migrated += part.length;
          syncLocal(part, movedPatch, logged);
        }
        done += part.length;
        onProgress?.(done, total);
      }

      let deferredFailed = 0;
      for (const part of chunks(plan.deferred)) {
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        const { error } = await supabase.from('patient_care_plan_template_instances')
          .update({ pending_protocol_id: to.id, pending_protocol_migration_id: record.id }).in('id', part.map(r => r.instanceId));
        if (error) { console.warn('migrateCarePlansToProtocol (pending):', error.message); deferredFailed += part.length; }
        else syncLocal(part, { pendingProtocolId: to.id, pendingProtocolMigrationId: record.id });
      }

      const deferred = plan.deferred.length - deferredFailed;
      failed += deferredFailed;
      await supabase.from('clinical_protocol_migrations').update({ migrated, deferred, failed }).eq('id', record.id);
      return { id: record.id, migrated, deferred, stayed: plan.stay.length, failed };
    },

    // "Next review only": runs on this plan waiting on a protocol version move now.
    applyPendingProtocolMigrations: async (patientId, program) => {
      const key = carePlanKey(patientId, program.id);
      const due = (get().patientCarePlans[key]?.templateInstances || []).filter(i => i.status === 'active' && i.pendingProtocolId);
      if (!due.length) return 0;
      const ids = [...new Set(due.map(i => i.pendingProtocolId))];
      const { data: protocols, error } = await supabase.from('clinical_protocols').select('id, title, version, status').in('id', ids);
      if (error) { console.warn('applyPendingProtocolMigrations:', error.message); return 0; }
      const byId = new Map((protocols || []).map(p => [p.id, p]));
      const fromVersions = new Map();
      const fromIds = [...new Set(due.map(i => i.protocolId).filter(Boolean))];
      if (fromIds.length) {
        const { data } = await supabase.from('clinical_protocols').select('id, version').in('id', fromIds);
        for (const p of data || []) fromVersions.set(p.id, p.version);
      }
      const templateById = new Map((get().carePlanTemplates || []).map(t => [t.id, t]));
      let n = 0;
      for (const inst of due) {
        const to = byId.get(inst.pendingProtocolId);
        if (!to || to.status === 'retired') continue;
        const template = templateById.get(inst.templateId);
        const fromVersion = inst.protocolId ? (inst.protocolVersion || fromVersions.get(inst.protocolId)) : template?.sourceProtocol?.version;
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        const { error: e } = await supabase.from('patient_care_plan_template_instances').update({
          protocol_id: to.id, protocol_version: to.version || null, pending_protocol_id: null, pending_protocol_migration_id: null,
        }).eq('id', inst.id);
        if (e) { console.warn('applyPendingProtocolMigrations:', e.message); continue; }
        get().patchCarePlanTemplateInstances?.(key, list => list.map(i => (i.id === inst.id ? {
          ...i, protocolId: to.id, protocolVersion: to.version || null, pendingProtocolId: null, pendingProtocolMigrationId: null,
        } : i)));
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        await get().logCarePlanAudit(patientId, program, protocolMigrationAuditEntry({
          title: to.title, fromVersion, toVersion: to.version, toId: to.id, mode: 'review', templateName: inst.templateName,
        }));
        n += 1;
      }
      if (n) get().showToast?.(`Care plan moved to the latest clinical protocol version${n === 1 ? '' : 's'}`);
      return n;
    },
  };
}

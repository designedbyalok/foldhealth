/* Moving care plans to a newly approved protocol version. Pure JS; the store
   (protocolMigrationsSlice) reads and writes.

   A run (one template applied to a plan) follows a protocol version directly
   once it has been migrated (run.protocolId), and until then through its
   template's sourceProtocol. A new version's "prior versions" are the ones it
   supersedes, back along the chain, plus any other superseded version with
   the same title and organization. */

import { inCohort } from '../../care-plan-library/lib/templateVersions.js';

const keyOf = (p) => `${String(p?.title || '').trim().toLowerCase()}|${String(p?.organization || '').trim().toLowerCase()}`;

/** Ids of the earlier versions of `protocolId`, newest first. */
export function priorProtocolIds(protocols, protocolId) {
  const byId = new Map((protocols || []).map(p => [p.id, p]));
  const current = byId.get(protocolId);
  if (!current) return [];
  const out = [];
  const seen = new Set([protocolId]);
  for (let p = byId.get(current.supersedesId); p && !seen.has(p.id); p = byId.get(p.supersedesId)) {
    seen.add(p.id);
    out.push(p.id);
  }
  for (const p of protocols) {
    if (!seen.has(p.id) && p.status === 'superseded' && keyOf(p) === keyOf(current)) {
      seen.add(p.id);
      out.push(p.id);
    }
  }
  return out;
}

/** The protocol { id, version } a run follows: its own, else its template's source. */
export function runProtocol(run, template) {
  if (run?.protocolId) return { id: run.protocolId, version: run.protocolVersion || '' };
  const src = template?.sourceProtocol;
  return src?.id ? { id: src.id, version: src.version || '' } : null;
}

/** Whether a run follows one of `priorIds` (a Set) and so is affected. */
export function runFollowsPrior(run, template, priorIds) {
  const p = runProtocol(run, template);
  return !!p && priorIds.has(p.id);
}

export const PROTOCOL_MIGRATION_MODES = [
  { key: 'all', label: 'Migrate all now' },
  { key: 'cohort', label: 'Migrate by cohort' },
  { key: 'review', label: 'Next review only' },
];
export const protocolModeLabel = (mode) => PROTOCOL_MIGRATION_MODES.find(m => m.key === mode)?.label || mode;

/**
 * Splits affected impact rows by mode: `now` move immediately, `deferred`
 * wait for their plan's next review, `stay` keep the prior version. An
 * empty cohort moves nothing.
 */
export function protocolMigrationPlan(rows, mode, cohort = {}) {
  const list = rows || [];
  if (mode === 'review') return { now: [], deferred: list, stay: [] };
  if (mode === 'cohort') {
    const now = list.filter(r => inCohort(r, cohort));
    const moving = new Set(now);
    return { now, deferred: [], stay: list.filter(r => !moving.has(r)) };
  }
  return { now: list, deferred: [], stay: [] };
}

/** The care_plan_audit entry for one run moving to `to`. */
export function protocolMigrationAuditEntry({ title, fromVersion, toVersion, toId, mode, templateName }) {
  const from = fromVersion ? `v${fromVersion}` : 'the prior version';
  const to = toVersion ? `v${toVersion}` : 'the new version';
  return {
    entityType: 'protocol',
    entityId: toId,
    action: 'updated',
    summary: title || 'Clinical protocol',
    detail: `Protocol ${from} → ${to} (${protocolModeLabel(mode)})${templateName ? ` · ${templateName}` : ''}`,
  };
}

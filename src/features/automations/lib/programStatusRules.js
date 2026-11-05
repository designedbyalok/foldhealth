/* Care program status → care plan item (GBI) status. When a program moves to
   Unable to Reach, Paused, Completed or Closed, active automations triggered
   by "A patient's care program status changes" set every open goal,
   intervention and barrier in that program's plan to the mapped status with
   a reason. Pure JS; the store applies it (runProgramStatusRules).

   Precedence: an automation scoped to the program's type overrides the
   account default (one with no program types) for the same status.

   Unable to Reach and Paused are holds: each item they move remembers its
   status and reason before the hold (status_hold), and when the program
   moves on to a status with no rules of its own (e.g. back to Active) the
   items still at the hold's status go back (gbiRestorations). Completed and
   Closed are final and remember nothing. */

import { isClosedStatus } from '../../patient/right-panel/tabs/care-programs/care-plan/lib/gbiStatus';

// The program statuses a rule can watch. Closed covers Discontinued and the
// legacy Closed status.
export const PROGRAM_STATUS_TRIGGERS = [
  { key: 'utr', label: 'Unable to Reach', statuses: ['Unable to Reach'] },
  { key: 'paused', label: 'Paused', statuses: ['Paused'] },
  { key: 'completed', label: 'Completed', statuses: ['Completed'] },
  { key: 'closed', label: 'Closed', statuses: ['Discontinued', 'Closed'] },
];
export const programStatusTriggerOf = (status) => PROGRAM_STATUS_TRIGGERS.find(t => t.statuses.includes(status))?.key || null;
export const programStatusLabel = (key) => PROGRAM_STATUS_TRIGGERS.find(t => t.key === key)?.label || key;

const HOLD_TRIGGERS = new Set(['utr', 'paused']);
/** Unable to Reach or Paused: a status the program comes back from. */
export const isHoldProgramStatus = (status) => HOLD_TRIGGERS.has(programStatusTriggerOf(status));

const triggerOf = (graph) => graph?.nodes?.find(n => n.id === 'trigger') || null;

export const GBI_KINDS = [
  { key: 'goal', label: 'Goals' },
  { key: 'intervention', label: 'Interventions' },
  { key: 'barrier', label: 'Barriers' },
];

/** Active "program status changes" automations, read as rules. */
export function programStatusRulesOf(automations) {
  return (automations || [])
    .filter(a => a.status === 'active' && triggerOf(a.graph)?.type === 'careProgramStatusChanged')
    .map((a) => {
      const trigger = triggerOf(a.graph);
      const action = a.graph.nodes.find(n => n.type === 'setGbiStatus');
      return {
        id: a.id,
        name: a.name,
        programCodes: trigger?.config?.programCodes || [],
        on: trigger?.config?.programStatuses || [],
        toStatus: action?.config?.toStatus || '',
        reason: action?.config?.reason || '',
        kinds: action?.config?.kinds?.length ? action.config.kinds : GBI_KINDS.map(k => k.key),
        actionNodeId: action?.id || null,
        updatedAt: a.updatedAt || '',
      };
    })
    .filter(r => r.toStatus && r.actionNodeId);
}

/**
 * The rules that apply when a program of `programCode` moves to
 * `programStatus`: the ones scoped to that program type if any, else the
 * account defaults. Several in the same tier all apply, newest last, so the
 * most recently edited one decides an item both touch.
 */
export function rulesForProgramStatus(rules, programCode, programStatus) {
  const key = programStatusTriggerOf(programStatus);
  if (!key) return [];
  const watching = (rules || []).filter(r => r.on.includes(key));
  const specific = watching.filter(r => r.programCodes.includes(programCode));
  const chosen = specific.length ? specific : watching.filter(r => !r.programCodes.length);
  return [...chosen].sort((a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt)));
}

/**
 * The status changes to make: every open item of the rule's kinds that isn't
 * already at the target. Closed items (Met, Not Met, Resolved, Discontinued,
 * Not Applicable) keep their outcome.
 * `items` is { goal: [], intervention: [], barrier: [] } of
 * { id, title, status, statusReason?, statusHold? }. With `hold`, each change
 * carries the hold to store: the status before the first hold, so going from
 * Unable to Reach to Paused still returns to the original.
 */
export function gbiTransitions(items, rules, { hold = false } = {}) {
  const byId = new Map();
  for (const rule of rules) {
    for (const kind of rule.kinds) {
      for (const item of items[kind] || []) {
        if (isClosedStatus(item.status) || item.status === rule.toStatus) continue;
        const from = item.status || 'Not Started';
        byId.set(`${kind}:${item.id}`, {
          kind, id: item.id, title: item.title || '', from, to: rule.toStatus, reason: rule.reason, ruleId: rule.id,
          hold: hold
            ? (item.statusHold?.from
              ? { ...item.statusHold, to: rule.toStatus }
              : { from, reason: item.statusReason || null, to: rule.toStatus })
            : null,
        });
      }
    }
  }
  return [...byId.values()];
}

/**
 * When the program comes back from a hold: `restore` puts each held item
 * still at the hold's status back to its status and reason from before;
 * `clear` is every other held item (someone changed it by hand meanwhile, so
 * it keeps what they set) whose stored hold just needs dropping.
 */
export function gbiRestorations(items) {
  const restore = [];
  const clear = [];
  for (const [kind, list] of Object.entries(items)) {
    for (const item of list || []) {
      const h = item.statusHold;
      if (!h?.from) continue;
      if (item.status === h.to) restore.push({ kind, id: item.id, title: item.title || '', from: item.status, to: h.from, reason: h.reason || null });
      else clear.push({ kind, id: item.id });
    }
  }
  return { restore, clear };
}

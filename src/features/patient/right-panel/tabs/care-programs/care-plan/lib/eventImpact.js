// Event-based care plan updates (#84). An event from the care_plan_events
// inbox (care_plan_event_updates_migration.sql) is checked against one care
// plan here, with rules: does it touch the plan, and which changes follow
// from it directly (a lab or vital on a goal records its value). Events the
// rules match also go to the AI (/api/care-plan-event-update), which drafts
// status, target and new-item changes; normalizeEventDraft keeps only what
// points at real items on this plan. Shared by the app and the API handler.
import { LAB_CATALOG, SCORE_CATALOG, EVENT_CATALOG } from '../../../../../../automations/lib/clinicalCriteria.js';
import { GBI_STATUSES, BARRIER_STATUSES } from './gbiStatus.js';
import { INTERVENTION_KINDS } from './individualizedPlan.js';

// How far back a plan looks for events it hasn't evaluated yet.
export const EVENT_LOOKBACK_DAYS = 30;

const VITAL_MATCH = {
  bp: { label: 'Blood pressure', match: /blood pressure|\bbp\b|systolic/i },
  wt: { label: 'Weight', match: /weight/i, unit: 'lbs' },
  bmi: { label: 'BMI', match: /\bbmi\b|body mass/i },
  hr: { label: 'Heart rate', match: /heart rate|pulse/i, unit: 'bpm' },
  spo2: { label: 'Oxygen saturation', match: /oxygen|spo2|saturation/i, unit: '%' },
  pain: { label: 'Pain scale', match: /\bpain\b/i },
};

const CLOSED = new Set(['Met', 'Not Met', 'Discontinued', 'Not Applicable', 'Resolved']);
const isOpen = item => !CLOSED.has(item.status);

/** A care_plan_events row as the app uses it. */
export function mapCarePlanEventRow(r) {
  return {
    id: r.id,
    patientId: r.patient_id,
    kind: r.kind,
    action: r.action || null,
    code: r.code || null,
    display: r.display || '',
    valueText: r.value_text ?? null,
    value: r.numeric_value == null ? null : Number(r.numeric_value),
    unit: r.unit || '',
    abnormal: !!r.abnormal,
    occurredAt: r.occurred_at,
    meta: r.meta || {},
  };
}

/** A care_plan_event_impacts row as the app uses it. */
export function mapEventImpactRow(r) {
  return {
    id: r.id,
    eventId: r.event_id,
    programId: r.program_id,
    status: r.status,
    reasons: Array.isArray(r.reasons) ? r.reasons : [],
    changes: Array.isArray(r.changes) ? r.changes : [],
    aiSummary: r.ai_summary || '',
    aiError: r.ai_error || '',
    evaluatedAt: r.evaluated_at,
    resolvedAt: r.resolved_at || null,
    resolvedBy: r.resolved_by || null,
  };
}

const fmtDay = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
};

const valueParts = (e) => ({
  value: e.valueText ?? (e.value == null ? '' : String(e.value)),
  unit: e.unit || (e.kind === 'vital' ? VITAL_MATCH[e.code]?.unit || (e.code === 'bp' ? 'mmHg' : '') : ''),
});

/** What the event's value reads as: "8.1 %", "146/90 mmHg". */
export function eventValue(e) {
  const { value, unit } = valueParts(e);
  return [value, unit].filter(Boolean).join(' ');
}

/** One line for the event: "HbA1c 8.1 % (abnormal)", "Discharged from St. Mary's". */
export function eventTitle(e) {
  const name = e.kind === 'vital' ? (VITAL_MATCH[e.code]?.label || e.display) : e.display;
  if (e.kind === 'adt') {
    const where = e.meta?.raw?.facility ? ` ${e.action === 'discharge' ? 'from' : 'at'} ${e.meta.raw.facility}` : '';
    return {
      admit: `Admitted${where}`, discharge: `Discharged${where}`, transfer: `Transferred${where}`, ed: `ED visit${where}`,
    }[e.action] || `ADT event${where}`;
  }
  if (e.kind === 'medication') {
    return `${{ started: 'Started', stopped: 'Stopped', changed: 'Changed' }[e.action] || 'Updated'} ${name}${e.valueText ? ` (${e.valueText})` : ''}`;
  }
  if (e.kind === 'assessment') return `${name} completed${e.value != null ? `: score ${e.value}${e.valueText ? ` (${e.valueText})` : ''}` : ''}`;
  if (e.kind === 'note') return `Note signed: ${name.replace(/_/g, ' ')}`;
  const value = eventValue(e);
  return `${name}${value ? ` ${value}` : ''}${e.abnormal ? ' (abnormal)' : ''}`;
}

/** The goal-matching pattern for a measured event, or null. */
function metricFor(e) {
  if (e.kind === 'vital') return VITAL_MATCH[e.code] || null;
  if (e.kind === 'lab' || e.kind === 'device') {
    return LAB_CATALOG.find(l => (e.code && l.loinc.includes(e.code)) || l.match.test(e.display)) || null;
  }
  if (e.kind === 'prom' || e.kind === 'assessment') {
    return SCORE_CATALOG.find(s => (e.code && s.loinc.includes(e.code)) || s.match.test(e.display))
      || (e.kind === 'assessment' ? { match: new RegExp(`\\b${(e.display.split(/\s+/)[0] || '').replace(/[^\w-]/g, '')}\\b`, 'i') } : null);
  }
  return null;
}

const goalText = g => `${g.title} ${g.measure || ''} ${g.customUnit || ''}`;
const anyItemText = plan => [...plan.goals, ...plan.interventions, ...(plan.barriers || [])].map(i => i.title).join(' \n ');

/**
 * Whether `event` touches `plan` ({ goals, interventions, barriers }) and the
 * changes that follow from it by rule. `askAi` says whether the AI should
 * draft further changes.
 */
export function evaluateEventImpact(event, plan) {
  const goals = (plan.goals || []).filter(isOpen);
  const reasons = [];
  const changes = [];
  const when = fmtDay(event.occurredAt);

  const metric = metricFor(event);
  if (metric?.match && (event.value != null || event.valueText)) {
    for (const g of goals.filter(goal => metric.match.test(goalText(goal)))) {
      reasons.push(`Measures the goal "${g.title}"`);
      changes.push({
        id: `rule:value:${g.id}`,
        kind: 'goal_value',
        targetType: 'goal',
        targetId: g.id,
        targetTitle: g.title,
        from: g.currentValue || '',
        to: eventValue(event),
        ...valueParts(event),
        rationale: `${eventTitle(event)} on ${when}.`,
        source: 'rule',
      });
    }
  }
  if (event.abnormal) reasons.push('Outside the reference range');
  if (event.kind === 'adt' && ['admit', 'discharge', 'transfer', 'ed'].includes(event.action)) {
    reasons.push(event.action === 'discharge' ? 'A discharge changes what the plan needs for the next 30 days' : 'A hospital or ED visit');
  }
  if (event.kind === 'encounter' && EVENT_CATALOG.some(c => c.key !== 'any' && c.match.test(event.display))) {
    reasons.push('An ED or inpatient encounter');
  }
  if (event.kind === 'medication' && goals.length) reasons.push(`A medication was ${event.action || 'updated'}`);
  if ((event.kind === 'assessment' || event.kind === 'prom') && metric?.match?.test(anyItemText(plan))) {
    reasons.push(`The plan tracks ${event.display}`);
  } else if (event.kind === 'assessment' && event.value != null && !reasons.length) {
    reasons.push(`${event.display} scored ${event.value}`);
  }
  if (event.kind === 'note' && goals.length) reasons.push('A signed visit note may change the plan');

  const unique = [...new Set(reasons)];
  return { relevant: unique.length > 0, reasons: unique, changes, askAi: unique.length > 0 };
}

/** Events the plan should still evaluate: recent, after the plan began, not yet evaluated. */
export function eventsToEvaluate(events, impacts, { planCreatedAt, now = new Date() } = {}) {
  const seen = new Set(impacts.map(i => i.eventId));
  const floor = Math.max(
    now.getTime() - EVENT_LOOKBACK_DAYS * 86400000,
    planCreatedAt ? new Date(planCreatedAt).getTime() - 86400000 : 0,
  );
  return events.filter(e => !seen.has(e.id) && new Date(e.occurredAt).getTime() >= floor);
}

// ── AI drafting ──
const AI_KINDS = ['status', 'goal_target', 'add_goal', 'add_intervention', 'add_barrier'];

export const EVENT_UPDATE_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    changes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: AI_KINDS },
          targetId: { type: 'string', nullable: true },
          status: { type: 'string', nullable: true, enum: [...BARRIER_STATUSES, null] },
          targetValue: { type: 'string', nullable: true },
          title: { type: 'string', nullable: true },
          interventionKind: { type: 'string', nullable: true, enum: [...INTERVENTION_KINDS, null] },
          goalId: { type: 'string', nullable: true },
          rationale: { type: 'string' },
        },
        required: ['kind', 'rationale'],
      },
    },
  },
  required: ['summary', 'changes'],
};

/** The compact plan the AI sees: ids, titles, statuses, targets, current values. */
export function planForPrompt(plan) {
  const goal = g => ({ id: g.id, title: g.title, status: g.status, target: [g.comparator, g.targetValue, g.customUnit].filter(Boolean).join(' '), current: g.currentValue || '' });
  return {
    goals: (plan.goals || []).map(goal),
    interventions: (plan.interventions || []).map(i => ({ id: i.id, title: i.title, status: i.status, goalId: i.goalId || null })),
    barriers: (plan.barriers || []).map(b => ({ id: b.id, title: b.title, status: b.status })),
  };
}

export function buildEventUpdatePrompt({ event, reasons, plan, ruleChanges, programName }) {
  return [
    'You are a care manager’s assistant keeping a patient’s care plan current.',
    `A new event arrived for a patient on the ${programName || 'care'} program. Propose only the care plan changes this event clearly supports.`,
    '',
    `EVENT: ${eventTitle(event)} on ${fmtDay(event.occurredAt)} (kind ${event.kind}${event.action ? `, ${event.action}` : ''}).`,
    event.meta && Object.keys(event.meta).length ? `EVENT DETAILS: ${JSON.stringify(event.meta).slice(0, 1500)}` : '',
    `WHY IT MATTERS: ${reasons.join('; ')}`,
    ruleChanges.length ? `ALREADY PROPOSED (do not repeat): ${ruleChanges.map(c => `record ${c.to} on goal ${c.targetId}`).join('; ')}` : '',
    '',
    `CARE PLAN (JSON): ${JSON.stringify(plan).slice(0, 12000)}`,
    '',
    'Rules:',
    '- status: change an existing item’s status. targetId is the item id from the plan; status is the new status. Goals and interventions use Not Started, In Progress, On Hold, UTR, Met, Not Met, Discontinued, Not Applicable; barriers can also be Resolved.',
    '- goal_target: change a goal’s target value (targetId, targetValue) only when the event shows the current target no longer fits.',
    '- add_goal / add_barrier: a new item with a short title. add_intervention: a new intervention with a title, an interventionKind and, when it serves a goal on the plan, that goalId.',
    '- Never propose an item already on the plan, never change an item to the status it already has, and use only ids from the plan.',
    '- At most 4 changes. None is a fine answer when the event changes nothing.',
    '- Each rationale is one sentence a care manager can check against the event. No em dashes.',
    '- summary: one sentence on what the event means for this plan.',
  ].filter(Boolean).join('\n');
}

const norm = s => String(s || '').trim().toLowerCase();
const noDash = s => String(s || '').replace(/\s*\u2014\s*/g, ', ').trim();

/** Keeps the AI's changes that are valid for this plan, in the shape the card applies. */
export function normalizeEventDraft(raw, plan) {
  if (!raw || typeof raw !== 'object') return null;
  const byId = new Map();
  for (const [type, list] of [['goal', plan.goals], ['intervention', plan.interventions], ['barrier', plan.barriers]]) {
    for (const item of list || []) byId.set(String(item.id), { type, item });
  }
  const titles = new Set([...(plan.goals || []), ...(plan.interventions || []), ...(plan.barriers || [])].map(i => norm(i.title)));
  const out = [];
  for (const [i, c] of (Array.isArray(raw.changes) ? raw.changes : []).slice(0, 4).entries()) {
    const rationale = noDash(c?.rationale);
    if (!c || !AI_KINDS.includes(c.kind) || !rationale) continue;
    const id = `ai:${i}:${c.kind}`;
    if (c.kind === 'status' || c.kind === 'goal_target') {
      const hit = byId.get(String(c.targetId));
      if (!hit) continue;
      if (c.kind === 'status') {
        const allowed = hit.type === 'barrier' ? BARRIER_STATUSES : GBI_STATUSES;
        if (!allowed.includes(c.status) || c.status === hit.item.status) continue;
        out.push({ id, kind: 'status', targetType: hit.type, targetId: hit.item.id, targetTitle: hit.item.title, from: hit.item.status, to: c.status, rationale, source: 'ai' });
      } else {
        if (hit.type !== 'goal' || !String(c.targetValue || '').trim()) continue;
        out.push({ id, kind: 'goal_target', targetType: 'goal', targetId: hit.item.id, targetTitle: hit.item.title, from: hit.item.targetValue || '', to: String(c.targetValue).trim(), rationale, source: 'ai' });
      }
      continue;
    }
    const title = String(c.title || '').trim();
    if (!title || titles.has(norm(title))) continue;
    titles.add(norm(title));
    const type = c.kind.replace('add_', '');
    const goal = c.goalId ? byId.get(String(c.goalId)) : null;
    out.push({
      id, kind: c.kind, targetType: type, targetId: null, targetTitle: title, from: '', to: title,
      item: {
        title,
        ...(type === 'intervention' ? { kind: INTERVENTION_KINDS.includes(c.interventionKind) ? c.interventionKind : 'internal-task', goalId: goal?.type === 'goal' ? goal.item.id : null } : {}),
      },
      rationale, source: 'ai',
    });
  }
  return { summary: noDash(raw.summary), changes: out };
}

/** Plain-language line for a proposed change. */
export function describeChange(c) {
  const noun = { goal: 'Goal', intervention: 'Intervention', barrier: 'Barrier' }[c.targetType] || 'Item';
  switch (c.kind) {
    case 'goal_value': return { action: 'Record', subject: `${c.to} on Goal: ${c.targetTitle}` };
    case 'status': return { action: 'Change status of', subject: `${noun}: ${c.targetTitle}`, from: c.from, to: c.to };
    case 'goal_target': return { action: 'Change target of', subject: `Goal: ${c.targetTitle}`, from: c.from || 'None', to: c.to };
    default: return { action: `Add ${noun.toLowerCase()}`, subject: c.targetTitle };
  }
}

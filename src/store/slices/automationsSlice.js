import { supabase } from '../../lib/supabase';
import { updateHash } from '../../lib/router';
import { carePlanKey } from '../lib/carePlanStoreLib';
import {
  automationRowToJs, automationJsToRow, templateRowToJs, runRowToJs, runJsToRow, runMemberRowToJs,
  runMemberJsToRow, messageRowToJs, messageJsToRow, editLogRowToJs,
} from '../../features/automations/lib/mappers';
import { simulateRun } from '../../features/automations/lib/simulate';
import { buildRuleInputs, evaluateRule, rulesForProgram } from '../../features/automations/lib/clinicalCriteria';
import { enrollmentRulesOf } from '../../features/automations/lib/enrollmentRules';
import { gbiTransitions, programStatusRulesOf, rulesForProgramStatus } from '../../features/automations/lib/programStatusRules';
import { getNode } from '../../features/automations/lib/graph';
import { statusDef } from '../../features/automations/lib/catalog';
import {
  SEED_TEMPLATES, SEED_AUTOMATIONS, SEED_EDIT_LOG, buildSeedActivity, wireTemplateIds,
} from '../../features/automations/data/automationSeed';
import { AUTOMATION_EMAILS, automationEmailDoc } from '../../features/automations/data/automationEmails';
import { SAMPLE_MEMBERS } from '../../features/automations/data/sampleMembers';

/*
 * Settings > Automations (automations migration). Lists, templates, the
 * builder's saves, runs (simulated, see features/automations/lib/simulate.js)
 * and their records for History / Analytics / member traces.
 *
 * Before the migration runs the tables don't exist (42P01 / PGRST205): the
 * slice then serves the seed records from memory (`automationsLocal`) so the
 * screens work, and writes stay in memory until the page reloads.
 *
 * Also owns runAutoApplyRules: care program enrollment runs every active
 * automation whose trigger is "A patient is enrolled in a care program"
 * (these replaced Settings > Automation Rules).
 *
 * And runProgramStatusRules: a program moving to Unable to Reach, Paused,
 * Completed or Closed runs the "program status changes" automations, which
 * set every open goal, intervention and barrier in its plan to the mapped
 * status with a reason (lib/programStatusRules.js).
 */

const MISSING = new Set(['42P01', 'PGRST205']);
const uuid = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const nowIso = () => new Date().toISOString();

// The local fallback's records, built once per session.
let local = null;

function buildLocal(patients) {
  const emailIds = new Map(AUTOMATION_EMAILS.map(e => [e.key, `automation:${e.key}`]));
  const templates = SEED_TEMPLATES.map(t => ({ ...t, id: `tpl-${t.slug}`, graph: wireTemplateIds(t.graph, k => emailIds.get(k)) }));
  const automations = SEED_AUTOMATIONS.map(a => ({
    ...a,
    graph: wireTemplateIds(a.graph, k => emailIds.get(k)),
    draftGraph: null,
    templateId: `tpl-${a.templateSlug}`,
  }));
  // Sequential ids: the seed is deterministic, so trace links survive a reload.
  let n = 0;
  const activity = buildSeedActivity(automations, patients, { newId: () => `local-${++n}` });
  automations.forEach(a => {
    const last = activity.runs.filter(r => r.automationId === a.id).sort((x, y) => new Date(y.startedAt) - new Date(x.startedAt))[0];
    a.lastExecutedAt = last?.startedAt || null;
    a.lastRunStatus = last ? (last.failedCount ? 'errors' : 'ok') : null;
  });
  const editLog = SEED_EDIT_LOG.map((e, i) => ({
    id: `edit-${i}`, automationId: e.automationId, actor: e.actor, summary: e.summary,
    createdAt: new Date(Date.now() - e.daysAgo * 86400000).toISOString(),
  }));
  return { templates, automations, ...activity, editLog };
}

// A readable line for the History log from what changed.
function describeEdit(prev, next) {
  if (!prev) return 'Created the automation.';
  const parts = [];
  if (prev.name !== next.name) parts.push(`Renamed to “${next.name}”`);
  if (prev.status !== next.status) parts.push(`Changed status to ${statusDef(next.status).label}`);
  if (prev.schedule !== next.schedule || prev.runTime !== next.runTime) parts.push('Changed when it runs');
  if ((prev.populationGroupName || '') !== (next.populationGroupName || '')) parts.push('Changed the population group');
  const a = new Map((prev.graph?.nodes || []).map(n => [n.id, JSON.stringify(n)]));
  const b = new Map((next.graph?.nodes || []).map(n => [n.id, JSON.stringify(n)]));
  const added = [...b.keys()].filter(k => !a.has(k)).length;
  const removed = [...a.keys()].filter(k => !b.has(k)).length;
  const changed = [...b.keys()].filter(k => a.has(k) && a.get(k) !== b.get(k)).length;
  if (added) parts.push(`added ${added} step${added === 1 ? '' : 's'}`);
  if (removed) parts.push(`removed ${removed} step${removed === 1 ? '' : 's'}`);
  if (changed) parts.push(`edited ${changed} step${changed === 1 ? '' : 's'}`);
  if (!parts.length) return 'Saved without changes.';
  const s = parts.join(', ');
  return `${s.charAt(0).toUpperCase()}${s.slice(1)}.`;
}

export function createAutomationsSlice(set, get) {
  let inflight = null;
  const actor = () => get().currentUserProfile?.name || 'Fold Health';

  const ensureLocal = async () => {
    if (local) return local;
    local = buildLocal(await get().fetchAutomationMembers());
    return local;
  };

  const setActivity = (id, patch) => set(s => ({
    automationActivity: { ...s.automationActivity, [id]: { ...(s.automationActivity[id] || {}), ...patch } },
  }));

  const logEdit = async (automationId, summary) => {
    const entry = { id: uuid(), automationId, actor: actor(), summary, createdAt: nowIso() };
    const cur = get().automationActivity[automationId];
    if (cur?.editLog) setActivity(automationId, { editLog: [entry, ...cur.editLog] });
    if (get().automationsLocal) { local?.editLog.unshift(entry); return; }
    const { error } = await supabase.from('automation_edit_log').insert({ id: entry.id, automation_id: automationId, actor: entry.actor, summary });
    if (error) console.warn('automation_edit_log insert:', error.message);
  };

  // Persist one finished run (run, members, messages) and fold it into state.
  const persistRun = async (automation, run, sim) => {
    const memberRows = sim.members.map(m => ({ ...m, id: uuid(), runId: run.id, automationId: automation.id }));
    const memberIdOf = new Map(memberRows.map(m => [m.patientId, m.id]));
    const messageRows = sim.messages.map(m => ({ ...m, id: uuid(), runId: run.id, automationId: automation.id, runMemberId: memberIdOf.get(m.patientId) }));
    if (get().automationsLocal) {
      local.runs.push(run);
      local.members.push(...memberRows);
      local.messages.push(...messageRows);
    } else {
      const { error } = await supabase.from('automation_runs').insert(runJsToRow(run));
      if (error) { console.warn('automation_runs insert:', error.message); return null; }
      for (const part of chunk(memberRows.map(runMemberJsToRow), 500)) {
        const { error: e } = await supabase.from('automation_run_members').insert(part);
        if (e) console.warn('automation_run_members insert:', e.message);
      }
      for (const part of chunk(messageRows.map(messageJsToRow), 500)) {
        const { error: e } = await supabase.from('automation_messages').insert(part);
        if (e) console.warn('automation_messages insert:', e.message);
      }
      await supabase.from('automations').update({ last_executed_at: run.startedAt, last_run_status: run.failedCount ? 'errors' : 'ok' }).eq('id', automation.id);
    }
    set(s => ({
      automationRuns: [run, ...s.automationRuns],
      automations: s.automations.map(a => (a.id === automation.id ? { ...a, lastExecutedAt: run.startedAt, lastRunStatus: run.failedCount ? 'errors' : 'ok' } : a)),
    }));
    const cur = get().automationActivity[automation.id];
    if (cur?.members) {
      setActivity(automation.id, {
        runs: [run, ...(cur.runs || [])],
        members: [...memberRows, ...cur.members],
        messages: [...messageRows, ...(cur.messages || [])],
      });
    }
    return { run, members: memberRows, messages: messageRows };
  };

  // General Task steps a member reached become real tasks (single-member
  // runs, retries and re-triggers only; a group run records them).
  const createTasksFor = async (automation, graph, memberRow, patient) => {
    for (const [nodeId, step] of Object.entries(memberRow.path || {})) {
      const node = getNode(graph, nodeId);
      if (node?.type !== 'generalTask' || step.status !== 'success') continue;
      const c = node.config || {};
      await get().createTask?.({
        name: c.title,
        status: 'pending',
        priority: String(c.priority || 'Medium').toLowerCase(),
        due_date: null,
        assigned_to: c.assignee?.name || null,
        assigned_to_id: c.assignee?.id || null,
        member: patient?.name || memberRow.patientName || '',
        labels: ['Automation'],
        meta: automation.name,
        description: c.description || '',
        pool: c.pool || null,
        mentions: [],
        attachments: 0,
        comments: 0,
        is_subtask: false,
        parent_task: null,
        parent_task_id: null,
      }, { auditUserName: 'Automations' });
    }
  };

  const loadAutomations = async () => {
    set({ automationsStatus: 'loading' });
    const since = new Date(Date.now() - 90 * 86400000).toISOString();
    const [a, t, r] = await Promise.all([
      supabase.from('automations').select('*').order('updated_at', { ascending: false }),
      supabase.from('automation_templates').select('*').order('sort_order', { ascending: true }),
      supabase.from('automation_runs').select('id, automation_id, kind, target_type, target_label, member_count, completed_count, in_progress_count, failed_count, minutes_saved, triggered_by, started_at, finished_at')
        .gte('started_at', since).order('started_at', { ascending: false }).limit(2000),
    ]);
    const missing = [a, t, r].some(x => x.error && MISSING.has(x.error.code));
    if (missing) {
      const l = await ensureLocal();
      set({
        automationsLocal: true,
        automations: l.automations,
        automationTemplates: l.templates,
        automationRuns: [...l.runs].sort((x, y) => new Date(y.startedAt) - new Date(x.startedAt)),
        automationsStatus: 'ready',
      });
      return;
    }
    [a, t, r].forEach(x => x.error && console.warn('fetchAutomations:', x.error.message));
    set({
      automationsLocal: false,
      automations: (a.data || []).map(automationRowToJs),
      automationTemplates: (t.data || []).map(templateRowToJs),
      automationRuns: (r.data || []).map(runRowToJs),
      automationsStatus: 'ready',
    });
  };

  return {
    automations: [],
    automationsStatus: 'idle', // 'idle' | 'loading' | 'ready'
    automationsLocal: false,
    automationTemplates: [],
    // Recent runs across all automations (list badges, history).
    automationRuns: [],
    // Per automation: { status, runs, members, messages, editLog }.
    automationActivity: {},
    automationsView: { screen: 'list', id: null, tab: 'mine', analyticsTab: 'global', runMemberId: null },
    // Who a run can target: the account's patients, or sample members when
    // none are loaded (an empty dev database).
    automationMembers: [],
    automationMembersSample: false,
    // A not-yet-saved automation the builder opens on (id 'new').
    automationNew: null,

    setAutomationsView: (patch) => {
      set(s => ({ automationsView: { ...s.automationsView, ...patch } }));
      updateHash(get);
    },
    openAutomationsList: (tab) => get().setAutomationsView({ screen: 'list', id: null, runMemberId: null, ...(tab ? { tab } : {}) }),
    openAutomationBuilder: (id) => get().setAutomationsView({ screen: 'builder', id, runMemberId: null }),
    openAutomationAnalytics: (id, analyticsTab = 'global') => get().setAutomationsView({ screen: 'analytics', id, analyticsTab, runMemberId: null }),
    openAutomationTrace: (id, runMemberId) => get().setAutomationsView({ screen: 'trace', id, runMemberId }),
    openNewAutomation: (seed = null) => {
      set({ automationNew: seed });
      get().openAutomationBuilder('new');
    },

    // Content > Emails an action can send: [{ id, name, subject, category }].
    automationEmailOptions: [],
    fetchAutomationEmailOptions: async ({ force = false } = {}) => {
      if (!force && get().automationEmailOptions.length) return get().automationEmailOptions;
      const { data, error } = await supabase.from('campaigns')
        .select('id, name, subject_line, category, system_key')
        .eq('channel', 'email').order('name', { ascending: true }).limit(500);
      if (error) console.warn('fetchAutomationEmailOptions:', error.message);
      const rows = (data || []).map(r => ({ id: String(r.id), name: r.name || `Email ${r.id}`, subject: r.subject_line || '', category: r.category || '' }));
      // Seeded automation emails not in the database yet are offered by key.
      const seeded = new Set((data || []).map(r => r.system_key).filter(Boolean));
      const local = AUTOMATION_EMAILS.filter(e => !seeded.has(`automation:${e.key}`))
        .map(e => ({ id: `automation:${e.key}`, name: e.name, subject: e.subject, category: e.category }));
      const options = [...rows, ...local].sort((a, b) => a.name.localeCompare(b.name));
      set({ automationEmailOptions: options });
      return options;
    },
    // The email builder document of one email, for previews: { doc, subject, name } or null.
    fetchAutomationEmail: async (id) => {
      if (!id) return null;
      const key = String(id).startsWith('automation:') ? String(id).slice('automation:'.length) : null;
      if (key) {
        const e = AUTOMATION_EMAILS.find(x => x.key === key);
        return e ? { doc: automationEmailDoc(e), subject: e.subject, name: e.name, campaign: null } : null;
      }
      const c = await get().fetchCampaignById?.(id);
      return c ? { doc: c.emailTemplate, subject: c.subjectLine, name: c.name, campaign: c } : null;
    },

    fetchAutomationMembers: async () => {
      if (get().automationMembers.length) return get().automationMembers;
      if (!get().allPatients?.length) await get().fetchAllPatients?.();
      const patients = get().allPatients || [];
      const pool = patients.length ? patients : SAMPLE_MEMBERS;
      set({ automationMembers: pool, automationMembersSample: !patients.length });
      return pool;
    },

    fetchAutomations: async ({ force = false } = {}) => {
      if (!force && get().automationsStatus === 'ready') return;
      // Callers that need the data (activity, enrollment) wait on a load in flight.
      if (!force && inflight) return inflight;
      inflight = loadAutomations().finally(() => { inflight = null; });
      return inflight;
    },
    // Runs, members and messages of one automation (last 90 days) plus its edit log.
    fetchAutomationActivity: async (id, { force = false } = {}) => {
      if (!id || id === 'new') return;
      // Whether to read the tables or the local fallback is known once loaded.
      if (get().automationsStatus !== 'ready') await get().fetchAutomations();
      const cur = get().automationActivity[id];
      if (!force && cur && ['loading', 'ready'].includes(cur.status)) return;
      setActivity(id, { status: 'loading' });
      if (get().automationsLocal) {
        const l = await ensureLocal();
        setActivity(id, {
          status: 'ready',
          runs: l.runs.filter(x => x.automationId === id).sort((x, y) => new Date(y.startedAt) - new Date(x.startedAt)),
          members: l.members.filter(x => x.automationId === id),
          messages: l.messages.filter(x => x.automationId === id),
          editLog: l.editLog.filter(x => x.automationId === id).sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt)),
        });
        return;
      }
      const since = new Date(Date.now() - 90 * 86400000).toISOString();
      const [runs, members, messages, edits] = await Promise.all([
        supabase.from('automation_runs').select('*').eq('automation_id', id).gte('started_at', since).order('started_at', { ascending: false }),
        supabase.from('automation_run_members').select('*').eq('automation_id', id).gte('started_at', since).order('started_at', { ascending: false }).limit(5000),
        supabase.from('automation_messages').select('*').eq('automation_id', id).gte('sent_at', since).limit(10000),
        supabase.from('automation_edit_log').select('*').eq('automation_id', id).order('created_at', { ascending: false }).limit(200),
      ]);
      [runs, members, messages, edits].forEach(x => x.error && console.warn('fetchAutomationActivity:', x.error.message));
      setActivity(id, {
        status: 'ready',
        runs: (runs.data || []).map(runRowToJs),
        members: (members.data || []).map(runMemberRowToJs),
        messages: (messages.data || []).map(messageRowToJs),
        editLog: (edits.data || []).map(editLogRowToJs),
      });
    },

    /**
     * Create (id null / 'new') or update an automation. `values` carries any of
     * name, description, status, schedule, runTime, population, graph,
     * draftGraph, templateId. Returns the saved automation or null.
     */
    saveAutomation: async (values, id = null, { log = true } = {}) => {
      const isNew = !id || id === 'new';
      const prev = isNew ? null : get().automations.find(a => a.id === id);
      const next = { ...(prev || {}), ...values };
      const stamp = { updatedBy: actor(), updatedAt: nowIso() };
      let saved;
      if (get().automationsLocal) {
        saved = { ...next, ...stamp, id: isNew ? uuid() : id, ...(isNew ? { createdBy: actor(), createdAt: nowIso() } : {}) };
        local.automations = isNew ? [saved, ...local.automations] : local.automations.map(a => (a.id === id ? saved : a));
      } else {
        const row = { ...automationJsToRow(next), updated_by: stamp.updatedBy, updated_at: stamp.updatedAt };
        const q = isNew
          ? supabase.from('automations').insert({ ...row, created_by: actor() })
          : supabase.from('automations').update(row).eq('id', id);
        const { data, error } = await q.select().single();
        if (error) {
          console.warn('saveAutomation:', error.message);
          get().showToast?.('Could not save the automation');
          return null;
        }
        saved = automationRowToJs(data);
      }
      set(s => ({ automations: isNew ? [saved, ...s.automations] : s.automations.map(a => (a.id === id ? saved : a)) }));
      if (log && (isNew || values.graph || values.name || values.status || values.schedule)) {
        logEdit(saved.id, describeEdit(prev, saved));
      }
      if (isNew && values.templateId) get().bumpTemplateUse(values.templateId);
      return saved;
    },

    // The builder's autosave: the working copy only; the published graph keeps running.
    saveAutomationDraft: async (id, draftGraph) => {
      if (!id || id === 'new') return false;
      if (get().automationsLocal) {
        local.automations = local.automations.map(a => (a.id === id ? { ...a, draftGraph } : a));
      } else {
        const { error } = await supabase.from('automations').update({ draft_graph: draftGraph }).eq('id', id);
        if (error) { console.warn('saveAutomationDraft:', error.message); return false; }
      }
      set(s => ({ automations: s.automations.map(a => (a.id === id ? { ...a, draftGraph } : a)) }));
      return true;
    },

    setAutomationStatus: async (id, status) => {
      const saved = await get().saveAutomation({ status }, id);
      if (saved) get().showToast?.(`“${saved.name}” is now ${statusDef(status).label.toLowerCase()}`);
      return saved;
    },

    deleteAutomation: async (id) => {
      const prev = get().automations;
      set({ automations: prev.filter(a => a.id !== id) });
      if (get().automationsLocal) { local.automations = local.automations.filter(a => a.id !== id); return true; }
      const { error } = await supabase.from('automations').delete().eq('id', id);
      if (error) {
        console.warn('deleteAutomation:', error.message);
        set({ automations: prev });
        get().showToast?.('Could not delete the automation');
        return false;
      }
      return true;
    },

    duplicateAutomation: async (id) => {
      const src = get().automations.find(a => a.id === id);
      if (!src) return null;
      const copy = await get().saveAutomation({
        name: `Copy of ${src.name}`,
        description: src.description,
        status: 'draft',
        schedule: src.schedule,
        runTime: src.runTime,
        populationGroupId: src.populationGroupId,
        populationGroupName: src.populationGroupName,
        graph: src.draftGraph || src.graph,
        draftGraph: null,
        templateId: src.templateId,
      }, null, { log: false });
      if (copy) logEdit(copy.id, `Duplicated from “${src.name}”.`);
      return copy;
    },

    bumpTemplateUse: async (templateId) => {
      const t = get().automationTemplates.find(x => x.id === templateId);
      if (!t) return;
      set(s => ({ automationTemplates: s.automationTemplates.map(x => (x.id === templateId ? { ...x, usedCount: x.usedCount + 1 } : x)) }));
      if (get().automationsLocal) return;
      await supabase.from('automation_templates').update({ used_count: t.usedCount + 1 }).eq('id', templateId);
    },

    markAutomationTested: async (id) => {
      if (!id || id === 'new') return;
      const at = nowIso();
      set(s => ({ automations: s.automations.map(a => (a.id === id ? { ...a, lastTestedAt: at } : a)) }));
      if (!get().automationsLocal) await supabase.from('automations').update({ last_tested_at: at }).eq('id', id);
    },

    /**
     * Run an automation now for chosen members (Run Automation drawer).
     * target: { type: 'member' | 'patientGroup' | 'leadGroup' | 'employer', label, members: patient[] }
     */
    runAutomation: async (id, target) => {
      const automation = get().automations.find(a => a.id === id);
      if (!automation || !target?.members?.length) return null;
      const runId = uuid();
      const startAt = nowIso();
      const graph = automation.graph;
      const sim = simulateRun(graph, target.members, { runKey: runId, startAt });
      const counts = { completed: 0, in_progress: 0, failed: 0 };
      sim.members.forEach(m => { counts[m.status] += 1; });
      const run = {
        id: runId, automationId: id, kind: 'manual', targetType: target.type, targetLabel: target.label,
        memberCount: sim.members.length, completedCount: counts.completed, inProgressCount: counts.in_progress,
        failedCount: counts.failed, minutesSaved: sim.members.reduce((s, m) => s + m.minutesSaved, 0),
        graph, triggeredBy: actor(), startedAt: startAt,
        finishedAt: counts.in_progress ? null : sim.members.map(m => m.finishedAt).filter(Boolean).sort().at(-1) || startAt,
      };
      const saved = await persistRun(automation, run, sim);
      if (!saved) { get().showToast?.('Could not run the automation'); return null; }
      if (target.type === 'member') {
        for (const m of saved.members) await createTasksFor(automation, graph, m, target.members.find(p => p.id === m.patientId));
      }
      if (run.failedCount) get().notifyAutomationFailure(automation, run);
      return run;
    },

    // Retry (row menu) and Re-trigger (member trace): resume the member from
    // the step that failed or is waiting, keeping steps that already ran.
    retryAutomationMember: async (memberRow, kind = 'retry') => {
      const automation = get().automations.find(a => a.id === memberRow.automationId);
      if (!automation) return null;
      const pool = await get().fetchAutomationMembers();
      const patient = pool.find(p => String(p.id) === String(memberRow.patientId))
        || { id: memberRow.patientId, name: memberRow.patientName };
      const runId = uuid();
      const startAt = nowIso();
      const graph = automation.graph;
      const sim = simulateRun(graph, [patient], { runKey: runId, startAt, resume: { [patient.id]: memberRow.path } });
      const m = sim.members[0];
      const run = {
        id: runId, automationId: automation.id, kind, targetType: 'member', targetLabel: patient.name,
        memberCount: 1, completedCount: m.status === 'completed' ? 1 : 0, inProgressCount: m.status === 'in_progress' ? 1 : 0,
        failedCount: m.status === 'failed' ? 1 : 0, minutesSaved: m.minutesSaved, graph, triggeredBy: actor(),
        startedAt: startAt, finishedAt: m.finishedAt,
      };
      const saved = await persistRun(automation, run, sim);
      if (!saved) return null;
      await createTasksFor(automation, graph, saved.members[0], patient);
      return saved.members[0];
    },

    notifyAutomationFailure: (automation, run) => {
      get().showToast?.(`${automation.name}: ${run.failedCount} of ${run.memberCount} member${run.memberCount === 1 ? '' : 's'} failed`, {
        action: { label: 'View', onClick: () => get().setAutomationsView({ screen: 'analytics', id: automation.id, analyticsTab: 'global', drawer: 'overview:failed' }) },
      });
      get().addNotification?.({
        type: 'automation.failed',
        title: 'Automation failed',
        body: `${automation.name}: ${run.failedCount} member${run.failedCount === 1 ? '' : 's'} failed.`,
      });
    },

    // ── Care program enrollment (formerly Settings > Automation Rules) ──
    // Each active automation triggered by "A patient is enrolled in a care
    // program" is read as a rule (clinical criteria + templates + reviewer).
    // matchCarePlanTemplates evaluates them against the patient's record.

    // Every rule's result (matched or not, with reasons), the matched ones,
    // and `recommended`: each distinct template a matched rule names, with
    // the rule and the criteria the patient met ({ templateId, rule, criteria }).
    matchCarePlanTemplates: async (patientId, program) => {
      const none = { results: [], matched: [], recommended: [] };
      if (!patientId || !program?.id) return none;
      if (get().automationsStatus !== 'ready') await get().fetchAutomations();
      const applicable = rulesForProgram(enrollmentRulesOf(get().automations), program.code);
      if (!applicable.length) return none;

      const [problems, events, responses] = await Promise.all([
        supabase.from('patient_problems').select('title, status').eq('patient_id', String(patientId)),
        supabase.from('patient_clinical_events').select('event_type, code, display, effective_date, status, numeric_value, unit').eq('patient_id', String(patientId)),
        // patient_id on form_responses comes with the automation rules migration.
        supabase.from('form_responses').select('form_id, answers, status, completed_at, created_at').eq('patient_id', String(patientId))
          .order('created_at', { ascending: false }).limit(50),
      ]);
      const inputs = buildRuleInputs({
        problems: problems.data || [],
        clinicalEvents: events.data || [],
        responses: responses.error ? [] : (responses.data || []),
      });
      const results = applicable.map(rule => ({ rule, ...evaluateRule(rule, inputs) }));
      const matched = results.filter(r => r.matched);
      if (matched.length && !get().carePlanTemplates.length) await get().fetchCarePlanLibrary();
      const known = new Set(get().carePlanTemplates.map(t => String(t.id)));
      const recommended = [];
      for (const r of matched) {
        for (const id of r.rule.templateIds || []) {
          if (!known.has(String(id)) || recommended.some(x => x.templateId === String(id))) continue;
          recommended.push({ templateId: String(id), rule: r.rule.name, criteria: r.reasons.filter(x => x.ok).map(x => x.text) });
        }
      }
      return { results, matched, recommended };
    },

    // A new plan recommended for review: the automation-matched templates
    // merged and tailored by UnityAI, every item flagged until approved. With
    // no match, UnityAI picks the templates itself. Throws like
    // draftIndividualizedPlan.
    recommendCarePlan: async (patientId, program) => {
      const { recommended } = await get().matchCarePlanTemplates(patientId, program);
      const draft = await get().draftIndividualizedPlan(patientId, program, { recommended });
      return { ...draft, recommended };
    },

    // On enrollment: an empty plan gets the UnityAI recommendation from the
    // matched templates; if that can't run (or the plan already has items),
    // the templates are attached as they are. Either way it stays unsigned
    // (a draft) and one review task goes to the care manager listing why.
    // Every evaluation is recorded as a run of that automation.
    runAutoApplyRules: async (patientId, program) => {
      if (!patientId || !program?.id) return { matched: [], taskId: null };
      const { results, matched, recommended } = await get().matchCarePlanTemplates(patientId, program);

      let taskId = null;
      if (matched.length) {
        const templates = get().carePlanTemplates;
        await get().fetchPatientCarePlan(patientId, program.id);
        const key = carePlanKey(patientId, program.id);
        const cur = get().patientCarePlans[key];
        const prev = cur?.plan?.appliedTemplateIds || [];
        const planEmpty = !cur || (cur.goals.length + cur.interventions.length + (cur.barriers || []).length) === 0;

        let aiDraft = null;
        if (planEmpty && recommended.length) {
          try {
            aiDraft = await get().draftIndividualizedPlan(patientId, program, { recommended });
          } catch (err) {
            console.warn('runAutoApplyRules: recommendation fell back to attaching templates:', err?.message || err);
          }
        }
        const already = new Set(prev.map(String));
        const attached = aiDraft ? [] : recommended.map(r => r.templateId).filter(id => !already.has(id));
        if (attached.length) await get().applyPatientCarePlanTemplates(patientId, program, [...prev, ...attached]);

        const memberName = get().patients.find(p => String(p.id) === String(patientId))?.name || '';
        const users = get().platformUsers || [];
        const named = matched.map(r => r.rule.reviewer).find(rv => rv?.name)
          || (program.assignee && program.assignee !== 'Unassigned' ? users.find(u => u.name === program.assignee) : null);
        const reviewer = named ? { id: named.id || null, name: named.name } : null;
        const templateNames = aiDraft
          ? aiDraft.templates.map(t => t.name)
          : attached.map(id => templates.find(t => String(t.id) === id)?.name).filter(Boolean);
        const lines = matched.map(r => `• ${r.rule.name}: ${r.reasons.filter(x => x.ok).map(x => x.text).join('; ')}`);
        const due = new Date(); due.setDate(due.getDate() + 2);
        const task = await get().createTask({
          name: `${aiDraft ? 'Review recommended' : 'Review auto-applied'} care plan for ${memberName || 'patient'}`,
          status: 'pending',
          priority: 'medium',
          due_date: `${String(due.getMonth() + 1).padStart(2, '0')}/${String(due.getDate()).padStart(2, '0')}/${due.getFullYear()}`,
          assigned_to: reviewer?.name || null,
          assigned_to_id: reviewer?.id || null,
          member: memberName,
          labels: ['Care Plan Review', 'Automation'],
          meta: program.name || program.code || '',
          description: [
            aiDraft
              ? `On enrollment in ${program.name || program.code}, automations matched ${templateNames.join(', ')} and UnityAI merged them into one recommended plan (${aiDraft.counts}). Every item awaits review: approve or edit it, then sign the plan.`
              : `On enrollment in ${program.name || program.code}, automations matched and ${templateNames.length ? `attached ${templateNames.join(', ')} in draft` : 'found the templates already on the plan'}. Review, edit and sign the plan.`,
            ...lines,
          ].join('\n'),
          // No named reviewer or program owner: queue it for any care manager to claim.
          pool: reviewer ? null : 'Care Management',
          mentions: reviewer ? [reviewer.name] : [],
          attachments: 0,
          comments: 0,
          is_subtask: false,
          parent_task: null,
          parent_task_id: null,
        }, { auditUserName: 'Automations' });
        taskId = task?.id != null ? String(task.id) : null;
        if (task && program.code) get().addProgramTask?.(program.code, task);
        get().logCarePlanAudit(patientId, program, {
          entityType: 'plan',
          action: 'auto_applied',
          summary: matched.map(r => r.rule.name).join(', '),
          detail: aiDraft
            ? `UnityAI recommended a plan from: ${templateNames.join(', ')}`
            : templateNames.length ? `Attached in draft: ${templateNames.join(', ')}` : 'Templates were already on the plan',
        });
        if (reviewer?.id) {
          get().addNotification?.({
            type: 'care_plan.review_requested',
            title: aiDraft ? 'Recommended care plan to review' : 'Auto-applied care plan to review',
            body: aiDraft
              ? `UnityAI recommended a care plan for ${memberName} from ${templateNames.join(', ')}.`
              : `Automations attached ${templateNames.join(', ') || 'templates'} for ${memberName}.`,
            action: 'openCarePlan',
            recipientId: reviewer.id,
          });
        }
      }

      // Every automation evaluated, matched or not, is a run with its reasons.
      const memberName = get().patients.find(p => String(p.id) === String(patientId))?.name || String(patientId);
      for (const r of results) {
        const automation = get().automations.find(a => a.id === r.rule.id);
        if (!automation) continue;
        const at = nowIso();
        const criteriaId = r.rule.criteriaNodeId;
        const path = {
          trigger: { status: 'success', at },
          [criteriaId]: { status: 'success', at, outcome: r.matched ? 'next' : 'notMatched', reasons: r.reasons.map(x => `${x.ok ? '✓' : '✗'} ${x.text}`) },
          ...(r.matched && r.rule.attachNodeId ? { [r.rule.attachNodeId]: { status: 'success', at, taskId } } : {}),
        };
        const run = {
          id: uuid(), automationId: automation.id, kind: 'event', targetType: 'trigger', targetLabel: program.name || program.code,
          memberCount: 1, completedCount: 1, inProgressCount: 0, failedCount: 0, minutesSaved: r.matched ? 15 : 0,
          graph: automation.graph, triggeredBy: null, startedAt: at, finishedAt: at,
        };
        await persistRun(automation, run, {
          members: [{ patientId: String(patientId), patientName: memberName, status: 'completed', failingReason: null, minutesSaved: run.minutesSaved, startedAt: at, finishedAt: at, path }],
          messages: [],
        });
      }
      return { matched: matched.map(r => r.rule), taskId };
    },

    runProgramStatusRules: async (patientId, program, status) => {
      if (!patientId || !program?.id || !status) return { changed: [] };
      if (get().automationsStatus !== 'ready') await get().fetchAutomations();
      const rules = rulesForProgramStatus(programStatusRulesOf(get().automations), program.code, status);
      if (!rules.length) return { changed: [] };

      const { data: planRow } = await supabase.from('patient_care_plans').select('id')
        .eq('patient_id', String(patientId)).eq('program_id', program.id).maybeSingle();
      const TABLES = { goal: 'patient_care_plan_goals', intervention: 'patient_care_plan_interventions', barrier: 'patient_care_plan_barriers' };
      const items = { goal: [], intervention: [], barrier: [] };
      if (planRow) {
        const reads = await Promise.all(Object.entries(TABLES).map(([kind, table]) => supabase.from(table)
          .select('id, title, status').eq('plan_id', planRow.id).is('retired_instance_id', null)
          .then(res => [kind, res.data || []])));
        for (const [kind, rows] of reads) items[kind] = rows;
      }
      const transitions = gbiTransitions(items, rules);

      // One write per kind and target; the reason column comes with
      // gbi_status_reason_migration.sql, so retry without it until then.
      const changed = [];
      const groups = new Map();
      for (const t of transitions) {
        const k = `${t.kind}|${t.to}|${t.reason}`;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(t);
      }
      // Groups touch disjoint rows, so they write concurrently.
      const written = await Promise.all([...groups.values()].map(async (list) => {
        const { kind, to, reason } = list[0];
        const base = { status: to, updated_at: nowIso(), ...(kind === 'barrier' ? {} : { updated_by: 'Automations' }) };
        const ids = list.map(t => t.id);
        let { error } = await supabase.from(TABLES[kind]).update({ ...base, status_reason: reason || null }).in('id', ids);
        if (error && /status_reason/.test(error.message || '')) ({ error } = await supabase.from(TABLES[kind]).update(base).in('id', ids));
        if (error) { console.warn('runProgramStatusRules:', error.message); return []; }
        return list;
      }));
      for (const list of written) changed.push(...list);

      if (changed.length) {
        get().logCarePlanAudit(patientId, program, changed.map(t => ({
          entityType: t.kind, entityId: t.id, action: 'status_changed', summary: t.title,
          detail: `${t.reason || `Program ${status}`}: ${t.from} → ${t.to}`,
        })));
        // Show the new statuses wherever this plan is open.
        const key = carePlanKey(patientId, program.id);
        const lists = { goal: 'goals', intervention: 'interventions', barrier: 'barriers' };
        const patchList = (slice) => {
          if (!slice) return slice;
          const next = { ...slice };
          for (const [kind, listKey] of Object.entries(lists)) {
            const byId = new Map(changed.filter(t => t.kind === kind).map(t => [t.id, t]));
            if (!byId.size || !next[listKey]) continue;
            next[listKey] = next[listKey].map(x => (byId.has(x.id) ? { ...x, status: byId.get(x.id).to, statusReason: byId.get(x.id).reason } : x));
          }
          return next;
        };
        set(st => ({
          patientCarePlans: st.patientCarePlans[key] ? { ...st.patientCarePlans, [key]: patchList(st.patientCarePlans[key]) } : st.patientCarePlans,
          patientSignedCarePlans: st.patientSignedCarePlans?.[key] ? { ...st.patientSignedCarePlans, [key]: patchList(st.patientSignedCarePlans[key]) } : st.patientSignedCarePlans,
        }));
        const to = [...new Set(changed.map(t => t.to))].join(', ');
        get().showToast?.(`${changed.length} open care plan item${changed.length === 1 ? '' : 's'} set to ${to}`);
      }

      // A run per automation that applied, with what it changed (one record each, written concurrently).
      const memberName = get().patients.find(p => String(p.id) === String(patientId))?.name || String(patientId);
      await Promise.all(rules.map(async (rule) => {
        const automation = get().automations.find(a => a.id === rule.id);
        if (!automation) return;
        const mine = changed.filter(t => t.ruleId === rule.id);
        const at = nowIso();
        const path = {
          trigger: { status: 'success', at },
          [rule.actionNodeId]: {
            status: 'success', at,
            reasons: mine.length
              ? mine.map(t => `${t.title}: ${t.from} → ${t.to}`)
              : [planRow ? 'No open care plan items to update' : 'This program has no care plan'],
          },
        };
        const run = {
          id: uuid(), automationId: automation.id, kind: 'event', targetType: 'trigger', targetLabel: `${program.name || program.code} → ${status}`,
          memberCount: 1, completedCount: 1, inProgressCount: 0, failedCount: 0, minutesSaved: mine.length ? 5 : 0,
          graph: automation.graph, triggeredBy: null, startedAt: at, finishedAt: at,
        };
        await persistRun(automation, run, {
          members: [{ patientId: String(patientId), patientName: memberName, status: 'completed', failingReason: null, minutesSaved: run.minutesSaved, startedAt: at, finishedAt: at, path }],
          messages: [],
        });
      }));
      return { changed };
    },
  };
}

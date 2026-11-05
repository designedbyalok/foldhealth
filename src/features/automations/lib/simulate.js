/* The execution simulator. Nothing is delivered: an automation run walks the
   graph for each member and records what would have happened, and those
   records are what History, Analytics and the member trace read.

   Deterministic: every draw is a hash of (member, node, run), so re-running
   the seed or a retry produces the same outcome for the same inputs.

   Per member it produces
     { patientId, patientName, status: 'completed' | 'in_progress' | 'failed',
       failingReason, minutesSaved, startedAt, finishedAt,
       path: { [nodeId]: { status, outcome?, at, error? } } }
   and per message step a message event
     { nodeId, channel: 'email' | 'sms', patientId, patientName, address,
       status: 'delivered' | 'opened' | 'clicked' | 'failed', opens, clicks,
       failingReason, sentAt }

   Node status: 'success' | 'error' | 'in_progress' (waiting on a delay) |
   'skipped' (delay during a test) | 'not_run'. */

import { nodeDef, OUTCOME_SETS } from './catalog';
import { branchesOf, childrenOf, getNode, nodeProblems, orderedSteps } from './graph';
import { evaluateRules, hash01, preferredChannelOf } from './conditionFields';

const MIN = 60000;
const toMs = (amount, unit) => Number(amount || 0) * (unit === 'minutes' ? MIN : unit === 'hours' ? 60 * MIN : unit === 'weeks' ? 7 * 1440 * MIN : 1440 * MIN);

const validEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || ''));
const validPhone = (s) => String(s || '').replace(/\D/g, '').length >= 10;

// Delivery failures past bad addresses, split by channel.
const EMAIL_FAILS = ['Undelivered', 'Network issue'];
const SMS_FAILS = ['Undelivered', 'Phone was switched off'];

function pickOutcome(node, draw) {
  const set = OUTCOME_SETS[nodeDef(node.type)?.outcomes];
  if (!set) return 'next';
  let acc = 0;
  for (const o of set.outcomes) { acc += o.rate; if (draw < acc) return o.key; }
  return set.outcomes.at(-1).key;
}

/**
 * Simulate one run.
 * @param graph        automation graph
 * @param members      patient records (all_patients store shape)
 * @param opts.runKey  salt for the draws (the run id)
 * @param opts.startAt ISO time the run started
 * @param opts.now     time "now" for delays (default: real now)
 * @param opts.resume  { [patientId]: previousPath } to resume each member from
 *                     the step that failed or was waiting (Retry / Re-trigger)
 * @param opts.clinical (patient) => boolean | null, for clinical criteria
 */
export function simulateRun(graph, members, opts = {}) {
  const runKey = opts.runKey || 'run';
  const startMs = new Date(opts.startAt || Date.now()).getTime();
  const nowMs = new Date(opts.now || Date.now()).getTime();
  const results = [];
  const messages = [];

  for (const p of members) {
    const path = {};
    let t = startMs + Math.floor(hash01(`${runKey}:${p.id}:start`) * 30 * MIN);
    let paused = false;
    let minutes = 0;
    const errors = [];
    const prev = opts.resume?.[p.id] || null;
    const draw = (node, what) => hash01(`${runKey}:${p.id}:${node.id}:${what}`);

    const visitKids = (node, branch) => childrenOf(graph, node.id, branch).forEach(visit);

    function visit(node) {
      // Resume: steps that already succeeded keep their record and the walk
      // follows the branch they took.
      const before = prev?.[node.id];
      if (before && before.status === 'success') {
        path[node.id] = before;
        if (node.type !== 'repeat') visitKids(node, before.outcome || 'next');
        return;
      }
      t += Math.floor((1 + draw(node, 'dt') * 4) * MIN);
      const at = new Date(t).toISOString();
      const def = nodeDef(node.type);

      if (node.id === 'trigger') {
        path[node.id] = { status: 'success', at };
        visitKids(node, 'next');
        return;
      }
      if (node.type === 'microAutomation' || node.type === 'and' || node.type === 'or') {
        path[node.id] = { status: 'success', at };
        visitKids(node, 'next');
        return;
      }
      if (node.type === 'delay') {
        const until = t + toMs(node.config?.amount, node.config?.unit);
        if (until > nowMs) {
          path[node.id] = { status: 'in_progress', at, until: new Date(until).toISOString() };
          paused = true;
          return;
        }
        t = until;
        path[node.id] = { status: 'success', at: new Date(t).toISOString() };
        visitKids(node, 'next');
        return;
      }
      if (node.type === 'repeat') {
        path[node.id] = { status: 'success', at, outcome: `${node.config?.times || 1}x` };
        return;
      }
      if (def?.kind === 'condition') {
        let branch = 'next';
        let matched;
        if (node.type === 'preferredChannel') {
          const ch = preferredChannelOf(p);
          matched = (node.config?.channels || []).includes(ch);
          branch = ch;
        } else if (node.type === 'clinicalCriteria') {
          const c = opts.clinical?.(p, node);
          matched = c == null ? draw(node, 'clinical') < 0.55 : c;
        } else if (node.type === 'deactivated') {
          matched = String(p.status || '').toLowerCase() === 'inactive';
        } else {
          matched = evaluateRules(node.config?.rules, p, new Date(t)).matched;
        }
        path[node.id] = { status: 'success', at, outcome: matched ? branch : 'notMatched' };
        if (matched) visitKids(node, branch);
        return;
      }

      // An action. A step with missing setup fails the same way a test does.
      const problems = nodeProblems(node);
      if (problems.length) {
        const error = `${problems[0].label} is not set`;
        path[node.id] = { status: 'error', at, error };
        errors.push(error);
        return;
      }
      const channel = def?.channel === 'preferred' ? preferredChannelOf(p) : def?.channel;
      if (channel === 'email' || channel === 'sms') {
        const address = channel === 'email' ? p.email : p.phone;
        const ok = channel === 'email' ? validEmail(address) : validPhone(address);
        let fail = ok ? null : (channel === 'email' ? 'Invalid email address' : 'Invalid phone number');
        if (!fail && draw(node, 'deliver') < 0.02) {
          const pool = channel === 'email' ? EMAIL_FAILS : SMS_FAILS;
          fail = pool[Math.floor(draw(node, 'why') * pool.length)];
        }
        if (fail) {
          path[node.id] = { status: 'error', at, error: fail };
          errors.push(fail);
          messages.push({ nodeId: node.id, channel, patientId: p.id, patientName: p.name, address: address || '', status: 'failed', opens: 0, clicks: 0, failingReason: fail, sentAt: at });
          return;
        }
        const outcome = pickOutcome(node, draw(node, 'outcome'));
        // Email engagement follows the branch when the step splits on it.
        const opened = channel === 'email' && (def.outcomes === 'emailStatus' ? outcome === 'opened' : draw(node, 'open') < 0.55);
        const clicked = opened && draw(node, 'click') < 0.42;
        messages.push({
          nodeId: node.id, channel, patientId: p.id, patientName: p.name, address,
          status: clicked ? 'clicked' : opened ? 'opened' : 'delivered',
          opens: opened ? 1 + Math.floor(draw(node, 'opens') * 3) : 0,
          clicks: clicked ? 1 + Math.floor(draw(node, 'clicks') * 2) : 0,
          failingReason: null, sentAt: at,
        });
        path[node.id] = { status: 'success', at, outcome };
        minutes += def.minutes || 0;
        visitKids(node, branchesOf(node)[0]?.key === 'next' ? 'next' : outcome);
        return;
      }
      // Push, chat, voice, tasks, labs, care plans: always "done" in a simulation.
      const outcome = def?.outcomes ? pickOutcome(node, draw(node, 'outcome')) : 'next';
      path[node.id] = { status: 'success', at, outcome };
      minutes += def?.minutes || 0;
      visitKids(node, outcome);
    }

    const root = getNode(graph, 'trigger');
    if (root) visit(root);

    const status = errors.length ? 'failed' : paused ? 'in_progress' : 'completed';
    results.push({
      patientId: p.id,
      patientName: p.name,
      status,
      failingReason: errors.length ? [...new Set(errors)].join(' • ') : null,
      minutesSaved: minutes,
      startedAt: new Date(startMs).toISOString(),
      finishedAt: status === 'in_progress' ? null : new Date(t).toISOString(),
      path,
    });
  }
  return { members: results, messages };
}

/** The step to resume a member from: the first failed or waiting step in run order. */
export function resumePoint(graph, path) {
  return orderedSteps(graph, { includeLogic: true }).find(n => ['error', 'in_progress'].includes(path?.[n.id]?.status)) || null;
}

/**
 * One step of a test run. Nothing is sent or created; the step checks its own
 * setup. Delays are skipped (the Test tooltip: "Delay nodes are skipped").
 * Returns { status: 'success' | 'error' | 'skipped', errors: [{ field, label, message }] }.
 */
export function testStep(node) {
  if (node?.type === 'delay') return { status: 'skipped', errors: [] };
  const problems = nodeProblems(node);
  if (problems.length) {
    return { status: 'error', errors: problems.map(p => ({ ...p, message: 'This field can’t be empty' })) };
  }
  return { status: 'success', errors: [] };
}

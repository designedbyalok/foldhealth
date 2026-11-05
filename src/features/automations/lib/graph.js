/* The automation graph: a tree of nodes stored flat.

   node = { id, type, parentId, branch, order, config }
     - The root is the trigger (id 'trigger', parentId null).
     - `branch` is the parent's outcome key ('opened', 'booked', a channel…)
       or 'next' for a parent without outcomes. Several nodes may share a
       parent + branch: they run in parallel (the Figma's "2 Micro
       Automations" under one condition).
     - A Micro Automation node is a container: its children are its steps.
       It has no continuation of its own.
     - Repeat is terminal; it repeats the nearest message step above it.

   Everything here is pure (no React, no store) so the builder, the canvas,
   the simulator, the seed script and the tests share it. */

import { nodeDef, OUTCOME_SETS, CHANNELS, formatDuration, triggerDef } from './catalog';
import { summarizeRules } from './conditionFields';
import { describeCondition } from './clinicalCriteria';
import { GBI_KINDS, programStatusLabel } from './programStatusRules';

let seq = 0;
export const newNodeId = () => `n${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export const emptyGraph = (triggerType = null) => ({
  nodes: [{ id: 'trigger', type: triggerType, parentId: null, branch: null, order: 0, config: {} }],
});

export const getNode = (graph, id) => graph?.nodes?.find(n => n.id === id) || null;

export const childrenOf = (graph, parentId, branch) => (graph?.nodes || [])
  .filter(n => n.parentId === parentId && (branch === undefined || n.branch === branch))
  .sort((a, b) => a.order - b.order);

/** The branches a node offers: [{ key, label, icon }]. `next` for a plain node. */
export function branchesOf(node) {
  if (!node) return [];
  const def = nodeDef(node.type);
  if (node.id === 'trigger') return node.type ? [{ key: 'next', label: null }] : [];
  if (node.type === 'repeat') return [];
  if (def?.outcomes === 'channels') {
    const picked = node.config?.channels?.length ? node.config.channels : [];
    return picked.map(k => CHANNELS.find(c => c.key === k)).filter(Boolean)
      .map(c => ({ key: c.key, label: c.label, icon: c.icon }));
  }
  if (def?.outcomes && OUTCOME_SETS[def.outcomes]) {
    return OUTCOME_SETS[def.outcomes].outcomes.map(o => ({ key: o.key, label: o.label, icon: o.icon }));
  }
  return [{ key: 'next', label: null }];
}

export const outcomeSetOf = (node) => {
  const def = nodeDef(node?.type);
  if (def?.outcomes === 'channels') return { label: 'Channels' };
  return def?.outcomes ? OUTCOME_SETS[def.outcomes] : null;
};

export const descendantIds = (graph, id) => {
  const out = [];
  const walk = (pid) => childrenOf(graph, pid).forEach(c => { out.push(c.id); walk(c.id); });
  walk(id);
  return out;
};

export const ancestorsOf = (graph, id) => {
  const out = [];
  let cur = getNode(graph, id);
  while (cur?.parentId) { cur = getNode(graph, cur.parentId); if (cur) out.push(cur); }
  return out;
};

/** The micro automation a node sits in, or null. */
export const groupOf = (graph, id) => ancestorsOf(graph, id).find(a => a.type === 'microAutomation') || null;

const MESSAGE_TYPES = new Set(['email', 'sms', 'reminder', 'form', 'appointmentLink', 'push', 'appInvitation', 'education', 'ivr', 'preferredChannelMessage']);
export const isMessage = (node) => MESSAGE_TYPES.has(node?.type);

// ── Mutations (all return a new graph) ──

export function insertNode(graph, { parentId, branch = 'next', type, config = {}, index = null }) {
  const siblings = childrenOf(graph, parentId, branch);
  const order = index == null ? (siblings.at(-1)?.order ?? -1) + 1 : index - 0.5;
  const node = { id: newNodeId(), type, parentId, branch, order, config: { ...defaultConfig(type), ...config } };
  return { graph: normalizeOrder({ nodes: [...graph.nodes, node] }), node };
}

/**
 * Put a node between `childId` and its parent: the child (and its subtree)
 * moves under the new node's first branch. Used by "Add Delay" on the
 * duplicate-action warning.
 */
export function insertBetween(graph, childId, type, config = {}) {
  const child = getNode(graph, childId);
  if (!child) return { graph, node: null };
  const node = { id: newNodeId(), type, parentId: child.parentId, branch: child.branch, order: child.order, config: { ...defaultConfig(type), ...config } };
  const firstBranch = branchesOf(node)[0]?.key || 'next';
  const nodes = graph.nodes.map(n => (n.id === childId ? { ...n, parentId: node.id, branch: firstBranch, order: 0 } : n));
  return { graph: { nodes: [...nodes, node] }, node };
}

export function updateNodeConfig(graph, id, config) {
  return {
    nodes: graph.nodes.map(n => {
      if (n.id !== id) return n;
      const next = { ...n, config: { ...n.config, ...config } };
      return next;
    }),
  };
}

/** A splitter whose outcome set changed (channels) drops children on branches that no longer exist. */
export function pruneBranches(graph, id) {
  const node = getNode(graph, id);
  const keys = new Set(branchesOf(node).map(b => b.key));
  const orphans = childrenOf(graph, id).filter(c => !keys.has(c.branch));
  if (!orphans.length) return graph;
  const drop = new Set(orphans.flatMap(o => [o.id, ...descendantIds(graph, o.id)]));
  return { nodes: graph.nodes.filter(n => !drop.has(n.id)) };
}

export function setTrigger(graph, type, config = {}) {
  return { nodes: graph.nodes.map(n => (n.id === 'trigger' ? { ...n, type, config } : n)) };
}

/** Delete a node and everything below it. */
export function deleteNode(graph, id) {
  if (id === 'trigger') return graph;
  const drop = new Set([id, ...descendantIds(graph, id)]);
  return normalizeOrder({ nodes: graph.nodes.filter(n => !drop.has(n.id)) });
}

/** Copy a template's steps (everything under its trigger) into a new micro automation container. */
export function insertMicroAutomation(graph, { parentId, branch = 'next', template }) {
  const { graph: g1, node: group } = insertNode(graph, {
    parentId, branch, type: 'microAutomation',
    config: { templateId: template.id || null, title: template.name },
  });
  const src = template.graph?.nodes || [];
  const idMap = new Map([['trigger', group.id]]);
  src.filter(n => n.id !== 'trigger').forEach(n => idMap.set(n.id, newNodeId()));
  const copied = src.filter(n => n.id !== 'trigger').map(n => ({
    ...n,
    id: idMap.get(n.id),
    parentId: idMap.get(n.parentId),
    // The template's first steps hang off its trigger's `next`; inside the
    // container they hang off the container's `next`.
    branch: n.parentId === 'trigger' ? 'next' : n.branch,
    config: { ...n.config },
  }));
  return { graph: { nodes: [...g1.nodes, ...copied] }, node: group };
}

function normalizeOrder(graph) {
  const byKey = new Map();
  graph.nodes.forEach(n => {
    const k = `${n.parentId}|${n.branch}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(n);
  });
  const order = new Map();
  byKey.forEach(list => list.sort((a, b) => a.order - b.order).forEach((n, i) => order.set(n.id, i)));
  return { nodes: graph.nodes.map(n => ({ ...n, order: order.get(n.id) ?? n.order })) };
}

export function defaultConfig(type) {
  if (type === 'delay') return { amount: 2, unit: 'days' };
  if (type === 'repeat') return { every: 2, unit: 'days', times: 3 };
  if (type === 'preferredChannel') return { channels: ['email', 'none'] };
  if (type === 'generalTask') return { priority: 'Medium', pool: 'Automation Tasks' };
  if (type === 'email' || type === 'reminder' || type === 'education' || type === 'form' || type === 'appointmentLink' || type === 'appInvitation') {
    return { via: 'email' };
  }
  return {};
}

// ── Palette rules ──
// The Figma greys out different actions at different insertion points (79 vs
// 83) without a stated rule. The rule implemented: a Reminder needs a message
// step above it to remind about; Repeat needs a message step above it to
// repeat; care plan actions only follow the care program trigger; everything
// else is allowed anywhere. A slot inside a Micro Automation can't take
// another Micro Automation.
export function allowedAt(graph, slot) {
  if (!slot) return () => true;
  const chain = slot.parentId ? [getNode(graph, slot.parentId), ...ancestorsOf(graph, slot.parentId)].filter(Boolean) : [];
  const hasMessageAbove = chain.some(isMessage);
  const triggerType = getNode(graph, 'trigger')?.type;
  const inGroup = chain.some(n => n.type === 'microAutomation');
  return (type) => {
    const def = nodeDef(type);
    if (!def) return false;
    if (!triggerType) return false;
    if (def.needsMessageAncestor && !hasMessageAbove) return false;
    if (type === 'repeat' && !hasMessageAbove) return false;
    if (def.triggers && !def.triggers.includes(triggerType)) return false;
    if (type === 'microAutomation' && inGroup) return false;
    return true;
  };
}

/** Why a type is unavailable at a slot (palette tooltip), or null. */
export function whyNotAllowed(graph, slot, type) {
  if (allowedAt(graph, slot)(type)) return null;
  const def = nodeDef(type);
  if (!getNode(graph, 'trigger')?.type) return 'Select a trigger first.';
  if (def?.needsMessageAncestor || type === 'repeat') return 'Needs a message step above it.';
  if (def?.triggers) return `Only after “${triggerDef(def.triggers[0])?.label}”.`;
  if (type === 'microAutomation') return 'A micro automation can’t hold another one.';
  return 'Not available here.';
}

// ── Summaries (canvas card text) ──

const q = (s) => `“${s}”`;
export function nodeSummary(node, ctx = {}) {
  const c = node?.config || {};
  const tpl = c.templateId ? (ctx.templateName?.(c.templateId) || c.templateName) : c.templateName;
  switch (node?.type) {
    case 'email': return tpl ? `Send the ${q(tpl)} email template` : null;
    case 'reminder': return tpl ? `Send a reminder using the ${q(tpl)} email template${c.afterLabel ? `, ${c.afterLabel}` : ''}` : null;
    case 'education': return c.contentTitle && tpl ? `Send ${q(c.contentTitle)} education content using the ${q(tpl)} email template` : null;
    case 'form': {
      const forms = (c.formNames || []).filter(Boolean);
      return forms.length && tpl ? `Send ${forms.map(q).join(', ')} using the ${q(tpl)} email template` : null;
    }
    case 'appointmentLink': return tpl ? `Send a booking link for ${c.appointmentType || 'a visit'} using the ${q(tpl)} email template` : null;
    case 'appInvitation': return tpl ? `Invite members not using the app with the ${q(tpl)} email template` : null;
    case 'sms': return c.message ? `Text: ${c.message}` : null;
    case 'push': return c.message ? `Notify: ${c.message}` : null;
    case 'ivr': return c.script ? `Call with script: ${c.script}` : null;
    case 'preferredChannelMessage': return c.message ? `Send on each member’s preferred channel: ${c.message}` : null;
    case 'lab': return c.labTest ? `Order ${c.labTest}` : null;
    case 'generalTask': return c.title ? `Create and assign a task to ${c.assignee?.name || 'an assignee'}: ${c.title}` : null;
    case 'attachCarePlan': return (c.templateNames || []).length
      ? `Attach ${c.templateNames.map(q).join(', ')} in draft; ${c.reviewer?.name || 'the program assignee'} reviews`
      : null;
    case 'setGbiStatus': {
      if (!c.toStatus) return null;
      const picked = new Set(c.kinds || []);
      const kinds = picked.size && picked.size < GBI_KINDS.length
        ? GBI_KINDS.filter(k => picked.has(k.key)).map(k => k.label.toLowerCase()).join(' and ')
        : 'goals, interventions and barriers';
      return `Set open ${kinds} to ${c.toStatus}${c.reason ? `, reason "${c.reason}"` : ''}`;
    }
    case 'delay': return `After ${formatDuration(c.amount, c.unit)}`;
    case 'repeat': return `Every ${formatDuration(c.every, c.unit)}, up to ${c.times} times`;
    case 'microAutomation': return c.title || 'Micro automation';
    case 'and': case 'or': return null;
    case 'preferredChannel': return (c.channels || []).length
      ? summarizeRules({ preferredChannel: { value: c.channels } })
      : null;
    case 'deactivated': return 'When the member is deactivated';
    case 'clinicalCriteria': return (c.criteria || []).length
      ? `${c.match === 'any' ? 'Any of' : 'All of'}: ${c.criteria.map(describeCondition).join('; ')}`
      : null;
    default:
      if (nodeDef(node?.type)?.kind === 'condition') return summarizeRules(c.rules);
      if (node?.id === 'trigger' && node.type === 'careProgramStatusChanged') {
        const to = (c.programStatuses || []).map(programStatusLabel).join(' or ');
        return `${to ? `Moves to ${to}` : 'Pick a status'} · ${c.programCodes?.length ? c.programCodes.join(', ') : 'All programs (account default)'}`;
      }
      if (node?.id === 'trigger' && c.programCodes?.length) return `Programs: ${c.programCodes.join(', ')}`;
      return c.summary || null;
  }
}

// ── Duplicate detection ──
// The Figma's AI card flags "two mail nodes dispatching identical content on
// the same day and time". Implemented: a message step directly followed (no
// Delay between) by another message step of the same kind with the same
// template or text, or two such siblings on the same branch. Runs on every
// edit; each finding names the pair.
const contentKey = (n) => `${n.type === 'reminder' ? 'email' : n.type}|${n.config?.templateId || n.config?.message || n.config?.script || ''}`;
export function findDuplicates(graph) {
  const out = [];
  const seen = new Set();
  const push = (a, b) => {
    const k = [a.id, b.id].sort().join('|');
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ firstId: a.id, secondId: b.id });
  };
  for (const n of graph?.nodes || []) {
    if (!isMessage(n) || !contentKey(n).split('|')[1]) continue;
    const parent = getNode(graph, n.parentId);
    if (parent && isMessage(parent) && contentKey(parent) === contentKey(n)) push(parent, n);
    childrenOf(graph, n.parentId, n.branch)
      .filter(s => s.id !== n.id && isMessage(s) && contentKey(s) === contentKey(n))
      .forEach(s => push(n, s));
  }
  return out;
}

// ── Validation ──

const FIELD_LABEL = {
  templateId: 'Email template', message: 'Message', script: 'Call script', formIds: 'Form',
  contentTitle: 'Education content', labTest: 'Lab test', title: 'Title', description: 'Description',
  assignee: 'Assigned To', priority: 'Priority', templateIds: 'Care plan templates', toStatus: 'Status',
  amount: 'Wait time', unit: 'Unit', every: 'Interval', times: 'Times',
};
const empty = (v) => v == null || v === '' || (Array.isArray(v) && v.length === 0) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);

/** Missing required fields of one node: [{ field, label }]. */
export function nodeProblems(node) {
  if (!node) return [];
  if (node.id === 'trigger') return node.type ? [] : [{ field: 'type', label: 'Trigger' }];
  const def = nodeDef(node.type);
  const req = def?.requires || [];
  const out = req.filter(k => empty(node.config?.[k])).map(k => ({ field: k, label: FIELD_LABEL[k] || k }));
  if (def?.kind === 'condition' && node.type !== 'deactivated' && !Object.values(node.config?.rules || {}).some(r => !empty(r?.value))
    && !(node.type === 'clinicalCriteria' && node.config?.criteria?.length)
    && !(node.type === 'preferredChannel' && node.config?.channels?.length)) {
    out.push({ field: 'rules', label: 'At least one condition' });
  }
  return out;
}

/** Problems across the graph: [{ nodeId, problems }], trigger first. */
export function graphProblems(graph) {
  const out = [];
  for (const n of orderedSteps(graph, { includeLogic: true })) {
    const p = nodeProblems(n);
    if (p.length) out.push({ nodeId: n.id, problems: p });
  }
  if (childrenOf(graph, 'trigger').length === 0 && getNode(graph, 'trigger')?.type) {
    out.push({ nodeId: 'trigger', problems: [{ field: 'steps', label: 'At least one step after the trigger' }] });
  }
  return out;
}

// ── Test run order ──
// Depth-first, left to right, every branch: the Figma's test walks each
// outcome in turn (steps 1–11). Logic connectors (AND / OR) and the micro
// automation container are not steps; Delay is shown and auto-skipped.
export function orderedSteps(graph, { includeLogic = false } = {}) {
  const out = [];
  const root = getNode(graph, 'trigger');
  if (!root) return out;
  const visit = (node) => {
    const isStep = node.type !== 'microAutomation' && (includeLogic || (node.type !== 'and' && node.type !== 'or'));
    if (isStep) out.push(node);
    for (const b of branchesOf(node).length ? branchesOf(node) : [{ key: 'next' }]) {
      childrenOf(graph, node.id, b.key).forEach(visit);
    }
  };
  visit(root);
  return out;
}

// ── Layout ──
// A tidy top-down tree with fixed card sizes (card text clamps to two lines,
// as in the Figma), so positions are deterministic and need no DOM measuring.
// Sizes from the Figma canvas (frames 64 and 145): cards are 250 wide; a card
// with a two-line summary is 70 tall, the trigger 56; outcome chips sit in a
// row 8px under their card; rows are 50px apart.
export const SIZES = {
  start: { w: 120, h: 40 },
  trigger: { w: 250, h: 56 },
  card: { w: 250, h: 70 },
  pill: { w: 150, h: 30 },
  chip: { w: 121, h: 30 },
  group: { w: 250, h: 20 },
  slot: { w: 250, h: 56 },
};
const GAP_X = 50;
const GAP_Y = 50;
const CHIP_GAP = 8;
const GROUP_PAD = 12;
const GROUP_HEAD = 28;

export const sizeOf = (node) => {
  if (!node) return SIZES.card;
  if (node.id === 'trigger') return SIZES.trigger;
  if (['delay', 'repeat', 'and', 'or'].includes(node.type)) return SIZES.pill;
  if (node.type === 'microAutomation') return SIZES.group;
  return SIZES.card;
};

export const OUTCOME_FOOTER_H = 32;
export const HELPER_FOOTER_H = 44;
export const STAT_BLOCK_W = 96;

const chipWidth = (n) => (n <= 2 ? 121 : 130);

/**
 * Positions for every visible element:
 *   items: [{ id, kind: 'start'|'node'|'chip'|'slot'|'groupBox', x, y, w, h, … }]
 *   edges: [{ id, source, target, dashed }]
 * `slots` adds drop targets on open branches (edit mode, while dragging): true
 * for all, or a (parentId) => boolean filter.
 * `collapsed` is a Set of node ids whose outcome branches are folded.
 */
export function layoutGraph(graph, { slots = false, collapsed = new Set(), statBlock = false } = {}) {
  const items = [];
  const edges = [];
  const root = getNode(graph, 'trigger');
  if (!root) return { items, edges, width: 0, height: 0 };
  // Before a trigger is chosen only "Starts here" shows, with a loose end.
  if (!root.type) {
    items.push({ id: 'start', kind: 'start', x: 0, y: 0, w: SIZES.start.w, h: SIZES.start.h, dangling: true });
    return { items, edges, width: SIZES.start.w, height: SIZES.start.h + 24 };
  }

  const wantSlots = typeof slots === 'function' ? slots : () => !!slots;

  // Build a render tree: node → chips (outcomes) → children, or node → children.
  const build = (node) => {
    const size = sizeOf(node);
    const isCard = size === SIZES.card || size === SIZES.trigger;
    const t = { id: node.id, kind: 'node', node, w: size.w + (statBlock && isCard ? STAT_BLOCK_W : 0), h: size.h, kids: [] };
    if (node.type === 'repeat') return t;
    const branches = branchesOf(node);
    const hasOutcomes = branches.length && branches[0].key !== 'next';
    // Conditions that filter (no outcome split) carry the Figma's helper line.
    if (nodeDef(node.type)?.kind === 'condition' && !hasOutcomes) { t.h += HELPER_FOOTER_H; t.helper = true; }
    if (hasOutcomes) {
      const folded = collapsed.has(node.id);
      t.outcomeCount = branches.length;
      t.h += OUTCOME_FOOTER_H;
      t.folded = folded;
      if (!folded) {
        t.chipW = chipWidth(branches.length);
        branches.forEach(b => {
          const chip = { id: `${node.id}::${b.key}`, kind: 'chip', parentId: node.id, branch: b, w: t.chipW, h: SIZES.chip.h, kids: [] };
          childrenOf(graph, node.id, b.key).forEach(c => chip.kids.push(build(c)));
          if (wantSlots(node.id)) chip.kids.push(slotFor(node.id, b.key, chip.kids.length));
          t.kids.push(chip);
        });
      }
    } else if (branches.length || node.id === 'trigger') {
      childrenOf(graph, node.id, 'next').forEach(c => t.kids.push(build(c)));
      // A plain node takes one continuation; a container (micro automation)
      // or a condition can hold parallel children.
      const canAdd = node.type === 'microAutomation' || nodeDef(node.type)?.kind === 'condition' || node.id === 'trigger' || ['and', 'or'].includes(node.type)
        || t.kids.length === 0;
      if (wantSlots(node.id) && node.type && canAdd) t.kids.push(slotFor(node.id, 'next', t.kids.length));
    }
    if (node.type === 'microAutomation') t.group = true;
    return t;
  };
  const slotFor = (parentId, branch, index) => ({ id: `slot::${parentId}::${branch}::${index}`, kind: 'slot', parentId, branch, w: SIZES.slot.w, h: SIZES.slot.h, kids: [] });

  const rowWidth = (list, gap) => list.reduce((s, k) => s + k.span, 0) + Math.max(0, list.length - 1) * gap;

  // Pass 1: subtree widths. A chip's span is its column (its own width or its
  // subtree's); a node with chips also needs room for the chip row itself.
  const measure = (t) => {
    t.kids.forEach(measure);
    const kidsW = rowWidth(t.kids, GAP_X);
    const chipRow = t.chipW ? t.kids.length * t.chipW + (t.kids.length - 1) * CHIP_GAP : 0;
    t.span = Math.max(t.w, kidsW, chipRow) + (t.group ? GROUP_PAD * 2 : 0);
  };
  const tree = build(root);
  measure(tree);

  // Pass 2: positions (left = left edge of the subtree span).
  const place = (t, left, top, parentItemId, dashed = false) => {
    const pad = t.group ? GROUP_PAD : 0;
    const x = left + (t.span - t.w) / 2;
    const item = { id: t.id, kind: t.kind, x, y: top, w: t.w, h: t.h, node: t.node, parentId: t.parentId, branch: t.branch, outcomeCount: t.outcomeCount, folded: t.folded, helper: t.helper };
    if (t.group) Object.assign(item, { x: left + pad, y: top + 8, w: t.span - pad * 2 });
    items.push(item);
    if (parentItemId) edges.push({ id: `e:${parentItemId}->${t.id}`, source: parentItemId, target: t.id, dashed: dashed || t.kind === 'slot' });
    const startIdx = items.length;
    const kidsW = rowWidth(t.kids, GAP_X);
    let cursor = left + pad + (t.span - pad * 2 - kidsW) / 2;

    if (t.chipW) {
      // Chips in a row right under the card; each chip's subtree hangs in its
      // own column below, joined by an elbow connector.
      const rowW = t.kids.length * t.chipW + (t.kids.length - 1) * CHIP_GAP;
      const chipTop = top + t.h + CHIP_GAP;
      let chipX = x + t.w / 2 - rowW / 2;
      const childTop = chipTop + SIZES.chip.h + GAP_Y;
      t.kids.forEach(chip => {
        items.push({ id: chip.id, kind: 'chip', x: chipX, y: chipTop, w: t.chipW, h: SIZES.chip.h, parentId: chip.parentId, branch: chip.branch });
        const colW = rowWidth(chip.kids, GAP_X);
        let c = cursor + (chip.span - colW) / 2;
        chip.kids.forEach(k => {
          place(k, c, childTop, chip.id);
          c += k.span + GAP_X;
        });
        cursor += chip.span + GAP_X;
        chipX += t.chipW + CHIP_GAP;
      });
    } else {
      const nextTop = (t.group ? top + GROUP_HEAD : top + t.h) + GAP_Y * (t.group ? 0.5 : 1);
      t.kids.forEach(k => {
        place(k, cursor, nextTop, t.group ? null : t.id, t.node?.type === 'delay');
        cursor += k.span + GAP_X;
      });
      // Inside a micro automation the first steps hang off the container's top.
      if (t.group) t.kids.forEach(k => edges.push({ id: `e:${t.id}->${k.id}`, source: t.id, target: k.id }));
    }
    if (t.group) {
      // The container box wraps the label and every step inside it.
      const inside = items.slice(startIdx);
      const bottom = Math.max(top + GROUP_HEAD, ...inside.map(i => i.y + i.h));
      items.push({ id: `${t.id}::box`, kind: 'groupBox', x: left, y: top, w: t.span, h: bottom - top + GROUP_PAD, node: t.node });
    }
  };
  items.push({ id: 'start', kind: 'start', x: (tree.span - SIZES.start.w) / 2, y: 0, w: SIZES.start.w, h: SIZES.start.h });
  place(tree, 0, SIZES.start.h + GAP_Y, 'start');

  // Repeat loops back (dashed) to the message it repeats.
  for (const it of items) {
    if (it.kind !== 'node' || it.node?.type !== 'repeat') continue;
    const target = ancestorsOf(graph, it.id).find(isMessage);
    if (target) edges.push({ id: `loop:${it.id}`, source: it.id, target: target.id, dashed: true, loop: true });
  }
  const width = tree.span;
  const height = Math.max(...items.map(i => i.y + i.h));
  return { items, edges, width, height };
}

/** Members a node would see, for the delete warning. Null when unknown. */
export function memberCountAt(stats, id) {
  return stats?.[id]?.members ?? null;
}

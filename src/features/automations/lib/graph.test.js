import { describe, expect, it } from 'vitest';
import {
  allowedAt, branchesOf, childrenOf, deleteNode, emptyGraph, findDuplicates, getNode, graphProblems,
  insertBetween, insertMicroAutomation, insertNode, layoutGraph, nodeProblems, nodeSummary, orderedSteps,
  pruneBranches, setTrigger, updateNodeConfig,
} from './graph';

const base = () => {
  let g = setTrigger(emptyGraph(), 'patientRegistered');
  const c = insertNode(g, { parentId: 'trigger', type: 'matchingConditions', config: { rules: { tags: { op: 'are', value: ['High Risk'] } } } });
  g = c.graph;
  const e = insertNode(g, { parentId: c.node.id, type: 'email', config: { templateId: 't1', templateName: 'Welcome' } });
  return { g: e.graph, condId: c.node.id, emailId: e.node.id };
};

describe('graph structure', () => {
  it('gives message actions their outcome branches and plain steps a single next', () => {
    const { g, emailId, condId } = base();
    expect(branchesOf(getNode(g, emailId)).map(b => b.key)).toEqual(['opened', 'notOpened']);
    expect(branchesOf(getNode(g, condId)).map(b => b.key)).toEqual(['next']);
  });

  it('branches a preferred-mode condition by the channels picked, and drops children of removed channels', () => {
    let g = setTrigger(emptyGraph(), 'contactAddedOrUpdated');
    const c = insertNode(g, { parentId: 'trigger', type: 'preferredChannel' });
    g = c.graph;
    expect(branchesOf(getNode(g, c.node.id)).map(b => b.key)).toEqual(['email', 'none']);
    g = insertNode(g, { parentId: c.node.id, branch: 'none', type: 'generalTask' }).graph;
    g = pruneBranches(updateNodeConfig(g, c.node.id, { channels: ['email'] }), c.node.id);
    expect(childrenOf(g, c.node.id, 'none')).toHaveLength(0);
  });

  it('deletes a node with its whole subtree', () => {
    const { g, condId } = base();
    const out = deleteNode(g, condId);
    expect(out.nodes.map(n => n.id)).toEqual(['trigger']);
  });

  it('inserts a delay between two steps, keeping the lower step under it', () => {
    const { g, emailId, condId } = base();
    const { graph, node } = insertBetween(g, emailId, 'delay');
    expect(getNode(graph, node.id).parentId).toBe(condId);
    expect(getNode(graph, emailId).parentId).toBe(node.id);
  });

  it('copies a template into a micro automation container', () => {
    const { g, condId } = base();
    const template = { id: 'tpl', name: 'Wearable', graph: { nodes: [
      { id: 'trigger', type: 'contactAddedOrUpdated', parentId: null, branch: null, order: 0, config: {} },
      { id: 'a', type: 'education', parentId: 'trigger', branch: 'next', order: 0, config: { templateId: 'x', contentTitle: 'Guide' } },
      { id: 'b', type: 'generalTask', parentId: 'a', branch: 'opened', order: 0, config: {} },
    ] } };
    const { graph, node } = insertMicroAutomation(g, { parentId: condId, template });
    const inside = childrenOf(graph, node.id, 'next');
    expect(inside.map(n => n.type)).toEqual(['education']);
    expect(childrenOf(graph, inside[0].id, 'opened').map(n => n.type)).toEqual(['generalTask']);
  });
});

describe('palette rules', () => {
  it('needs a message above a reminder or repeat', () => {
    const { g, condId, emailId } = base();
    expect(allowedAt(g, { parentId: condId, branch: 'next' })('reminder')).toBe(false);
    expect(allowedAt(g, { parentId: emailId, branch: 'notOpened' })('reminder')).toBe(true);
    expect(allowedAt(g, { parentId: emailId, branch: 'notOpened' })('repeat')).toBe(true);
  });
  it('offers nothing before a trigger is chosen', () => {
    expect(allowedAt(emptyGraph(), { parentId: 'trigger', branch: 'next' })('email')).toBe(false);
  });
});

describe('duplicate actions', () => {
  it('flags the same email sent twice in a row and clears once a delay sits between', () => {
    const { g, emailId } = base();
    const again = insertNode(g, { parentId: emailId, branch: 'notOpened', type: 'reminder', config: { templateId: 't1' } });
    expect(findDuplicates(again.graph)).toEqual([{ firstId: emailId, secondId: again.node.id }]);
    const fixed = insertBetween(again.graph, again.node.id, 'delay').graph;
    expect(findDuplicates(fixed)).toEqual([]);
  });
});

describe('validation and test order', () => {
  it('names the empty required fields', () => {
    const t = { id: 'x', type: 'generalTask', config: { title: 'Call', priority: 'High' } };
    expect(nodeProblems(t).map(p => p.label)).toEqual(['Description', 'Assigned To']);
  });
  it('requires a step after the trigger', () => {
    expect(graphProblems(setTrigger(emptyGraph(), 'patientRegistered'))[0].problems[0].field).toBe('steps');
  });
  it('walks every branch depth-first and leaves out logic connectors', () => {
    const { g, emailId } = base();
    const a = insertNode(g, { parentId: emailId, branch: 'opened', type: 'generalTask' });
    const b = insertNode(a.graph, { parentId: emailId, branch: 'notOpened', type: 'delay' });
    expect(orderedSteps(b.graph).map(n => n.type)).toEqual(['patientRegistered', 'matchingConditions', 'email', 'generalTask', 'delay']);
  });
});

describe('summaries', () => {
  it('builds the condition sentence from its rows', () => {
    const node = { type: 'matchingConditions', config: { rules: {
      contactType: { op: 'is', value: 'Patient' },
      membership: { op: 'is', value: 'Active member' },
      tags: { op: 'are', value: ['High Risk', 'Hypertensive'] },
    } } };
    expect(nodeSummary(node)).toBe('When the contact type is patient, with an active membership and tagged High Risk and Hypertensive');
  });
});

describe('layout', () => {
  it('never overlaps two cards on the same row', () => {
    const { g, emailId } = base();
    let graph = g;
    for (const b of ['opened', 'notOpened']) graph = insertNode(graph, { parentId: emailId, branch: b, type: 'generalTask' }).graph;
    const { items } = layoutGraph(graph, { slots: true });
    const solid = items.filter(i => i.kind !== 'groupBox');
    for (const a of solid) {
      for (const b of solid) {
        if (a === b || a.y !== b.y) continue;
        expect(a.x + a.w <= b.x || b.x + b.w <= a.x).toBe(true);
      }
    }
  });
});

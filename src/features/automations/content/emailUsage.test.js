import { describe, it, expect } from 'vitest';
import { automationsUsingEmail, templatesUsingEmail, usageMessage, activeCount } from './emailUsage';

const graph = (...ids) => ({ nodes: [{ id: 'trigger', type: 'contactAdded', config: {} }, ...ids.map((t, i) => ({ id: `n${i}`, type: 'email', config: { templateId: t } }))] });
const automations = [
  { id: 'a1', status: 'active', graph: graph('e1') },
  { id: 'a2', status: 'inactive', graph: graph('e2'), draftGraph: graph('e1') },
  { id: 'a3', status: 'draft', graph: graph(42) },
  { id: 'a4', status: 'active', graph: { nodes: [] } },
  { id: 'a5', status: 'active', graph: null },
];

describe('automationsUsingEmail', () => {
  it('matches the published graph and the draft graph', () => {
    expect(automationsUsingEmail(automations, 'e1').map(a => a.id)).toEqual(['a1', 'a2']);
  });
  it('compares ids as strings', () => {
    expect(automationsUsingEmail(automations, '42').map(a => a.id)).toEqual(['a3']);
    expect(automationsUsingEmail(automations, 42).map(a => a.id)).toEqual(['a3']);
  });
  it('accepts several ids for a bulk delete', () => {
    expect(automationsUsingEmail(automations, ['e2', '42']).map(a => a.id)).toEqual(['a2', 'a3']);
  });
  it('returns nothing for an unused or missing id', () => {
    expect(automationsUsingEmail(automations, 'zzz')).toEqual([]);
    expect(automationsUsingEmail(automations, null)).toEqual([]);
    expect(automationsUsingEmail(null, 'e1')).toEqual([]);
  });
});

describe('templatesUsingEmail', () => {
  it('matches template graphs', () => {
    const templates = [{ id: 't1', graph: graph('e1') }, { id: 't2', graph: graph('e2') }];
    expect(templatesUsingEmail(templates, 'e1').map(t => t.id)).toEqual(['t1']);
  });
});

describe('usageMessage', () => {
  it('counts automations and active ones', () => {
    const used = automationsUsingEmail(automations, 'e1');
    expect(activeCount(used)).toBe(1);
    expect(usageMessage(used)).toBe('Deleting this email affects 2 automations, 1 of them active. Steps that send it will stop working until you pick another email.');
  });
  it('handles a single automation and several emails', () => {
    expect(usageMessage([automations[0]])).toMatch(/affects 1 automation, and it is active\./);
    expect(usageMessage([automations[0]], 2)).toMatch(/^Deleting these emails .* Steps that send them/);
  });
});

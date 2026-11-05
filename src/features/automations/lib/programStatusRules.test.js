import { describe, expect, it } from 'vitest';
import { gbiRestorations, gbiTransitions, isHoldProgramStatus, programStatusRulesOf, programStatusTriggerOf, rulesForProgramStatus } from './programStatusRules';

const automation = (id, { programCodes = [], on = ['utr'], toStatus = 'UTR', reason = 'Program UTR', kinds, status = 'active', updatedAt = '2026-10-01' } = {}) => ({
  id, name: id, status, updatedAt,
  graph: { nodes: [
    { id: 'trigger', type: 'careProgramStatusChanged', parentId: null, config: { programCodes, programStatuses: on } },
    { id: 'set', type: 'setGbiStatus', parentId: 'trigger', branch: 'next', config: { toStatus, reason, ...(kinds ? { kinds } : {}) } },
  ] },
});

describe('program status rules', () => {
  it('maps program statuses to the four triggers', () => {
    expect(programStatusTriggerOf('Unable to Reach')).toBe('utr');
    expect(programStatusTriggerOf('Discontinued')).toBe('closed');
    expect(programStatusTriggerOf('Closed')).toBe('closed');
    expect(programStatusTriggerOf('Active')).toBeNull();
  });

  it('reads only active automations of this trigger, defaulting to every GBI kind', () => {
    const rules = programStatusRulesOf([automation('a'), automation('b', { status: 'draft' })]);
    expect(rules.map(r => [r.id, r.kinds])).toEqual([['a', ['goal', 'intervention', 'barrier']]]);
  });

  it('a program type override replaces the account default', () => {
    const rules = programStatusRulesOf([
      automation('default'),
      automation('snp', { programCodes: ['SNP'], toStatus: 'On Hold', reason: 'SNP outreach continues' }),
      automation('paused', { on: ['paused'], toStatus: 'On Hold', reason: 'Program paused' }),
    ]);
    expect(rulesForProgramStatus(rules, 'SNP', 'Unable to Reach').map(r => r.id)).toEqual(['snp']);
    expect(rulesForProgramStatus(rules, 'CCM', 'Unable to Reach').map(r => r.id)).toEqual(['default']);
    expect(rulesForProgramStatus(rules, 'CCM', 'Paused').map(r => r.id)).toEqual(['paused']);
    expect(rulesForProgramStatus(rules, 'CCM', 'Active')).toEqual([]);
  });

  it('moves open items only, with the reason; closed outcomes are kept', () => {
    const [rule] = programStatusRulesOf([automation('default')]);
    const out = gbiTransitions({
      goal: [{ id: 'g1', title: 'A1c', status: 'In Progress' }, { id: 'g2', title: 'BP', status: 'Met' }, { id: 'g3', title: 'Weight', status: 'UTR' }],
      intervention: [{ id: 'i1', title: 'Call', status: 'Not Started' }, { id: 'i2', title: 'Refill', status: 'Discontinued' }],
      barrier: [{ id: 'b1', title: 'Transport', status: 'On Hold' }, { id: 'b2', title: 'Cost', status: 'Resolved' }],
    }, [rule]);
    expect(out.map(t => [t.kind, t.id, t.from, t.to, t.reason])).toEqual([
      ['goal', 'g1', 'In Progress', 'UTR', 'Program UTR'],
      ['intervention', 'i1', 'Not Started', 'UTR', 'Program UTR'],
      ['barrier', 'b1', 'On Hold', 'UTR', 'Program UTR'],
    ]);
  });

  it('limits to the chosen kinds', () => {
    const [rule] = programStatusRulesOf([automation('x', { kinds: ['intervention'] })]);
    expect(gbiTransitions({ goal: [{ id: 'g', status: 'In Progress' }], intervention: [{ id: 'i', status: 'In Progress' }] }, [rule]).map(t => t.id)).toEqual(['i']);
  });

  it('UTR and Paused are holds; Completed and Closed are not', () => {
    expect(['Unable to Reach', 'Paused'].map(isHoldProgramStatus)).toEqual([true, true]);
    expect(['Completed', 'Discontinued', 'Active', undefined].map(isHoldProgramStatus)).toEqual([false, false, false, false]);
  });

  it('a hold remembers the status and reason from before the first hold', () => {
    const [utr] = programStatusRulesOf([automation('utr')]);
    const [paused] = programStatusRulesOf([automation('p', { on: ['paused'], toStatus: 'On Hold', reason: 'Program paused' })]);
    const [first] = gbiTransitions({ goal: [{ id: 'g', status: 'In Progress', statusReason: 'Titrating' }] }, [utr], { hold: true });
    expect(first.hold).toEqual({ from: 'In Progress', reason: 'Titrating', to: 'UTR' });
    // Unable to Reach, then Paused: still returns to In Progress.
    const [second] = gbiTransitions({ goal: [{ id: 'g', status: 'UTR', statusHold: first.hold }] }, [paused], { hold: true });
    expect(second.hold).toEqual({ from: 'In Progress', reason: 'Titrating', to: 'On Hold' });
    // Final statuses store no hold.
    expect(gbiTransitions({ goal: [{ id: 'g', status: 'In Progress' }] }, [utr])[0].hold).toBeNull();
  });

  it('coming back restores held items still at the hold status; hand-edited ones keep their status', () => {
    const hold = { from: 'In Progress', reason: null, to: 'UTR' };
    const out = gbiRestorations({
      goal: [{ id: 'g1', title: 'A1c', status: 'UTR', statusHold: hold }, { id: 'g2', status: 'Met', statusHold: hold }],
      intervention: [{ id: 'i1', status: 'UTR', statusHold: { from: 'Not Started', reason: 'Awaiting labs', to: 'UTR' } }],
      barrier: [{ id: 'b1', status: 'UTR' }],
    });
    expect(out.restore.map(t => [t.kind, t.id, t.from, t.to, t.reason])).toEqual([
      ['goal', 'g1', 'UTR', 'In Progress', null],
      ['intervention', 'i1', 'UTR', 'Not Started', 'Awaiting labs'],
    ]);
    expect(out.clear).toEqual([{ kind: 'goal', id: 'g2' }]);
  });
});

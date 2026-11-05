import { describe, expect, it } from 'vitest';
import {
  applyOverlay, blockedSignoffs, itemKey, matchIpa, overlaySummary, signoffAllows, signoffLabel, unmatchedIpaValues,
} from './ipaOverlays';

const ipas = [
  { id: 'a', name: 'Astrana', aliases: ['Astrana IPA', 'Astrana Health'] },
  { id: 'c', name: 'CFC', aliases: [] },
  { id: 'x', name: 'Retired IPA', aliases: [], active: false },
];

const content = {
  name: 'Diabetes Management',
  goals: [{ id: 'g1', title: 'Lower HbA1c', priority: 'medium' }, { id: 'g2', title: 'Walk daily', priority: 'low' }],
  interventions: [{ id: 'i1', title: 'Repeat HbA1c', kind: 'internal-task', config: { priority: 'medium' } }],
  barriers: [{ id: 'b1', title: 'Cost of strips', priority: 'medium' }],
};

describe('IPA registry', () => {
  it('matches a recorded IPA by name or alias, ignoring case and inactive IPAs', () => {
    expect(matchIpa('astrana health', ipas).id).toBe('a');
    expect(matchIpa(' CFC ', ipas).id).toBe('c');
    expect(matchIpa('Retired IPA', ipas)).toBeNull();
    expect(matchIpa('', ipas)).toBeNull();
  });

  it('lists recorded values no IPA covers', () => {
    expect(unmatchedIpaValues([{ value: 'Astrana', n: 40 }, { value: 'Unknown IPA', n: 24 }, { value: 'IPA-West', n: 30 }], ipas))
      .toEqual([{ value: 'IPA-West', n: 30 }, { value: 'Unknown IPA', n: 24 }]);
  });
});

describe('overlays', () => {
  const overrides = {
    items: {
      [itemKey('goal', 'walk daily')]: { hidden: true },
      [itemKey('goal', 'Lower HbA1c')]: { priority: 'high', frequency: 'Weekly', patientTitle: 'Bring your sugar down' },
      [itemKey('intervention', 'Repeat HbA1c')]: { priority: 'high' },
      [itemKey('barrier', 'Gone from template')]: { priority: 'high' },
    },
    additions: { goals: [{ id: 'g9', title: 'Foot check every visit', priority: 'medium' }], interventions: [], barriers: [] },
    signoff: { mode: 'roles', roles: ['Physician/Doctor'] },
  };

  it('applies on top of the template', () => {
    const out = applyOverlay(content, overrides);
    expect(out.goals.map(g => g.title)).toEqual(['Lower HbA1c', 'Foot check every visit']);
    expect(out.goals[0]).toMatchObject({ priority: 'high', frequency: 'Weekly', overlay: { priority: 'high', frequency: 'Weekly', patientTitle: 'Bring your sugar down' } });
    expect(out.goals[1].local).toBe(true);
    expect(out.interventions[0].config.priority).toBe('high');
    expect(out.barriers[0]).toEqual(content.barriers[0]);
  });

  it('summarizes what it changes and flags overrides for items the template dropped', () => {
    expect(overlaySummary(content, overrides)).toEqual({
      hidden: 1, changed: 2, added: 1, orphaned: ['barrier:gone from template'], signoff: 'Physician/Doctor',
    });
  });
});

describe('sign-off routes', () => {
  const doc = { id: 'u1', name: 'Dr. Kim', clinicalRoles: ['Physician/Doctor'] };
  const nurse = { id: 'u2', name: 'Pat Lee', clinicalRoles: ['Nurse'], adminRole: null };

  it('lets anyone sign without a route', () => {
    expect(signoffLabel({ mode: 'default' })).toBeNull();
    expect(signoffAllows({ mode: 'default' }, nurse)).toBe(true);
    expect(signoffAllows({ mode: 'roles', roles: [] }, nurse)).toBe(true);
  });

  it('checks roles and people', () => {
    const byRole = { mode: 'roles', roles: ['physician/doctor'] };
    expect([signoffAllows(byRole, doc), signoffAllows(byRole, nurse)]).toEqual([true, false]);
    const byPerson = { mode: 'people', people: [{ id: 'u2', name: 'Pat Lee' }] };
    expect([signoffAllows(byPerson, doc), signoffAllows(byPerson, nurse)]).toEqual([false, true]);
    expect(signoffLabel(byPerson)).toBe('Pat Lee');
  });

  it('names the routes a signer fails on a plan', () => {
    const runs = [
      { status: 'active', templateName: 'Diabetes Management', signoffRoute: { mode: 'roles', roles: ['Physician/Doctor'], ipaName: 'Astrana' } },
      { status: 'closed', templateName: 'Old', signoffRoute: { mode: 'roles', roles: ['QA'] } },
      { status: 'active', templateName: 'COPD', signoffRoute: null },
    ];
    expect(blockedSignoffs(runs, nurse)).toEqual([{ templateName: 'Diabetes Management', ipaName: 'Astrana', label: 'Physician/Doctor' }]);
    expect(blockedSignoffs(runs, doc)).toEqual([]);
  });
});

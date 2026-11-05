import { describe, expect, it } from 'vitest';
import { activeTemplateFor, formatRetireDate, isRetired, replacementFor, replacementOptions, retirementToday, retiringOn, templatesReplacedBy } from './templateRetirement';

const t = (id, status = 'published', replacedByTemplateId = null) => ({ id, name: id, status, replacedByTemplateId });

describe('replacementFor', () => {
  it('is the replacement when it is in use', () => {
    const all = [t('v1', 'archived', 'v2'), t('v2')];
    expect(replacementFor(all[0], all).id).toBe('v2');
  });

  it('follows a chain of retirements to the first one in use', () => {
    const all = [t('v1', 'archived', 'v2'), t('v2', 'archived', 'v3'), t('v3')];
    expect(replacementFor(all[0], all).id).toBe('v3');
  });

  it('is null with no replacement, a draft, a dead end or a loop', () => {
    expect(replacementFor(t('v1', 'archived'), [t('v1', 'archived')])).toBeNull();
    expect(replacementFor(t('v1', 'archived', 'd'), [t('d', 'draft')])).toBeNull();
    expect(replacementFor(t('v1', 'archived', 'v2'), [t('v2', 'archived')])).toBeNull();
    const loop = [t('a', 'archived', 'b'), t('b', 'archived', 'a')];
    expect(replacementFor(loop[0], loop)).toBeNull();
  });
});

describe('activeTemplateFor', () => {
  const all = [t('v1', 'archived', 'v2'), t('v2'), t('old', 'archived')];

  it('keeps a template in use, swaps a retired one for its replacement, drops one with none', () => {
    expect(activeTemplateFor('v2', all)).toEqual({ id: 'v2', replaced: null });
    expect(activeTemplateFor('v1', all)).toMatchObject({ id: 'v2', replaced: { id: 'v1' } });
    expect(activeTemplateFor('old', all)).toMatchObject({ id: null, replaced: { id: 'old' } });
    expect(activeTemplateFor('missing', all)).toEqual({ id: null, replaced: null });
  });
});

describe('replacementOptions and isRetired', () => {
  it('offers published templates other than itself', () => {
    const all = [t('v1'), t('v2'), t('d', 'draft'), t('r', 'archived')];
    expect(replacementOptions(all[0], all).map(x => x.id)).toEqual(['v2']);
    expect(isRetired(all[3])).toBe(true);
    expect(isRetired(all[0])).toBe(false);
  });
});

describe('scheduled retirement', () => {
  it('is retiring only while still in use', () => {
    expect(retiringOn({ ...t('v1'), retireOn: '2026-12-01' })).toBe('2026-12-01');
    expect(retiringOn({ ...t('v1', 'archived'), retireOn: '2026-12-01' })).toBeNull();
    expect(retiringOn(t('v1'))).toBeNull();
  });

  it('lists the retired and retiring templates a replacement stands in for', () => {
    const all = [t('v1', 'archived', 'v3'), { ...t('v2', 'published', 'v3'), retireOn: '2026-12-01' }, t('v4', 'published', 'v3'), t('v3')];
    expect(templatesReplacedBy(all[3], all).map(x => x.id)).toEqual(['v1', 'v2']);
  });

  it('takes the day in Los Angeles', () => {
    expect(retirementToday(new Date('2026-11-03T06:00:00Z'))).toBe('2026-11-02');
    expect(retirementToday(new Date('2026-11-03T09:00:00Z'))).toBe('2026-11-03');
    expect(formatRetireDate('2026-12-01')).toBe('12/01/2026');
  });
});

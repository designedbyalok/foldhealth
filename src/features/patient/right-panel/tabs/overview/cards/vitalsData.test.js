import { describe, expect, it } from 'vitest';
import { shownVitals, vitalCatalog } from './vitalsData';

const overview = { vitals: [{ key: 'bp', label: 'Blood Pressure', value: '142/88' }, { key: 'a1c', label: 'HbA1c', value: '8.2' }] };

describe('vitalCatalog', () => {
  it('adds recorded vitals and biomarkers after the overview vitals, without repeats', () => {
    const history = { hr: [{ vital_key: 'hr', value: '80', recorded_on: '2026-10-01' }, { vital_key: 'hr', value: '72', recorded_on: '2026-09-01', flag: true }] };
    const keys = vitalCatalog(overview, 'x', history).map(t => t.key);
    expect(keys.slice(0, 3)).toEqual(['bp', 'a1c', 'hr']);
    expect(keys).not.toContain('hba1c');
    expect(keys).toContain('ldl');
  });

  it('reads the latest reading, its change and date, and sets no goal', () => {
    const history = { hr: [{ vital_key: 'hr', value: '80', recorded_on: '2026-10-01' }, { vital_key: 'hr', value: '72', recorded_on: '2026-09-01' }] };
    const hr = vitalCatalog(overview, 'x', history).find(t => t.key === 'hr');
    expect(hr).toMatchObject({ value: '80', change: '8', direction: 'up', measuredAt: '10/01/2026', series: [72, 80] });
    expect(hr.goalTo).toBeUndefined();
  });
});

describe('shownVitals', () => {
  const catalog = vitalCatalog(overview, 'x', {});
  it('uses the overview vitals until the team saves a choice', () => {
    expect(shownVitals(catalog, overview, null).map(t => t.key)).toEqual(['bp', 'a1c']);
  });
  it('follows the saved order and skips unknown keys', () => {
    expect(shownVitals(catalog, overview, ['ldl', 'nope', 'bp']).map(t => t.key)).toEqual(['ldl', 'bp']);
  });
});

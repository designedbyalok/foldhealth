import { describe, expect, it } from 'vitest';
import { medHighlights } from './medHighlights';

const now = new Date(2026, 9, 26, 12).getTime();
const med = (over) => ({ id: over.name, status: 'Active', ...over });

describe('medHighlights', () => {
  it('flags refills, new starts and recent stops, changes first', () => {
    const { rows, counts } = medHighlights([
      med({ name: 'Steady', start: '2024-01-01' }),
      med({ name: 'New', start: '2026-10-01' }),
      med({ name: 'Due', start: '2025-01-01', lastFilledOn: '2026-09-28', daysSupply: 30 }),
      med({ name: 'Out', start: '2025-01-01', lastFilledOn: '2026-09-01', daysSupply: 30 }),
      med({ name: 'Stopped', status: 'Stopped', stop: '2026-09-22' }),
      med({ name: 'Old stop', status: 'Stopped', stop: '2025-01-01' }),
    ], now);
    expect(rows.map(r => [r.med.name, r.change])).toEqual([
      ['Out', 'out'], ['Due', 'refill'], ['New', 'new'], ['Stopped', 'stopped'], ['Steady', null],
    ]);
    expect(counts).toEqual({ out: 1, refill: 1, new: 1, stopped: 1 });
  });

  it('never flags a refill without a fill date and a supply', () => {
    const { rows } = medHighlights([med({ name: 'A', start: '2024-01-01', daysSupply: 30 }), med({ name: 'B', start: '2024-01-01', lastFilledOn: '2026-01-01' })], now);
    expect(rows.map(r => r.change)).toEqual([null, null]);
  });

  it('reads MM/DD/YYYY start dates too', () => {
    expect(medHighlights([med({ name: 'A', start: '10/20/2026' })], now).rows[0].change).toBe('new');
  });
});

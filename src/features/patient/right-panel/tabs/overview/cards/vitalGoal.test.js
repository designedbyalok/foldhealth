import { describe, expect, it } from 'vitest';
import { goalTarget } from './vitalGoal';

describe('goalTarget', () => {
  it('reads the leading number of a goal', () => {
    expect(goalTarget('120/80')).toBe(120);
    expect(goalTarget('7%')).toBe(7);
    expect(goalTarget('< 6.5 %')).toBe(6.5);
    expect(goalTarget('140 mg/dL')).toBe(140);
  });

  it('is null without a number', () => {
    expect(goalTarget('')).toBeNull();
    expect(goalTarget(undefined)).toBeNull();
    expect(goalTarget('Stable')).toBeNull();
  });
});

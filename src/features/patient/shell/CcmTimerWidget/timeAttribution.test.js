import { describe, expect, it } from 'vitest';
import { loggedSecondsFor, progressLabel, targetMinutesFor, timeProgramsFor } from './timeAttribution';

describe('program time attribution', () => {
  it('lists the open time-billed programs, CCM first, and falls back to CCM', () => {
    expect(timeProgramsFor([{ code: 'BHI', status: 'Enrolled' }, { code: 'CCM', status: 'New' }, { code: 'DM', status: 'New' }])).toEqual(['CCM', 'BHI']);
    expect(timeProgramsFor([{ code: 'BHI', status: 'Closed' }, { code: 'TOC IP', status: 'New' }])).toEqual(['CCM']);
  });

  it('sums a program’s logged time in a period, counting older rows as CCM', () => {
    const acts = [
      { periodId: 'p', durationSeconds: 300 },
      { periodId: 'p', durationSeconds: 120, programCode: 'BHI' },
      { periodId: 'p', durationSeconds: 60, programCode: 'CCM', isUnlogged: true },
      { periodId: 'q', durationSeconds: 900 },
    ];
    expect(loggedSecondsFor(acts, 'p', 'CCM')).toBe(300);
    expect(loggedSecondsFor(acts, 'p', 'BHI')).toBe(120);
  });

  it('reads the monthly minimum and the progress', () => {
    expect(targetMinutesFor('CCM', { requiredMinutes: 60 })).toBe(60);
    expect(targetMinutesFor('PCM', { requiredMinutes: 20 })).toBe(30);
    expect(progressLabel('CCM', 600, 125, 20)).toBe('CCM 12/20 min');
  });
});

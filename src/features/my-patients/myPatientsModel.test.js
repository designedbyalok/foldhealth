import { describe, expect, it } from 'vitest';
import { adherenceBand, bandCounts, lastTouchText, minutesState, reviewState } from './myPatientsModel';
import { MY_PATIENTS } from './data/mock';

const today = new Date(2026, 10, 11);

describe('my patients model', () => {
  it('bands adherence at 75 and 55', () => {
    expect(adherenceBand(75).label).toBe('On Track');
    expect(adherenceBand(74).label).toBe('At Risk');
    expect(adherenceBand(55).label).toBe('At Risk');
    expect(adherenceBand(54).label).toBe('Off Track');
  });

  it('marks a review overdue once its cadence passes', () => {
    expect(reviewState('09/24/2026', 30, today)).toEqual({ overdueDays: 18, label: '18 days overdue' });
    expect(reviewState('10/28/2026', 30, today).label).toBe('Current');
    expect(reviewState('', 30, today).label).toBe('Not reviewed');
  });

  it('reads program minutes and the last touch', () => {
    expect(minutesState({ minutesProgram: 'CCM', minutesLogged: 8, minutesTarget: 20 })).toMatchObject({ text: '8 / 20 min', pct: 40, met: false });
    expect(minutesState({ minutesProgram: null })).toBeNull();
    expect(lastTouchText({ lastTouchDate: '11/08/2026', lastTouchChannel: 'Video' }, today)).toBe('Video · 3d ago');
  });

  it('counts the seeded rows in every band', () => {
    const counts = bandCounts(MY_PATIENTS);
    expect(counts['On Track'] + counts['At Risk'] + counts['Off Track']).toBe(MY_PATIENTS.length);
    expect(counts['Off Track']).toBeGreaterThan(0);
    expect(new Set(MY_PATIENTS.map(r => r.id)).size).toBe(MY_PATIENTS.length);
  });
});

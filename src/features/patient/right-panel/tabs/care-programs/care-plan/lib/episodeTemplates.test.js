import { describe, expect, it } from 'vitest';
import {
  dayAfter, episodeEndsOn, episodeLengthLabel, episodeOf, episodeProgress, episodeSupersedes, isEpisodeDue,
} from './episodeTemplates';

const today = new Date(2026, 9, 19); // Oct 19 2026, local
const run = (over) => ({ episodic: true, status: 'active', startedAt: new Date(2026, 9, 10, 21, 30).toISOString(), ...over });

describe('episodeOf', () => {
  it('is null for ongoing templates', () => {
    expect(episodeOf({ episodic: false, episodeDays: 30 })).toBeNull();
    expect(episodeOf(null)).toBeNull();
  });
  it('reads the length, treating a missing one as until closed', () => {
    expect(episodeOf({ episodic: true, episodeDays: 30 })).toEqual({ days: 30, pausesOngoing: true, programCode: null, supersedes: [] });
    expect(episodeOf({ episodic: true, episodeDays: null, episodePausesOngoing: false }))
      .toEqual({ days: null, pausesOngoing: false, programCode: null, supersedes: [] });
  });
  it('reads the program it runs as and the programs it pauses', () => {
    expect(episodeOf({ episodic: true, episodeDays: 14, episodeProgramCode: 'TOC ED', episodeSupersedes: ['CCM'] }))
      .toEqual({ days: 14, pausesOngoing: true, programCode: 'TOC ED', supersedes: ['CCM'] });
  });
  it('labels the length', () => {
    expect(episodeLengthLabel(14)).toBe('14-day episode');
    expect(episodeLengthLabel(null)).toBe('Episode until closed');
  });
});

describe('episode dates', () => {
  it('counts the start as day 1, so a 30-day episode ends 29 days later', () => {
    expect(episodeEndsOn(new Date(2026, 9, 1), 30)).toBe('2026-10-30');
    expect(episodeEndsOn(new Date(2026, 9, 1), 1)).toBe('2026-10-01');
    expect(episodeEndsOn(new Date(2026, 9, 1), null)).toBeNull();
  });
  it('resumes paused plans the day after it ends, across a month end', () => {
    expect(dayAfter('2026-10-31')).toBe('2026-11-01');
    expect(dayAfter(null)).toBeNull();
  });
});

describe('episodeProgress', () => {
  it('reads an evening start in local time, not its UTC date', () => {
    expect(episodeProgress(run({ endsOn: '2026-10-23' }), today)).toMatchObject({ day: 10, totalDays: 14, daysLeft: 5, endingSoon: false, due: false });
  });
  it('is ending soon in the last three days, and due only after the last day', () => {
    expect(episodeProgress(run({ endsOn: '2026-10-21' }), today).endingSoon).toBe(true);
    expect(episodeProgress(run({ endsOn: '2026-10-19' }), today)).toMatchObject({ daysLeft: 1, due: false });
    expect(episodeProgress(run({ endsOn: '2026-10-18' }), today).due).toBe(true);
  });
  it('has no end for an open-ended episode', () => {
    expect(episodeProgress(run({ endsOn: null }), today)).toMatchObject({ day: 10, totalDays: null, daysLeft: null, due: false });
  });
});

describe('isEpisodeDue', () => {
  it('only closes active episodic runs past their last day', () => {
    expect(isEpisodeDue(run({ endsOn: '2026-10-18' }), today)).toBe(true);
    expect(isEpisodeDue(run({ endsOn: '2026-10-18', status: 'completed' }), today)).toBe(false);
    expect(isEpisodeDue(run({ endsOn: '2026-10-18', episodic: false }), today)).toBe(false);
    expect(isEpisodeDue(run({ endsOn: null }), today)).toBe(false);
  });
});

describe('episodeSupersedes', () => {
  const ep = (over) => episodeOf({ episodic: true, episodeDays: 30, ...over });
  it('pauses every ongoing program when no rules are set', () => {
    expect(episodeSupersedes(ep(), 'SNP')).toBe(true);
    expect(episodeSupersedes(ep(), 'DM')).toBe(true);
  });
  it('pauses only the listed programs when rules are set', () => {
    const e = ep({ episodeSupersedes: ['CCM', 'DM'] });
    expect(episodeSupersedes(e, 'DM')).toBe(true);
    expect(episodeSupersedes(e, 'SNP')).toBe(false);
  });
  it('never pauses another episode', () => {
    expect(episodeSupersedes(ep(), 'TOC ED')).toBe(false);
    expect(episodeSupersedes(ep(), 'HH')).toBe(false);
  });
  it('pauses nothing when pausing is off', () => {
    expect(episodeSupersedes(ep({ episodePausesOngoing: false }), 'SNP')).toBe(false);
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addDays, daysInMonth, isoFromLocal, isoFromMdy, localDateMs, mdyFromIso, parseLocalDate, sameDay, startOfDay } from './localDate';

// West of UTC is where `new Date('YYYY-MM-DD')` shows the previous day.
// Node re-reads TZ on assignment, so this pins the zone for these tests.
let prevTz;
beforeAll(() => { prevTz = globalThis.process.env.TZ; globalThis.process.env.TZ = 'America/New_York'; });
afterAll(() => {
  if (prevTz === undefined) delete globalThis.process.env.TZ;
  else globalThis.process.env.TZ = prevTz;
});

describe('parseLocalDate', () => {
  it('reads a bare YYYY-MM-DD as that calendar day, not the day before', () => {
    expect(new Date('2026-10-11').getDate()).toBe(10);
    const d = parseLocalDate('2026-10-11');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 9, 11, 0]);
  });

  it('leaves real timestamps and other formats to the Date constructor', () => {
    expect(parseLocalDate('2026-10-11T15:30:00Z').getTime()).toBe(Date.UTC(2026, 9, 11, 15, 30));
    expect(parseLocalDate('10/11/2026').getDate()).toBe(11);
    const src = new Date(2026, 0, 2);
    expect(parseLocalDate(src).getTime()).toBe(src.getTime());
  });

  it('returns null for empty or unparseable input', () => {
    expect(parseLocalDate(null)).toBeNull();
    expect(parseLocalDate(undefined)).toBeNull();
    expect(parseLocalDate('')).toBeNull();
    expect(parseLocalDate('-')).toBeNull();
    expect(localDateMs('nope')).toBeNaN();
  });
});

describe('calendar helpers', () => {
  it('round-trips a local day through ISO', () => {
    expect(isoFromLocal(parseLocalDate('2026-03-08'))).toBe('2026-03-08');
  });

  it('steps across the spring DST change by calendar day', () => {
    // 2026-03-08 is the US spring-forward day: a 24h step would land at 23:00.
    expect(isoFromLocal(addDays(parseLocalDate('2026-03-07'), 1))).toBe('2026-03-08');
    expect(isoFromLocal(addDays(parseLocalDate('2026-03-08'), 1))).toBe('2026-03-09');
  });

  it('compares days and drops the time', () => {
    expect(sameDay(new Date(2026, 0, 5, 23, 59), new Date(2026, 0, 5, 0, 1))).toBe(true);
    expect(sameDay(new Date(2026, 0, 5), null)).toBe(false);
    expect(startOfDay(new Date(2026, 0, 5, 13, 30)).getHours()).toBe(0);
  });

  it('counts days in a month, leap years included', () => {
    expect(daysInMonth(2024, 1)).toBe(29);
    expect(daysInMonth(2026, 1)).toBe(28);
    expect(daysInMonth(2026, 11)).toBe(31);
  });

  it('converts between MM/DD/YYYY and ISO', () => {
    expect(mdyFromIso('2026-11-04')).toBe('11/04/2026');
    expect(mdyFromIso('')).toBe('');
    expect(isoFromMdy('7/3/2026')).toBe('2026-07-03');
    expect(isoFromMdy('13/01/2026')).toBeNull();
    expect(isoFromMdy('07/03/')).toBeNull();
  });
});

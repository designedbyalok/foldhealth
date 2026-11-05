import { describe, expect, it } from 'vitest';
import { buildRecap, recapWindow } from './recapStory';

const NOW = new Date(2026, 9, 23, 12).getTime();
const DAY = 24 * 3600 * 1000;
const at = n => NOW - n * DAY;
const ev = (id, n, over) => ({ id, at: at(n), ...over });

const EVENTS = [
  ev('up', -5, { category: 'touchpoint', kind: 'appointment', title: 'Annual Wellness Visit', outcome: 'Scheduled' }),
  ev('chat', 2, { category: 'touchpoint', kind: 'chat', title: 'Patient Chat', actor: 'Dr. Aldo Richman' }),
  ev('call', 5, { category: 'touchpoint', kind: 'call', title: 'Outgoing Call with Patient', outcome: 'Completed' }),
  ev('lab', 8, { category: 'clinical', kind: 'lab', title: 'Potassium 6.1', outcome: 'Out of range' }),
  ev('med', 10, { category: 'clinical', kind: 'med_start', title: 'Started Losartan' }),
  ev('prog', 12, { category: 'program', kind: 'program', title: 'SNP Program Status Change', outcome: 'Attempted' }),
  ev('ed', 60, { category: 'clinical', kind: 'encounter', title: 'Visit: Emergency department visit' }),
];

describe('recapWindow', () => {
  it('uses the last touch, else 30 days', () => {
    expect(recapWindow('touch', { events: EVENTS, now: NOW })).toEqual({ from: at(2), label: 'since the last visit on 10/21/2026' });
    expect(recapWindow('touch', { events: [], now: NOW }).label).toBe('in the last 30 days');
    expect(recapWindow('90', { events: [], now: NOW }).from).toBe(at(90));
  });
});

describe('buildRecap', () => {
  it('sorts the period into touchpoints, clinical, medications and programs', () => {
    const r = buildRecap({ events: EVENTS, from: at(30), now: NOW, openCount: 3 });
    expect(r.touchpoints.map(e => e.id)).toEqual(['chat', 'call']);
    expect(r.clinical.map(e => e.id)).toEqual(['lab']);
    expect(r.medications.map(e => e.id)).toEqual(['med']);
    expect(r.programs.map(e => e.id)).toEqual(['prog']);
    expect(r.upcoming.map(e => e.id)).toEqual(['up']);
    expect(r.lastTouch.id).toBe('chat');
  });

  it('writes a plain summary of what was recorded', () => {
    const r = buildRecap({ events: EVENTS, from: at(30), now: NOW, openCount: 3 });
    expect(r.summary).toEqual([
      'Last visit: Patient Chat with Dr. Aldo Richman on 10/21/2026.',
      '2 touchpoints: 1 chat and 1 call.',
      '1 lab result recorded, 1 out of range.',
      '1 medication change: 1 started.',
      '1 program update, latest SNP Program Status Change (Attempted) on 10/11/2026.',
      '3 items need attention.',
    ]);
  });

  it('counts ED visits and shows earlier clinical events when the period has none', () => {
    const wide = buildRecap({ events: EVENTS, from: at(90), now: NOW });
    expect(wide.summary).toContain('1 lab result and 1 visit recorded, 1 out of range and 1 ED visit.');
    const quiet = buildRecap({ events: EVENTS, from: at(4), now: NOW });
    expect(quiet.clinical).toEqual([]);
    expect(quiet.earlierClinical.map(e => e.id)).toEqual(['lab', 'ed']);
  });

  it('leaves out staff housekeeping like report downloads', () => {
    const events = [...EVENTS, ev('dl', 1, { category: 'program', kind: 'program', title: 'Program Report Downloaded' })];
    const r = buildRecap({ events, from: at(30), now: NOW });
    expect(r.programs.map(e => e.id)).toEqual(['prog']);
    expect(r.inWindow.some(e => e.id === 'dl')).toBe(false);
  });

  it('says so when nothing happened', () => {
    expect(buildRecap({ events: [], from: at(30), now: NOW }).summary).toEqual(['Nothing was recorded in this period.']);
  });
});

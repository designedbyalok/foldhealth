import { describe, expect, it } from 'vitest';
import { FALLBACK_DAYS, buildAttentionSignals, lastTouchAt } from './attentionSignals';

const NOW = new Date(2026, 9, 23, 12).getTime();
const DAY = 24 * 3600 * 1000;
const daysAgo = n => NOW - n * DAY;

const call = (n, outcome = 'Completed') => ({ id: `c${n}`, category: 'touchpoint', kind: 'call', at: daysAgo(n), outcome });
const appt = (n, outcome, title = 'Annual Wellness Visit') => ({ id: `a${n}`, category: 'touchpoint', kind: 'appointment', at: daysAgo(n), title, outcome });
const lab = (n, outcome) => ({ id: `l${n}`, category: 'clinical', kind: 'lab', at: daysAgo(n), title: 'Potassium 6.1 mmol/L', detail: 'Range 3.5–5.1 mmol/L', outcome });

describe('lastTouchAt', () => {
  it('is the newest completed touchpoint', () => {
    expect(lastTouchAt([call(3), call(10)], NOW)).toBe(daysAgo(3));
  });

  it('skips scheduled, failed and future touchpoints', () => {
    const events = [appt(-2, 'Scheduled'), call(1, 'Failed'), appt(2, 'Scheduled'), call(6)];
    expect(lastTouchAt(events, NOW)).toBe(daysAgo(6));
  });

  it('is null with no touch on record', () => {
    expect(lastTouchAt([lab(2, 'Out of range')], NOW)).toBeNull();
  });
});

describe('buildAttentionSignals', () => {
  it('falls back to 30 days without a last touch', () => {
    const { since, sinceIsLastTouch } = buildAttentionSignals({ events: [], now: NOW });
    expect(since).toBe(daysAgo(FALLBACK_DAYS));
    expect(sinceIsLastTouch).toBe(false);
  });

  it('flags out-of-range labs since the last touch only', () => {
    const { signals } = buildAttentionSignals({ events: [call(5), lab(2, 'Out of range'), lab(9, 'Out of range'), lab(1, 'In range')], now: NOW });
    expect(signals.map(s => s.id)).toEqual(['lab:l2']);
    expect(signals[0]).toMatchObject({ severity: 'high', isNew: true, action: { key: 'addTask' } });
  });

  it('flags a past visit never checked in, unless it was rebooked', () => {
    const missed = buildAttentionSignals({ events: [appt(20, 'Scheduled')], now: NOW }).signals;
    expect(missed[0]).toMatchObject({ id: 'appt:a20', title: 'Missed Annual Wellness Visit', action: { key: 'schedule' } });
    expect(missed[0].detail).toContain('Never checked in');

    const rebooked = buildAttentionSignals({ events: [appt(-7, 'Scheduled'), appt(20, 'Scheduled')], now: NOW }).signals;
    expect(rebooked).toEqual([]);
  });

  it('ranks a no-show above a visit never checked in', () => {
    const { signals } = buildAttentionSignals({ events: [appt(10, 'Scheduled'), appt(15, 'No Show', 'Follow-up Visit')], now: NOW });
    expect(signals.map(s => s.severity)).toEqual(['high', 'medium']);
  });

  it('ignores missed visits older than the lookback', () => {
    expect(buildAttentionSignals({ events: [appt(400, 'No Show')], now: NOW }).signals).toEqual([]);
  });

  it('lists ED visits and admissions with their follow-up', () => {
    const adt = { id: 'e1', category: 'clinical', kind: 'adt', at: daysAgo(3), title: 'ED visit: Mercy General', tone: 'warning', outcome: null };
    const [s] = buildAttentionSignals({ events: [adt], now: NOW }).signals;
    expect(s).toMatchObject({ id: 'adt:e1', severity: 'high', action: { key: 'addTask', label: 'TOC Task' } });
    expect(s.detail).toContain('Follow-up not planned');
  });

  it('flags repeat ED visits from encounters, not a single one', () => {
    const ed = (n, d) => ({ id: `e${n}`, category: 'clinical', kind: 'encounter', at: daysAgo(d), title: 'Visit: Emergency department visit, level 4' });
    expect(buildAttentionSignals({ events: [ed(1, 40)], now: NOW }).signals).toEqual([]);
    const [s] = buildAttentionSignals({ events: [ed(1, 40), ed(2, 100), ed(3, 300)], now: NOW }).signals;
    expect(s).toMatchObject({ kind: 'adt', severity: 'high', title: '2 ED visits in 6 months', action: { key: 'addTask' } });
  });

  it('keeps vitals off goal as standing signals, keyed to the reading', () => {
    const vitals = [
      { key: 'bp', tone: 'error', label: 'Blood Pressure', value: '142/88', unit: 'mmHg', goalTo: '120/80', change: '3.5%', direction: 'up', measuredAt: '05/08/2025' },
      { key: 'glucose', tone: 'success', label: 'Blood Glucose', value: '165' },
    ];
    const { signals } = buildAttentionSignals({ vitals, now: NOW });
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({ id: 'vital:bp:05/08/2025:142/88', isNew: false, title: 'Blood Pressure 142/88 mmHg' });
    expect(signals[0].detail).toBe('Goal 120/80 • ↑ 3.5% • 05/08/2025');
  });

  it('flags open gaps past their due date', () => {
    const gaps = [
      { id: 'g1', title: 'Diabetic eye exam', detail: 'Due 12/31/2025 • HEDIS 2025', status: 'Open' },
      { id: 'g2', title: 'Colorectal screening', detail: 'Due 12/31/2026', status: 'Open' },
      { id: 'g3', title: 'HbA1c control', detail: 'Last result 8.2%', status: 'At risk' },
    ];
    expect(buildAttentionSignals({ gaps, now: NOW }).signals.map(s => s.id)).toEqual(['gap:g1']);
  });

  it('rolls overdue tasks into one signal that changes with the set', () => {
    const a = buildAttentionSignals({ overdue: [{ id: 't2', title: 'Call PCP', due: '10/01/2026' }], now: NOW }).signals[0];
    const b = buildAttentionSignals({ overdue: [{ id: 't2', title: 'Call PCP', due: '10/01/2026' }, { id: 't1', title: 'Fax notes' }], now: NOW }).signals[0];
    expect(a.title).toBe('1 overdue task');
    expect(b.title).toBe('2 overdue tasks');
    expect(a.id).not.toBe(b.id);
  });

  it('flags unanswered messages, high after two days', () => {
    const conversations = [{ id: 'c1', unread_count: 2, last_message_at: new Date(daysAgo(3)).toISOString() }];
    const [s] = buildAttentionSignals({ conversations, now: NOW }).signals;
    expect(s).toMatchObject({ kind: 'reply', severity: 'high', action: { key: 'reply' } });
    expect(s.conversation.id).toBe('c1');
  });

  it('flags a RAF jump of 0.3 or more', () => {
    expect(buildAttentionSignals({ profile: { raf_score: 2.104, raf_change: 0.5 }, now: NOW }).signals[0].title).toBe('RAF up 0.5 to 2.104');
    expect(buildAttentionSignals({ profile: { raf_score: 1.2, raf_change: 0.1 }, now: NOW }).signals).toEqual([]);
  });

  it('puts a missed visit ahead of overdue tasks at the same severity', () => {
    const { signals } = buildAttentionSignals({ events: [appt(20, 'Scheduled')], overdue: [{ id: 't1', title: 'Call PCP', due: '10/20/2026' }], now: NOW });
    expect(signals.map(s => s.kind)).toEqual(['appointment', 'tasks']);
  });

  it('orders by severity, then new before standing, then newest first', () => {
    const vitals = [{ key: 'bp', tone: 'error', label: 'BP', value: '150/90', measuredAt: '01/01/2025' }];
    const events = [call(10), lab(2, 'Out of range'), { id: 'm1', category: 'clinical', kind: 'med_start', at: daysAgo(1), title: 'Started Metformin' }];
    const ids = buildAttentionSignals({ events, vitals, now: NOW }).signals.map(s => s.id);
    expect(ids).toEqual(['lab:l2', 'med:m1', 'vital:bp:01/01/2025:150/90']);
  });
});

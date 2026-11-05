import { describe, expect, it } from 'vitest';
import {
  attentionChanges, clinicalChanges, medicationChanges, programChanges, touchpointChanges, vitalChanges,
} from './recapChanges';

const NOW = new Date(2026, 9, 23, 12).getTime();
const DAY = 24 * 3600 * 1000;
const at = n => NOW - n * DAY;
const WINDOW = { from: at(30), now: NOW, periodLabel: '30 days' };
const touch = (id, n, kind, outcome) => ({ id, at: at(n), category: 'touchpoint', kind, outcome });

describe('touchpointChanges', () => {
  it('compares with the previous period, by channel', () => {
    const events = [touch('a', 2, 'call', 'Completed'), touch('b', 5, 'chat'), touch('c', 40, 'call', 'Failed'), touch('up', -3, 'appointment')];
    const { rows, headline } = touchpointChanges(events, WINDOW);
    expect(headline).toBe('2 touchpoints, up from 1 in the previous 30 days.');
    expect(rows.find(r => r.key === 'total')).toMatchObject({ from: '1', to: '2', delta: '+1' });
    expect(rows.find(r => r.key === 'chat')).toMatchObject({ label: 'Chat', from: '0', to: '1' });
    expect(rows.find(r => r.key === 'call')).toBeUndefined();
    expect(rows.find(r => r.key === 'completed')).toMatchObject({ from: '0', to: '1' });
  });
});

describe('clinicalChanges', () => {
  const lab = (id, n, value, outcome) => ({ id, at: at(n), category: 'clinical', kind: 'lab', name: 'HbA1c', value, unit: '%', outcome });

  it('compares a lab with its previous result', () => {
    const { rows, headline } = clinicalChanges([lab('l2', 5, 8.2, 'Out of range'), lab('l1', 120, 7.6, 'In range')], WINDOW);
    expect(rows[0]).toMatchObject({ label: 'HbA1c', from: '7.6%', to: '8.2%', delta: '+0.6', tone: 'worse', note: 'Out of range' });
    expect(headline).toBe('1 new lab result, 1 out of range.');
  });

  it('marks a first result and a lab back in range', () => {
    expect(clinicalChanges([lab('l1', 5, 7.6)], WINDOW).rows[0]).toMatchObject({ from: null, note: 'First result' });
    const back = clinicalChanges([lab('l2', 5, 6.8, 'In range'), lab('l1', 90, 8.2, 'Out of range')], WINDOW).rows[0];
    expect(back).toMatchObject({ tone: 'better', note: 'Back in range', delta: '−1.4' });
  });

  it('counts ED visits against the previous period as worse when up', () => {
    const ed = (id, n) => ({ id, at: at(n), category: 'clinical', kind: 'encounter', title: 'Visit: Emergency department visit' });
    const row = clinicalChanges([ed('e1', 3), ed('e2', 10)], WINDOW).rows.find(r => r.key === 'ed');
    expect(row).toMatchObject({ from: '0', to: '2', delta: '+2', tone: 'worse' });
  });

  it('leaves medication changes to their own section', () => {
    const start = { id: 'med-1-start', at: at(3), category: 'clinical', kind: 'med_start', title: 'Started X' };
    expect(clinicalChanges([start], WINDOW).headline).toBe('No new clinical results or visits in this period.');
  });

  it('says so when nothing new was recorded', () => {
    expect(clinicalChanges([lab('l1', 90, 7.6)], WINDOW).headline).toBe('No new clinical results or visits in this period.');
  });
});

describe('vitalChanges', () => {
  it('compares the latest reading with the one before, toward the goal', () => {
    const vitals = [
      { key: 'bp', label: 'Blood Pressure', value: '142/88', unit: 'mmHg', goalTo: '120/80', tone: 'error', series: [138, 142], diastolicSeries: [87, 88] },
      { key: 'glucose', label: 'Blood Glucose', value: '165', unit: 'mg/dL', goalTo: '140 mg/dL', tone: 'success', series: [168, 165] },
    ];
    const { rows, headline } = vitalChanges(vitals);
    expect(rows[0]).toMatchObject({ from: '138/87 mmHg', to: '142/88 mmHg', delta: '+4', tone: 'worse', note: 'Further from goal' });
    expect(rows[1]).toMatchObject({ delta: '−3', tone: 'better', note: 'At goal' });
    expect(headline).toBe('Blood Pressure moved further from goal; Blood Glucose moved closer since the previous reading.');
  });
});

describe('medicationChanges', () => {
  const med = (id, kind, n, name, outcome) => ({ id: `med-${id}-${kind === 'med_start' ? 'start' : 'stop'}`, at: at(n), kind, title: `${kind === 'med_start' ? 'Started' : 'Stopped'} ${name}`, outcome, facts: [{ label: 'Medication', value: name }] });

  it('compares active medications at the start with now', () => {
    const events = [
      med(1, 'med_stop', 2, 'Losartan', 'Adverse Reaction'),
      med(2, 'med_start', 5, 'Metformin'),
      med(1, 'med_start', 60, 'Losartan'),
      med(3, 'med_start', 90, 'Aspirin'),
    ];
    const { rows, headline } = medicationChanges(events, WINDOW);
    expect(rows[0]).toMatchObject({ label: 'Active medications', from: '2', to: '2' });
    expect(rows.find(r => r.label === 'Stopped')).toMatchObject({ to: 'Losartan', note: expect.stringContaining('Adverse Reaction') });
    expect(headline).toBe('1 started, 1 stopped; active medications stay at 2.');
    const two = medicationChanges([med(4, 'med_start', 3, 'A'), med(5, 'med_start', 4, 'B')], WINDOW);
    expect(two.headline).toBe('2 started, 0 stopped; active medications went from 0 to 2.');
  });
});

describe('programChanges', () => {
  const status = (id, n, program, outcome, title = `${program} Program Status Change`) => ({ id, at: at(n), category: 'program', kind: 'program', program, outcome, title });

  it('shows each program status before and after', () => {
    const events = [
      status('s2', 10, 'SNP', 'Attempted'),
      status('d', 3, 'SNP', null, 'Program Report Downloaded'),
      status('s1', 60, 'SNP', 'Engaged'),
      status('a1', 50, 'AWV', 'New', 'AWV Program Enrolled'),
      status('h1', 5, 'TOC', 'Reviewed & Saved', 'HRA Completed'),
    ];
    const { rows, headline } = programChanges(events, WINDOW);
    expect(rows.find(r => r.key === 'SNP')).toMatchObject({ from: 'Engaged', to: 'Attempted', note: 'Status changed' });
    expect(rows.find(r => r.key === 'AWV')).toMatchObject({ from: 'New', to: 'New', note: 'No change' });
    expect(rows.find(r => r.key === 'TOC')).toBeUndefined();
    expect(rows.find(r => r.key === 'activity')).toMatchObject({ from: '2', to: '2' });
    expect(headline).toBe('SNP Engaged → Attempted.');
  });

  it('compares a program enrolled inside the period with its first status there', () => {
    const events = [status('s2', 5, 'SNP', 'Attempted'), status('s1', 20, 'SNP', 'New', 'SNP Program Enrolled')];
    expect(programChanges(events, WINDOW).rows[0]).toMatchObject({ from: 'New', to: 'Attempted', note: 'Status changed' });
    const once = programChanges([status('s1', 20, 'SNP', 'New', 'SNP Program Enrolled')], WINDOW).rows[0];
    expect(once).toMatchObject({ from: null, to: 'New', note: 'Enrolled' });
  });
});

describe('attentionChanges', () => {
  it('counts new, reviewed in the period and still open', () => {
    const signals = [{ id: 'a', isNew: true }, { id: 'b', isNew: false }, { id: 'c', isNew: true }];
    const reviews = { c: { reviewedAt: new Date(at(1)).toISOString() } };
    const { rows, headline } = attentionChanges(signals, reviews, WINDOW);
    expect(rows.map(r => r.to)).toEqual(['1', '1', '2']);
    expect(headline).toBe('2 open items, 1 new since the last visit, 1 reviewed in this period.');
  });
});

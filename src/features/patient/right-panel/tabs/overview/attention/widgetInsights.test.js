import { describe, expect, it } from 'vitest';
import { signalsByWidget, widgetInsightSummary } from './widgetInsights';

const s = (kind, over = {}) => ({ id: `${kind}:${over.id || 1}`, kind, title: '', detail: '', ...over });

describe('signalsByWidget', () => {
  it('files each signal under its widget, labs with vitals', () => {
    const by = signalsByWidget([s('appointment'), s('lab'), s('vital'), s('reply'), s('adt'), s('unknown')]);
    expect(Object.keys(by).sort()).toEqual(['appointments', 'awaitingReply', 'highlights', 'vitals']);
    expect(by.vitals.map(x => x.kind)).toEqual(['lab', 'vital']);
  });
});

describe('widgetInsightSummary', () => {
  it('names a single missed visit and its date', () => {
    const appt = s('appointment', { title: 'Missed Annual Wellness Visit', detail: '04/10/2026 • Never checked in • Not rebooked' });
    expect(widgetInsightSummary('appointments', [appt])).toBe('Missed Annual Wellness Visit on 04/10/2026 is not rebooked.');
    expect(widgetInsightSummary('appointments', [appt, appt])).toBe('2 missed visits are not rebooked.');
  });

  it('joins vitals off goal by name, with abnormal labs first', () => {
    const vitals = [s('vital', { label: 'Blood Pressure' }), s('vital', { label: 'HbA1c' })];
    expect(widgetInsightSummary('vitals', vitals)).toBe('Blood Pressure and HbA1c are above goal.');
    expect(widgetInsightSummary('vitals', [s('lab'), vitals[0]])).toBe('1 abnormal lab since the last visit; Blood Pressure is above goal.');
  });

  it('phrases overdue tasks, gaps and risk', () => {
    expect(widgetInsightSummary('tasks', [s('tasks', { title: '3 overdue tasks' })])).toBe('3 tasks are past due.');
    expect(widgetInsightSummary('tasks', [s('tasks', { title: '1 overdue task' })])).toBe('1 task is past due.');
    expect(widgetInsightSummary('gaps', [s('gap')])).toBe('1 care gap is past the due date.');
    expect(widgetInsightSummary('riskAcuity', [s('risk', { title: 'RAF up 0.5 to 2.104' })])).toBe('RAF rose 0.5 to 2.104 since the last score.');
  });

  it('is empty without signals', () => {
    expect(widgetInsightSummary('tasks', [])).toBe('');
  });
});

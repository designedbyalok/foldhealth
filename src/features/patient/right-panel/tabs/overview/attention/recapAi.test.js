import { describe, expect, it } from 'vitest';
import { recapAiPayload, sampleSummaries } from './recapAi';

const NOW = new Date(2026, 9, 23, 12).getTime();
const at = n => NOW - n * 24 * 3600 * 1000;

const recap = {
  lastTouch: { title: 'Patient Chat', actor: 'Dr. Aldo Richman', at: at(2) },
  touchpoints: [
    { id: 'c', title: 'Patient Chat', actor: 'Dr. Aldo Richman', at: at(2) },
    { id: 'k', title: 'Outgoing Call', outcome: 'Completed', at: at(5) },
  ],
  clinical: [],
  earlierClinical: [{ id: 'n', title: 'Consolidated visit note', at: at(52) }],
  programs: [{ id: 'p', title: 'Care Plan Shared to EHR', at: at(22) }],
};
const changes = {
  touchpoints: { headline: '2 touchpoints, up from 1 in the previous 30 days.', rows: [{ key: 'total', to: '2' }, { key: 'visit', label: 'Visit', from: '1', to: '0' }] },
  clinical: { headline: 'No new clinical results or visits in this period.', rows: [] },
  vitals: { headline: 'x', rows: [{ key: 'bp', label: 'Blood Pressure', from: '138/87 mmHg', to: '142/88 mmHg', delta: '+4', tone: 'worse' }] },
  medications: { headline: '1 started, 1 stopped; active medications stay at 2.', rows: [{ label: 'Stopped', to: 'Losartan', note: 'Adverse Reaction • 10/20/2026' }] },
  programs: { headline: '', rows: [{ key: 'SNP', label: 'SNP', from: 'Engaged', to: 'Attempted', note: 'Status changed' }, { key: 'AWV', label: 'AWV', from: 'New', to: 'New', note: 'No change' }] },
  attention: { headline: '2 open items, 0 new since the last visit, 0 reviewed in this period.', rows: [] },
};
const open = [{ id: 'ed', kind: 'adt', title: '2 ED visits in 6 months', detail: '07/01/2026 • 05/20/2026', action: { label: 'Create Task' } }, { id: 'v', kind: 'vital', title: 'BP' }];

describe('sampleSummaries', () => {
  const s = sampleSummaries({ recap, changes, signals: open, openSignals: open });

  it('writes one paragraph per section from the recorded facts', () => {
    expect(Object.keys(s)).toEqual(['glance', 'touchpoints', 'clinical', 'vitals', 'medications', 'programs', 'attention']);
    expect(s.glance).toBe('The last visit was Patient Chat with Dr. Aldo Richman on 10/21/2026. 2 touchpoints, up from 1 in the previous 30 days. Blood Pressure moved further from goal. 2 items need attention, most urgent: 2 ED visits in 6 months.');
    expect(s.touchpoints).toContain('The last completed contact was Outgoing Call on 10/18/2026.');
    expect(s.touchpoints).toContain('No visit this period.');
    expect(s.clinical).toBe('No new clinical results or visits in this period. 2 ED visits in 6 months (07/01/2026 • 05/20/2026). The most recent record is Consolidated visit note on 09/01/2026.');
    expect(s.vitals).toBe('Blood Pressure went from 138/87 mmHg to 142/88 mmHg (+4), further from goal.');
    expect(s.medications).toBe('1 started, 1 stopped; active medications stay at 2. Stopped: Losartan (Adverse Reaction).');
    expect(s.programs).toBe('SNP moved from Engaged to Attempted. AWV stays New. Latest update: Care Plan Shared to EHR on 10/01/2026.');
    expect(s.attention).toBe('2 open items, 0 new since the last visit, 0 reviewed in this period. Start with 2 ED visits in 6 months (Create Task).');
  });
});

describe('recapAiPayload', () => {
  it('sends compact facts, not raw events', () => {
    const p = recapAiPayload({ patientName: 'Annette Brave', period: 'the last 30 days', sections: [{ key: 'touchpoints', title: 'Touchpoints', headline: 'h', changes: changes.touchpoints.rows, events: [{ id: 'c', at: at(2), kind: 'chat', title: 'Patient Chat', actor: 'Dr. A' }] }] });
    expect(p.sections[0].events[0]).toEqual({ date: '10/21/2026', type: 'Chat', title: 'Patient Chat', detail: null, by: 'Dr. A', outcome: null });
    expect(p.sections[0].changes[1]).toEqual({ label: 'Visit', from: '1', to: '0', delta: null, note: null });
  });
});

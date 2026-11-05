import { describe, expect, it } from 'vitest';
import { programAttention } from './programAttention';

const NOW = new Date(2026, 9, 26, 12).getTime();
const prog = (code, over) => ({ code, status: 'Active', assignee: 'Alok Kumar', progress: 40, startDate: '09/01/2026', ...over });

describe('programAttention', () => {
  it('flags programs that need someone to act, worst first', () => {
    const r = programAttention([
      prog('OK'),
      prog('UTR', { status: 'Unable to Reach' }),
      prog('OWN', { assignee: 'Unassigned' }),
      prog('ATT', { status: 'Attempted' }),
      prog('NEW', { status: 'New', progress: 0, startDate: '07/28/2026' }),
      prog('FRESH', { status: 'New', progress: 0, startDate: '10/20/2026' }),
      prog('END', { plannedEndDate: '11/10/2026' }),
    ], NOW);
    expect(r.map(x => [x.program.code, x.reason])).toEqual([
      ['UTR', 'Unable to reach'],
      ['OWN', 'No owner'],
      ['ATT', 'Outreach attempted'],
      ['NEW', 'Not started'],
      ['END', 'Ends 11/10/2026'],
      ['OK', null],
      ['FRESH', null],
    ]);
  });
});

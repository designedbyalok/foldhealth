import { describe, expect, it } from 'vitest';
import { openSuggestions, suggestionAction } from './programSuggestedActionsModel';
import { PROGRAM_EVENT_SUGGESTIONS } from '../../../../../data/programEventSuggestionsSeed';

const william = PROGRAM_EVENT_SUGGESTIONS.filter(r => r.memberId === '11143').map(r => ({ ...r, status: 'open' }));
const stepsOf = () => [{ id: 'tocip-outreach', name: 'Outreach' }, { type: 'section', children: [{ id: 'tocip-docs', name: 'Program Documents' }] }];
const programs = [{ id: 'p1', code: 'TOC IP', status: 'New' }, { id: 'p2', code: 'SNP', status: 'New' }];

describe('care program suggested actions', () => {
  it('lists open suggestions newest event first, dropping decided ones', () => {
    const rows = [...william, { ...william[0], id: 'x', status: 'dismissed' }];
    expect(openSuggestions(rows, programs).map(r => r.id)).toEqual(['pes-11143-efax', 'pes-11143-adt', 'pes-11143-imaging', 'pes-11143-lab']);
  });

  it('resolves an enroll suggestion once the patient is in the program', () => {
    const dm = william.find(r => r.action.type === 'enroll');
    expect(openSuggestions([dm], programs)[0].resolved).toBe(false);
    expect(openSuggestions([dm], [...programs, { code: 'DM', status: 'Enrolled' }])[0].resolved).toBe(true);
    expect(openSuggestions([dm], [...programs, { code: 'DM', status: 'Closed' }])[0].resolved).toBe(false);
  });

  it('words each button and finds the step it opens', () => {
    const step = suggestionAction(william.find(r => r.id === 'pes-11143-efax'), programs, stepsOf);
    expect(step).toMatchObject({ kind: 'step', label: 'Open Program Documents', stepId: 'tocip-docs' });
    expect(step.program.id).toBe('p1');
    expect(suggestionAction(william.find(r => r.id === 'pes-11143-lab'), programs, stepsOf).label).toBe('Enroll in DM');
    expect(suggestionAction(william.find(r => r.id === 'pes-11143-imaging'), programs, stepsOf).label).toBe('Create Task');
    expect(suggestionAction({ action: { type: 'review' } }, programs).label).toBe('Mark Reviewed');
  });

  it('holds a step button until its program is open', () => {
    const a = suggestionAction(william.find(r => r.id === 'pes-11143-adt'), [{ code: 'TOC IP', status: 'Closed' }], stepsOf);
    expect(a).toMatchObject({ disabled: true, hint: "TOC IP isn't open for this patient" });
  });
});

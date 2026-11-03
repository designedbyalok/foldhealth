import { describe, it, expect } from 'vitest';
import { formatStatusReason, statusReasonRequired, statusReasonsFor } from './gbiStatusReasons';

describe('GBI status reasons', () => {
  it('requires a reason for closing, Discontinued and On Hold', () => {
    for (const s of ['Met', 'Resolved', 'Discontinued', 'On Hold']) expect(statusReasonRequired(s)).toBe(true);
    for (const s of ['In Progress', 'Not Started', 'Not Met', 'UTR']) expect(statusReasonRequired(s)).toBe(false);
  });

  it('offers status-specific reasons', () => {
    expect(statusReasonsFor('Discontinued')).toEqual(expect.arrayContaining(['Patient refused', 'Replaced by new goal']));
    expect(statusReasonsFor('Met')).toContain('Goal met');
    expect(statusReasonsFor('Unknown')).toEqual([]);
  });

  it('formats reason and note for the badge', () => {
    expect(formatStatusReason({ reason: 'Patient refused', note: 'Prefers to wait until spring' })).toBe('Patient refused: Prefers to wait until spring');
    expect(formatStatusReason({ reason: 'Goal met' })).toBe('Goal met');
    expect(formatStatusReason({})).toBe('');
  });
});

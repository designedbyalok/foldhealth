import { describe, expect, it } from 'vitest';
import { CLOSURE_REASONS, PROGRAM_STATUS_OPTIONS, closureReasonLabel, isProgramClosed, statusColorFor } from './programStatus';

describe('program status', () => {
  it('lists outreach and lifecycle states in one list', () => {
    expect(PROGRAM_STATUS_OPTIONS).toEqual([
      'New', 'Engaged', 'Attempted', 'Unable to Reach', 'Declined', 'Enrolled',
      'Active', 'Paused', 'Completed', 'Discontinued', 'Re-enrolled',
    ]);
    expect(PROGRAM_STATUS_OPTIONS.every(s => statusColorFor(s).startsWith('var('))).toBe(true);
  });

  it('treats Completed, Discontinued and the older Closed as ended', () => {
    expect(['Completed', 'Discontinued', 'Closed'].every(isProgramClosed)).toBe(true);
    expect(['Paused', 'Active', 'Re-enrolled', 'New'].some(isProgramClosed)).toBe(false);
  });

  it('maps closure reasons to an ending status', () => {
    expect(CLOSURE_REASONS.find(r => r.value === 'goal_met').status).toBe('Completed');
    expect(CLOSURE_REASONS.filter(r => r.value !== 'goal_met').every(r => r.status === 'Discontinued')).toBe(true);
    expect(closureReasonLabel('opt_out')).toBe('Patient opted out');
    expect(closureReasonLabel('nope')).toBeNull();
  });
});

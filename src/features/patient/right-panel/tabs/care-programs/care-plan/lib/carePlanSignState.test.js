import { describe, expect, it } from 'vitest';
import { carePlanAwaitingSignature } from './carePlanSignState';

const plan = (fields, goals = []) => ({ plan: { id: 'p1', ...fields }, goals, interventions: [], barriers: [] });

describe('carePlanAwaitingSignature', () => {
  it('is false until the plan is completed', () => {
    expect(carePlanAwaitingSignature(plan({}))).toBe(false);
    expect(carePlanAwaitingSignature(null)).toBe(false);
  });

  it('waits for a signature after completing', () => {
    expect(carePlanAwaitingSignature(plan({ completedAt: '2026-11-10T10:00:00Z' }))).toBe(true);
    // Signed before this completion: still waiting on the new one.
    expect(carePlanAwaitingSignature(plan({ completedAt: '2026-11-10T10:00:00Z', signedAt: '2026-10-01T10:00:00Z' }))).toBe(true);
  });

  it('ends once signed at or after completing', () => {
    expect(carePlanAwaitingSignature(plan({ completedAt: '2026-11-10T10:00:00Z', signedAt: '2026-11-10T11:00:00Z' }))).toBe(false);
  });

  it('ends when a goal, intervention or barrier changes after completing, not when the plan row does', () => {
    const at = '2026-11-10T10:00:00Z';
    expect(carePlanAwaitingSignature(plan({ completedAt: at }, [{ id: 'g1', updatedAt: '2026-11-10T10:05:00Z' }]))).toBe(false);
    expect(carePlanAwaitingSignature(plan({ completedAt: at }, [{ id: 'g1', updatedAt: '2026-11-10T09:00:00Z' }]))).toBe(true);
    expect(carePlanAwaitingSignature(plan({ completedAt: at, updatedAt: '2026-11-10T10:00:01Z' }))).toBe(true);
  });
});

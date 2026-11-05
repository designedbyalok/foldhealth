import { describe, it, expect, vi } from 'vitest';
import { isSampled, sampledForReviewer2, DEFAULT_SAMPLING_RATES, validateAsmReadinessConfig } from './sampling';

describe('isSampled', () => {
  it('is deterministic for the same composite key', () => {
    const a = isSampled('P1', '01/10/2026', 'Dr. Karen Mills', '11', 0.5);
    const b = isSampled('P1', '01/10/2026', 'Dr. Karen Mills', '11', 0.5);
    expect(a).toBe(b);
  });

  it('two DOS sharing a date but differing provider/POS can get independent outcomes', () => {
    // Not every pair will differ at every rate, but the hash input must
    // include provider/pos: verify the seed actually changes by checking
    // a rate of 1 (always true) vs 0 (always false) don't mask this, and
    // that differing composite keys are at least capable of diverging by
    // sampling a spread of synthetic POS values and confirming not all
    // outcomes are identical.
    const outcomes = new Set(
      ['11', '02', '12', '21', '31', '41'].map(pos => isSampled('P1', '01/10/2026', 'Dr. X', pos, 0.5)),
    );
    expect(outcomes.size).toBeGreaterThan(1);
  });

  it('rate <= 0 never samples; rate >= 1 always samples', () => {
    expect(isSampled('P1', '01/10/2026', 'Dr. X', '11', 0)).toBe(false);
    expect(isSampled('P1', '01/10/2026', 'Dr. X', '11', 1)).toBe(true);
  });
});

describe('sampledForReviewer2', () => {
  it('uses DEFAULT_SAMPLING_RATES.reviewer2 when no override is passed', () => {
    const result = sampledForReviewer2('P1', '01/10/2026', 'Dr. X', '11');
    expect(typeof result).toBe('boolean');
  });

  it('DEFAULT_SAMPLING_RATES has exactly one gate, reviewer2, no reviewer3', () => {
    expect(DEFAULT_SAMPLING_RATES).toEqual({ reviewer2: 0.10 });
  });
});

describe('validateAsmReadinessConfig: Phase 0 (WR7) guard', () => {
  it('is a dormant no-op when minReviewsBeforeAsm is unset (default state today)', () => {
    expect(validateAsmReadinessConfig({})).toEqual({ ok: true });
    expect(validateAsmReadinessConfig()).toEqual({ ok: true });
  });

  it('flags the WR7 conflict when minReviewsBeforeAsm is on but sampling is still ~10%', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = validateAsmReadinessConfig({ minReviewsBeforeAsm: true, samplingRates: { reviewer2: 0.10 } });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/WR7/);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('passes once sampling is raised to effectively 100%', () => {
    const result = validateAsmReadinessConfig({ minReviewsBeforeAsm: true, samplingRates: { reviewer2: 1 } });
    expect(result).toEqual({ ok: true });
  });
});

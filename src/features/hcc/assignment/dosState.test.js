import { describe, it, expect } from 'vitest';
import { dosKey, parseDosKey, blankDosState } from './dosState';

describe('dosKey', () => {
  it('builds a 4-part composite key: Patient ID + DOS + Provider + POS', () => {
    expect(dosKey('P1', '01/10/2026', 'Dr. Karen Mills', '11')).toBe('P1::01/10/2026::Dr. Karen Mills::11');
  });

  it('two DOS sharing a date but differing provider/POS never collapse into the same key', () => {
    const a = dosKey('P1', '01/10/2026', 'Dr. Karen Mills', '11');
    const b = dosKey('P1', '01/10/2026', 'Dr. Helen Yu', '02');
    expect(a).not.toBe(b);
  });

  it('falls back to a sentinel for missing provider/pos rather than emitting undefined', () => {
    expect(dosKey('P1', '01/10/2026')).toBe('P1::01/10/2026::-::-');
  });
});

describe('parseDosKey', () => {
  it('round-trips with dosKey', () => {
    const key = dosKey('P1', '01/10/2026', 'Dr. Karen Mills', '11');
    expect(parseDosKey(key)).toEqual({
      patientId: 'P1',
      dosDate: '01/10/2026',
      renderingProvider: 'Dr. Karen Mills',
      pos: '11',
    });
  });

  it('parses sentinel values back to null', () => {
    const key = dosKey('P1', '01/10/2026');
    expect(parseDosKey(key)).toEqual({
      patientId: 'P1',
      dosDate: '01/10/2026',
      renderingProvider: null,
      pos: null,
    });
  });
});

describe('blankDosState', () => {
  it('has exactly four roles, support, coder, reviewer, reviewer2, no reviewer3', () => {
    const state = blankDosState('P1', '01/10/2026', 'Dr. Karen Mills', '11');
    expect(Object.keys(state)).toEqual(
      expect.arrayContaining(['support', 'coder', 'reviewer', 'reviewer2']),
    );
    expect(state.r3).toBeUndefined();
    expect(state.reviewer3).toBeUndefined();
  });

  it('carries the composite-key identity fields', () => {
    const state = blankDosState('P1', '01/10/2026', 'Dr. Karen Mills', '11');
    expect(state.renderingProvider).toBe('Dr. Karen Mills');
    expect(state.pos).toBe('11');
  });

  it('sampling tracks only the single remaining gate (reviewer2)', () => {
    const state = blankDosState('P1', '01/10/2026');
    expect(state.sampling).toEqual({ reviewer2: null });
  });
});

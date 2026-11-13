import { describe, expect, it } from 'vitest';
import { unsupportedClaims } from './draftClaims';

describe('unsupportedClaims', () => {
  it('flags a completed action the notes do not mention', () => {
    const body = 'Hi Gloria, your ride is confirmed with MTM. See you soon.';
    expect(unsupportedClaims(body, 'Ask about the ride to the 11/18 visit')).toEqual([
      { sentence: 'Hi Gloria, your ride is confirmed with MTM.', reason: 'says “confirmed”, but your notes don’t' },
    ]);
  });

  it('splits paragraphs that arrive joined', () => {
    const [claim] = unsupportedClaims('Your ride is confirmed.Warm regards,', '');
    expect(claim.sentence).toBe('Your ride is confirmed.');
  });

  it('flags a date or time the notes do not give', () => {
    const [claim] = unsupportedClaims('We can see you on 11/18 at 2:30 PM.', 'Offer a follow-up visit');
    expect(claim.reason).toContain('11/18');
  });

  it('passes intent and facts the notes support', () => {
    const notes = 'Ride confirmed with MTM for 11/18 at 9:45 am. Visit booked with Dr. Moss.';
    expect(unsupportedClaims('Your ride is confirmed for 11/18 at 9:45 am, and your visit with Dr. Moss is booked.', notes)).toEqual([]);
    expect(unsupportedClaims('We are arranging a ride and will call you to find a time.', '')).toEqual([]);
  });
});

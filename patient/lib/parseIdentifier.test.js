import { describe, expect, it } from 'vitest';
import { parseIdentifier } from './parseIdentifier';

describe('parseIdentifier', () => {
  it('reads an email, lowercased and trimmed', () => {
    expect(parseIdentifier('  Nathan@Patient.com ')).toEqual({ email: 'nathan@patient.com' });
  });

  it('treats a formatted 10-digit number as US', () => {
    expect(parseIdentifier('(273) 377-3888')).toEqual({ phone: '+12733773888' });
  });

  it('keeps an international number as given', () => {
    expect(parseIdentifier('+44 7700 900123')).toEqual({ phone: '+447700900123' });
  });

  it('rejects anything else', () => {
    expect(parseIdentifier('nathan')).toBeNull();
    expect(parseIdentifier('12345')).toBeNull();
    expect(parseIdentifier('')).toBeNull();
  });
});

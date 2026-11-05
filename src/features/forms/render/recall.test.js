import { describe, it, expect } from 'vitest';
import { resolveRecall, hasRecall } from './recall';

describe('hasRecall', () => {
  it('detects tokens cheaply', () => {
    expect(hasRecall('Hi {{field:name}}')).toBe(true);
    expect(hasRecall('Hi there')).toBe(false);
    expect(hasRecall(undefined)).toBe(false);
  });
});

describe('resolveRecall', () => {
  const ctx = {
    answers: { name: 'Jane', langs: ['EN', 'ES'], ok: true },
    scores: { phq9: 14 },
    hidden: { mrn: 'A123' },
  };

  it('interpolates field / score / hidden tokens', () => {
    expect(resolveRecall('Hi {{field:name}}, MRN {{hidden:mrn}}, PHQ-9 {{score:phq9}}', ctx))
      .toBe('Hi Jane, MRN A123, PHQ-9 14');
  });
  it('supports the {{var:…}} alias for scores', () => {
    expect(resolveRecall('Total: {{var:phq9}}', ctx)).toBe('Total: 14');
  });
  it('joins arrays and humanizes booleans', () => {
    expect(resolveRecall('{{field:langs}} / {{field:ok}}', ctx)).toBe('EN, ES / Yes');
  });
  it('unknown / unanswered tokens → empty string', () => {
    expect(resolveRecall('Hi {{field:missing}}!', ctx)).toBe('Hi !');
  });
  it('falls back to answers for hidden names', () => {
    expect(resolveRecall('{{hidden:name}}', ctx)).toBe('Jane');
  });
  it('returns non-token text untouched', () => {
    expect(resolveRecall('No tokens here', ctx)).toBe('No tokens here');
    expect(resolveRecall('', ctx)).toBe('');
  });
});

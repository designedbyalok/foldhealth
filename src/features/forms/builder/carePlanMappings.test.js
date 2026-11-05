import { describe, expect, it } from 'vitest';
import { INSTRUMENTS, instantiateInstrument } from './validatedInstruments';
import { answerFields, bandsInRange, mappingIssue, newMapping } from './carePlanMappings';

const { field, score } = instantiateInstrument(INSTRUMENTS.find((i) => i.key === 'phq9'));
const fields = [field];
const scores = [score];
const templates = [{ id: 't-depression', name: 'Depression' }];
const q9 = answerFields(fields).find((f) => f.code === 'q9');
const ctx = { scores, fields, templates };

describe('answerFields', () => {
  it('finds the questions nested inside an instrument group', () => {
    expect(answerFields(fields)).toHaveLength(9);
  });
});

describe('newMapping', () => {
  it('defaults a score rule to the first score, open-ended', () => {
    expect(newMapping('score', ctx)).toMatchObject({ kind: 'score', scoreId: score.id, min: null, max: null, templateIds: [] });
  });
  it('defaults an answer rule to the first question', () => {
    expect(newMapping('answer', ctx)).toMatchObject({ kind: 'answer', linkId: answerFields(fields)[0].linkId, values: [] });
  });
});

describe('bandsInRange', () => {
  it('lists the PHQ-9 bands at or above 10', () => {
    expect(bandsInRange(score, 10, null)).toEqual(['Moderate', 'Moderately severe', 'Severe']);
  });
  it('includes a band the range only partly overlaps', () => {
    expect(bandsInRange(score, 3, 6)).toEqual(['Minimal', 'Mild']);
  });
});

describe('mappingIssue', () => {
  const phq9AtLeast10 = { kind: 'score', scoreId: score.id, min: 10, max: null, templateIds: ['t-depression'] };

  it('accepts PHQ-9 >= 10 → Depression', () => {
    expect(mappingIssue(phq9AtLeast10, ctx)).toBeNull();
  });
  it('needs a bound', () => {
    expect(mappingIssue({ ...phq9AtLeast10, min: null }, ctx)).toMatch(/minimum or maximum/);
  });
  it('rejects min above max', () => {
    expect(mappingIssue({ ...phq9AtLeast10, max: 5 }, ctx)).toMatch(/above maximum/);
  });
  it('needs a known score', () => {
    expect(mappingIssue({ ...phq9AtLeast10, scoreId: 'gone' }, ctx)).toMatch(/score/);
  });
  it('needs a template', () => {
    expect(mappingIssue({ ...phq9AtLeast10, templateIds: [] }, ctx)).toMatch(/template/);
  });
  it('flags a template no longer in the library', () => {
    expect(mappingIssue({ ...phq9AtLeast10, templateIds: ['t-old'] }, ctx)).toMatch(/deleted/);
  });
  it('accepts an answer rule on a real option', () => {
    expect(mappingIssue({ kind: 'answer', linkId: q9.linkId, values: ['Several days'], templateIds: ['t-depression'] }, ctx)).toBeNull();
  });
  it('flags an answer that was renamed away', () => {
    expect(mappingIssue({ kind: 'answer', linkId: q9.linkId, values: ['Sometimes'], templateIds: ['t-depression'] }, ctx)).toMatch(/no longer exists/);
  });
  it('needs at least one answer', () => {
    expect(mappingIssue({ kind: 'answer', linkId: q9.linkId, values: [], templateIds: ['t-depression'] }, ctx)).toMatch(/at least one/);
  });
});

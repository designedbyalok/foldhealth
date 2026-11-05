import { describe, expect, it } from 'vitest';
import { findPassageItems } from './findPassage';

const items = ['Hypertensive Crisis', '>180/120 Hypertensive crisis', '1. Assess for symptoms that indicate end-organ damage:.', 'a. If chest pain, obtain EKG -> if STEMI, call 911', 'Unrelated footer']
  .map(str => ({ str }));

describe('findPassageItems', () => {
  it('finds a passage across items, ignoring spacing, case and punctuation', () => {
    expect(findPassageItems(items, 'Assess for symptoms that indicate end organ damage. A. If chest pain, obtain EKG')).toEqual([2, 3]);
  });

  it('falls back to the longest leading part that matches', () => {
    expect(findPassageItems(items, 'If chest pain, obtain EKG, then something the page never says at all')).toEqual([3]);
  });

  it('finds nothing for short or absent passages', () => {
    expect(findPassageItems(items, 'EKG')).toEqual([]);
    expect(findPassageItems(items, 'Lisinopril 10 mg daily for everyone')).toEqual([]);
    expect(findPassageItems(null, 'Assess for symptoms')).toEqual([]);
  });
});

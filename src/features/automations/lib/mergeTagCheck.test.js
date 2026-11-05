import { describe, expect, it } from 'vitest';
import { unknownMergeTags } from './mergeTagCheck';

describe('unknownMergeTags', () => {
  it('passes known tokens in both brace styles', () => {
    expect(unknownMergeTags('Hi {{first_name}}, from {{ clinic_name }} and {Patient Name}')).toEqual([]);
  });
  it('flags tokens the engine can’t resolve and bracket placeholders', () => {
    expect(unknownMergeTags('Your appointment with {Dr. Name} on [Date] at [Clinic/Hospital Name]')).toEqual(['Dr. Name', 'Date', 'Clinic/Hospital Name']);
  });
  it('ignores CSS braces', () => {
    expect(unknownMergeTags('<style>p{margin:0}</style>')).toEqual([]);
  });
});

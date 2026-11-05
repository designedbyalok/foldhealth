import { describe, expect, it } from 'vitest';
import { programForLastKey } from './CareProgramsTab.utils';

const programs = [
  { id: 1, code: 'SNP', trigger: 1, status: 'Enrolled' },
  { id: 2, code: 'SNP', trigger: 2, status: 'Engaged' },
  { id: 3, code: 'TOC IP', trigger: 1, status: 'Closed' },
  { id: 4, code: 'CCM', trigger: 1, status: 'New' },
];

describe('programForLastKey', () => {
  it('reopens the same enrollment when the patient has it', () => {
    expect(programForLastKey(programs, 'snp-2').id).toBe(2);
    expect(programForLastKey(programs, 'ccm').id).toBe(4);
  });

  it('falls back to an open program with the same code', () => {
    expect(programForLastKey(programs, 'snp-5').id).toBe(1);
  });

  it('skips closed programs and unknown or empty keys', () => {
    expect(programForLastKey(programs, 'toc-ip')).toBeNull();
    expect(programForLastKey(programs, 'bhi')).toBeNull();
    expect(programForLastKey(programs, null)).toBeNull();
  });
});

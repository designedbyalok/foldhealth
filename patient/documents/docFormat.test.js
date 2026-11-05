import { describe, expect, it } from 'vitest';
import { categoryLabel, uploadPath, uploadProblem } from './docFormat';

describe('docFormat', () => {
  it('labels folders, falling back to Others', () => {
    expect(categoryLabel('lab')).toBe('Lab Reports');
    expect(categoryLabel('nope')).toBe('Others');
  });

  it('checks type and size before uploading', () => {
    expect(uploadProblem({ type: 'application/pdf', size: 1000 })).toBeNull();
    expect(uploadProblem({ type: 'application/zip', size: 1000 })).toMatch(/PDF/);
    expect(uploadProblem({ type: 'image/png', size: 11 * 1024 * 1024 })).toMatch(/10 MB/);
  });

  it('keeps uploads in the patient folder with a safe name', () => {
    expect(uploadPath('11048', '../My scan (1).pdf', 'abc')).toBe('patient-uploads/11048/abc-.._My_scan_1_.pdf');
  });
});

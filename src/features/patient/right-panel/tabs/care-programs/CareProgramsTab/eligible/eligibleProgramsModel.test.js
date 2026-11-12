import { describe, expect, it } from 'vitest';
import { eligibleRows } from './eligibleProgramsModel';
import { PROGRAM_ELIGIBILITY } from '../../../../../data/programEligibilitySeed';

const catalog = [{ code: 'DM', name: 'Disease Management' }, { code: 'HICM', name: 'High Intensity Care Management' }, { code: 'AWV', name: 'Annual Wellness Visit' }];
const william = PROGRAM_ELIGIBILITY.filter(r => r.memberId === '11143');

describe('eligible programs', () => {
  it('names each program from the catalog and drops codes it does not have', () => {
    const rows = eligibleRows(william, { catalog: catalog.slice(0, 2) });
    expect(rows.map(r => r.code)).toEqual(['DM', 'HICM']);
    expect(rows[0].name).toBe('Disease Management');
  });

  it('hides a program the patient is already in, but not one that ended', () => {
    const rows = eligibleRows(william, { catalog, programs: [{ code: 'DM', status: 'Enrolled' }, { code: 'AWV', status: 'Completed' }] });
    expect(rows.map(r => r.code)).toEqual(['HICM', 'AWV']);
  });

  it('says whether consent is still needed', () => {
    const [dm] = eligibleRows(william, { catalog });
    expect(typeof dm.consentOk).toBe('boolean');
    expect(dm.consent).toMatch(/consent/i);
  });
});

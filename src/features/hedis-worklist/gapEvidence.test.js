import { describe, expect, it } from 'vitest';
import { evidenceSummary, gapEvidence } from './gapEvidence';

const older = { code: 'BCS', status: 'Completed', startDate: '09/15/2026', closedDate: '10/10/2026' };
const latest = { code: 'BCS', status: 'Completed', startDate: '10/20/2026', closedDate: '11/05/2026', source: 'fold-native' };
const sources = {
  memberId: 'ph-1',
  notes: [
    { status: 'signed', gapCodes: ['BCS'], signedAt: '2026-10-01T10:00:00Z', signedByName: 'Dr. Lee' },
    { status: 'draft', gapCodes: ['BCS'], signedAt: null },
  ],
  labResults: [],
  documents: [{ id: 'cgdoc-1', patientId: 'ph-1', programCode: 'BCS', name: 'mammogram.pdf', createdAt: '2026-11-02T09:00:00Z' }],
};

describe('gapEvidence', () => {
  it('gives each instance the evidence from its own window', () => {
    expect(gapEvidence(older, sources).map(e => e.kind)).toEqual(['note']);
    expect(gapEvidence(latest, sources).map(e => e.kind)).toEqual(['document']);
  });
  it('falls back to claim data for a claim gap completed with nothing in Fold', () => {
    expect(gapEvidence({ code: 'COL', status: 'Completed' }, sources)).toEqual([{ kind: 'claim', date: null, label: 'Claim data' }]);
    expect(gapEvidence({ code: 'COL', status: 'Open' }, sources)).toEqual([]);
  });
  it('summarises the latest item and the count of the rest', () => {
    expect(evidenceSummary(gapEvidence(older, sources))).toMatch(/^Evidence: Clinical note signed by Dr\. Lee, 10\/0[1-2]\/2026$/);
    expect(evidenceSummary([])).toBe('');
  });
});

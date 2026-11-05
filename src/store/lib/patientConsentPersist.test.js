import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase', () => ({ supabase: {} }));
vi.mock('./reportPersistFailure', () => ({ reportPersistFailure: () => {} }));
const { consentFromRow, consentToRow, preferencesFromRow } = await import('./patientConsentPersist');

describe('patient consent rows', () => {
  it('round-trips a consent record', () => {
    const consent = {
      id: 'pc-1', patientId: '11089', scopeType: 'program', scope: 'CCM', status: 'given', method: 'e_sign',
      capturedBy: 'Dana Lee', capturedByRole: 'Care Coordinator', capturedAt: '2026-10-23T10:00:00.000Z',
      effectiveOn: '2026-10-23', expiresOn: null, witness: null, artifactPath: '11089/pc-1.png',
      artifactKind: 'signature', note: null, programId: 'pcp-11089-CCM',
    };
    expect(consentFromRow(consentToRow(consent))).toEqual(consent);
  });

  it('gives empty preferences when the patient has no row', () => {
    expect(preferencesFromRow(null)).toEqual({
      channelByProgram: {}, preferredLanguage: null, needsInterpreter: false, healthLiteracy: 'unknown',
      contactPoints: [], updatedBy: null, updatedAt: null,
    });
  });
});

import harbor from './harborHypertensionProtocol.json';

/* Sample protocol for the library: the synthetic Harbor Health hypertension
   guidance (harborHypertensionGuidance.txt) as the parser extracted it,
   approved. Seeded into clinical_protocols by scripts/seed.js; shown
   read-only when the table doesn't exist yet. */

export const HARBOR_HYPERTENSION_ID = '5f1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
export const HARBOR_HYPERTENSION_TEXT_FILE = 'harborHypertensionGuidance.txt';

const m = harbor.metadata;

export const SAMPLE_PROTOCOLS = [{
  id: HARBOR_HYPERTENSION_ID,
  title: m.title,
  organization: m.organization || '',
  conditions: m.conditions,
  programCodes: m.programCodes,
  effectiveDate: m.effectiveDate,
  reviewDate: m.reviewDate,
  author: m.author || '',
  version: m.version || '',
  status: 'active',
  sourceKind: 'pdf',
  sourceName: 'HH-CPG-CV-004 Hypertension Clinical Practice Guidance.pdf',
  sourcePath: null,
  sourceSize: null,
  protocol: harbor.protocol,
  parseMeta: { via: 'ai', model: harbor.model, parsedAt: '2026-10-27T15:00:00.000Z', warnings: harbor.warnings, pages: 2, sample: true },
  parseError: null,
  supersedesId: null,
  uploadedBy: 'Fold Demo',
  approvedBy: 'Fold Demo',
  approvedAt: '2026-10-27T15:30:00.000Z',
  createdAt: '2026-10-27T15:00:00.000Z',
  updatedAt: '2026-10-27T15:30:00.000Z',
}];

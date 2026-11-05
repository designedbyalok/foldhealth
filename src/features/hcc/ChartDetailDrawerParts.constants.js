// Reasons offered when marking a document Failed. Mirrors the Figma spec
// on ICD-Import 4806:142581, the canonical HCC review vocabulary used by
// the Support team when a chart document can't be accepted as evidence.
export const FAIL_REASONS = [
  'Missing signature',
  'Wrong document type',
  'Illegible document',
  'Incomplete fields',
  'Document belongs to wrong patient',
  'Document outside valid date range',
  'Progress Note/Attachment Not available',
  'DOS Not Charted',
  'Provider Name Not Printed',
  'POS Not Available',
  'Other',
];

// DOS-level reasons for marking the whole record Insufficient. A tighter
// subset of FAIL_REASONS: the record-level vocabulary is narrower than the
// per-document one because doc-only reasons ("DOS Not Charted", "POS Not
// Available", …) don't apply once you're grading the DOS as a whole.
export const INSUFFICIENT_REASONS = [
  'Document belongs to wrong patient',
  'Document outside valid date range',
  'Illegible document',
  'Incomplete fields',
  'Missing signature',
  'Wrong document type',
  'Other',
];

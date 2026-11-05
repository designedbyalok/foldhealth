// DOS-source classifier: shared by the worklist source badge
// (HccWorklistRow) and the "DOS Source" filter (filters.js) so both agree on
// which source (D=Clinical Document, C=Claims, M=Manual Entry) a given DOS
// maps to.
//
// The three sources are MUTUALLY EXCLUSIVE, a DOS is either extracted from
// a document, matched from a claim, or manually entered by a user; never
// more than one. The classifier resolves that by reading a persisted
// `source` field on the DOS entry when present, and falls back to a
// deterministic date hash (legacy demo rows without a source field) for
// everything else.
//
// Manual entries MUST be tagged explicitly via `source === 'manual'`, the
// legacy hash pool omits `M` so a row without the tag can never accidentally
// classify as manual.

export const DOS_SOURCES = ['D', 'C', 'M'];

// Legacy hash pool: Manual is reserved for entries with an explicit
// `source: 'manual'` marker, so it never appears in the fallback pool.
const LEGACY_HASH_POOL = ['D', 'C'];
const LEGACY_HASH_POOL_NO_DOC = ['C']; // no document → only claims possible

const SOURCE_KEY_TO_LETTER = { document: 'D', claim: 'C', manual: 'M' };

/**
 * Classify a DOS to a source letter (D=Document, C=Claim, M=Manual).
 *
 * Accepts either a DOS entry object (preferred: its persisted `source`
 * wins) or a plain date string (legacy call sites: falls back to the
 * deterministic hash over D/C).
 *
 * @param {object|string} entryOrDate DOS entry ({ date, source, ... }) or a
 *                                    bare date string.
 * @param {boolean} hasDoc            Whether the member has any document on
 *                                    file. Only consulted for the legacy
 *                                    hash fallback: when false, 'D' is
 *                                    excluded (a DOS cannot be
 *                                    document-sourced with nothing on file).
 */
export function dosSourceLetter(entryOrDate, hasDoc = true) {
  // Explicit source wins: the entry was authored with a known provenance.
  if (entryOrDate && typeof entryOrDate === 'object') {
    const letter = SOURCE_KEY_TO_LETTER[entryOrDate.source];
    if (letter) return letter;
    // Back-compat: rows written before we started stamping `source: 'manual'`
    // carry only the display label. Treat that as manual so the badge stays
    // correct without a data migration.
    if (entryOrDate.label === 'Manually Added') return 'M';
  }
  const date = typeof entryOrDate === 'string' ? entryOrDate : entryOrDate?.date;
  let h = 0;
  const s = String(date || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  const pool = hasDoc ? LEGACY_HASH_POOL : LEGACY_HASH_POOL_NO_DOC;
  return pool[Math.abs(h) % pool.length];
}

// What each DOS-source letter means: drives the badge colour + the hover
// tooltip (source of the encounter) and the filter option labels.
export const DOS_SOURCE_META = {
  D: { cls: 'srcDoc',    label: 'Clinical Document', hint: 'Extracted from an uploaded document' },
  C: { cls: 'srcClaims', label: 'Claims',            hint: 'Claims document from Astrana' },
  M: { cls: 'srcManual', label: 'Manual Entry',      hint: 'Added manually by a coder' },
};

// Canonical DOS Source filter labels, in D/C/M order.
export const DOS_SOURCE_LABELS = DOS_SOURCES.map(l => DOS_SOURCE_META[l].label);

// Reverse map: filter label → the source letter it represents.
export const DOS_SOURCE_LABEL_TO_LETTER = Object.fromEntries(
  DOS_SOURCES.map(l => [DOS_SOURCE_META[l].label, l]),
);

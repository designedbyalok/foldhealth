/**
 * HCC document row mapper.
 *
 * Translates a Supabase `hcc_documents` row to/from the JS shape the
 * HccSftpReviewDrawer and the rest of the upload flow consume (live in
 * the Zustand `hccSftpBatches` slice: see useAppStore.js).
 *
 * Keep this in lockstep with supabase/hcc_documents_migration.sql.
 */

export function hccDocumentRowToJs(row) {
  return {
    id: row.id,
    fileName: row.file_name,
    ocrTier: row.ocr_tier,
    compliance: row.compliance || null,
    encounters: row.encounters || [],
    source: row.source || null,
    status: row.status || 'done',
    ingestedAt: row.ingested_at || row.created_at,
  };
}

export function hccDocumentJsToDb(b) {
  return {
    id: b.id,
    file_name: b.fileName,
    ocr_tier: b.ocrTier,
    compliance: b.compliance || null,
    encounters: b.encounters || [],
    source: b.source || null,
    status: b.status || 'done',
    ingested_at: b.ingestedAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

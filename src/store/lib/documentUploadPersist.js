import { supabase } from '../../lib/supabase';
import { addedChartToRow } from '../../lib/hccAddedChartsMapper';
import { reportPersistFailure } from './reportPersistFailure';

function extOf(filename) {
  const m = /\.([a-z0-9]+)$/i.exec(filename || '');
  return m ? m[1].toLowerCase() : null;
}

/** Push chart bytes to Storage and insert `hcc_added_charts` (fire-and-forget). */
export async function persistHccAddedChart(memberId, doc, file) {
  if (!memberId || !doc) return;
  let pdfUrl = doc.pdf && /^https?:/i.test(doc.pdf) ? doc.pdf : null;
  let storagePath = null;
  try {
    if (file) {
      const path = `${memberId}/${doc.id}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from('chart-uploads')
        .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: true });
      if (upErr) {
        reportPersistFailure(`persistHccAddedChart.upload(${doc.id})`, upErr);
      } else {
        storagePath = path;
        pdfUrl = supabase.storage.from('chart-uploads').getPublicUrl(path).data.publicUrl;
      }
    }
    const { error } = await supabase
      .from('hcc_added_charts')
      .insert(addedChartToRow(memberId, { ...doc, pdf: pdfUrl, storagePath }));
    if (error) reportPersistFailure(`persistHccAddedChart.insert(${doc.id})`, error);
  } catch (e) {
    reportPersistFailure(`persistHccAddedChart(${doc.id})`, e || { message: 'unknown' });
  }
}

/** Push program doc bytes to Storage and insert `program_documents` (fire-and-forget). */
export async function persistProgramDocument(doc, file) {
  if (!doc?.id) return;
  let fileUrl = null;
  let storagePath = null;
  try {
    if (file) {
      const path = `${doc.programCode || 'unscoped'}/${doc.patientId || 'unscoped'}/${doc.id}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from('program-documents')
        .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: true });
      if (upErr) {
        reportPersistFailure(`persistProgramDocument.upload(${doc.id})`, upErr);
      } else {
        storagePath = path;
        fileUrl = supabase.storage.from('program-documents').getPublicUrl(path).data.publicUrl;
      }
    }
    const { error } = await supabase.from('program_documents').insert({
      id:           doc.id,
      program_code: doc.programCode,
      patient_id:   doc.patientId,
      name:         doc.name,
      type:         doc.type,
      status:       doc.status,
      size_bytes:   doc.sizeBytes,
      updated_by:   doc.updatedBy,
      updated_date: doc.updatedDate,
      file_url:     fileUrl,
      storage_path: storagePath,
      ext:          extOf(file?.name || doc.name),
      // Only patient Documents tab uploads send it, so program uploads keep
      // working before program_documents_category_migration.sql runs.
      ...(doc.category ? { category: doc.category } : {}),
    });
    if (error) reportPersistFailure(`persistProgramDocument.insert(${doc.id})`, error);
  } catch (e) {
    reportPersistFailure(`persistProgramDocument(${doc.id})`, e || { message: 'unknown' });
  }
}

/** Patch a `program_documents` row's metadata (fire-and-forget). */
export async function persistProgramDocumentUpdate(id, patch) {
  if (!id || !patch) return;
  const row = {};
  if ('name' in patch) row.name = patch.name;
  if ('type' in patch) row.type = patch.type;
  if ('updatedBy' in patch) row.updated_by = patch.updatedBy;
  if ('updatedDate' in patch) row.updated_date = patch.updatedDate;
  // Patient app visibility (supabase/patient_documents_migration.sql).
  if ('sharedWithPatient' in patch) row.shared_with_patient = !!patch.sharedWithPatient;
  if ('sharedBy' in patch) row.shared_by = patch.sharedBy;
  if ('sharedAt' in patch) row.shared_at = patch.sharedAt;
  if (Object.keys(row).length === 0) return;
  const { error } = await supabase.from('program_documents').update(row).eq('id', id);
  if (error) reportPersistFailure(`persistProgramDocumentUpdate(${id})`, error);
}

/** Delete a `program_documents` row and its Storage object (fire-and-forget). */
export async function persistProgramDocumentDelete(id, storagePath) {
  if (!id) return;
  try {
    if (storagePath) {
      const { error: rmErr } = await supabase.storage.from('program-documents').remove([storagePath]);
      if (rmErr) reportPersistFailure(`persistProgramDocumentDelete.storage(${id})`, rmErr);
    }
    const { error } = await supabase.from('program_documents').delete().eq('id', id);
    if (error) reportPersistFailure(`persistProgramDocumentDelete(${id})`, error);
  } catch (e) {
    reportPersistFailure(`persistProgramDocumentDelete(${id})`, e || { message: 'unknown' });
  }
}

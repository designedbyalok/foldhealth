import { generateCarePlanPdf } from './generateCarePlanPdf';

/**
 * One care plan PDF for one or more versions, printed back to back (newest
 * first). Each part is the normal care plan for that version; pdf-lib joins
 * them because jsPDF can't append to a finished document.
 *
 * @param {Array<{ meta: object, selection: object }>} parts
 * @param {object} options – generateCarePlanPdf options, shared by every part
 * @returns {Promise<Blob>} with `pageCount` (the first part's, which drives
 *   the "Page x of y" header redraw)
 */
export async function buildCarePlanVersionsPdf(parts, options) {
  const blobs = parts.map(p => generateCarePlanPdf(p.meta, p.selection, options));
  if (blobs.length === 1) return blobs[0];
  const { PDFDocument } = await import('pdf-lib');
  // Parse every part at once; copy pages in part order so versions stay sequential.
  const [out, sources] = await Promise.all([
    PDFDocument.create(),
    Promise.all(blobs.map(async (blob) => PDFDocument.load(await blob.arrayBuffer()))),
  ]);
  const copied = await Promise.all(sources.map(src => out.copyPages(src, src.getPageIndices())));
  copied.flat().forEach(page => out.addPage(page));
  const merged = new Blob([await out.save()], { type: 'application/pdf' });
  merged.pageCount = blobs[0].pageCount;
  return merged;
}

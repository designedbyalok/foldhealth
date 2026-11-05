import { fmtDate, seriesStartDate } from './cisStatusConfig';

// jsPDF, Inter and the brand images load on first use only.
const generate = async (params) => {
  const [{ generateCisSchedulePdf }, { loadCisPdfAssets }] = await Promise.all([
    import('./generateCisSchedulePdf'),
    import('./cisPdfAssets'),
  ]);
  return generateCisSchedulePdf({ ...params, assets: await loadCisPdfAssets() });
};

/**
 * Download the CIS-CMB10 PDF: the full schedule, or (`mode: 'record'`) the
 * immunization record of doses given.
 *
 * @param {{ member: object, result: object, notes?: object, startedOn?: Date, mode?: 'schedule'|'record' }} params
 */
export async function downloadCisSchedule(params) {
  const { blob, filename } = await generate(params);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** The PDF as a File, e.g. to save to the gap's documents as evidence. */
export async function cisPdfFile(params) {
  const { blob, filename } = await generate(params);
  return new File([blob], filename, { type: 'application/pdf' });
}

/** The immunization record PDF plus its caption, for Documents or the EHR. */
export async function cisRecordEvidence({ member, result, notes }) {
  const file = await cisPdfFile({ member, result, notes, startedOn: seriesStartDate(result), mode: 'record', brand: 'astrana' });
  return { file, caption: `Immunization Record (CIS-CMB10) ${fmtDate(new Date())}` };
}

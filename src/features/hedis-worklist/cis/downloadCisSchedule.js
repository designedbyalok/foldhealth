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

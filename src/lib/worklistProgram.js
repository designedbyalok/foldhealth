// The care program a worklist works, so opening a patient from it lands in
// that program (its Overview). Lists that aren't one program (HCC, HEDIS,
// All Patients, population groups) have none.
const WORKLIST_PROGRAM = {
  'TOC IP': 'TOC IP',
  // Transitional care management runs as the inpatient transition program.
  TCM: 'TOC IP',
  CCM: 'CCM',
  SNP: 'SNP',
  'Annual Visit': 'AWV',
  CMP: 'CMP',
  DM: 'DM',
  Pharmacy: 'PHARM',
};

/** The program code for a worklist (its subnav name), or null. */
export const programForWorklist = (list) => WORKLIST_PROGRAM[list] || null;

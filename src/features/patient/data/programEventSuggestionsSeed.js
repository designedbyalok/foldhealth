/* Care program suggested actions (care management redesign prototype): what
   a new event (ADT, eFax, imaging, lab) means for the patient's care
   programs, from program_event_suggestions
   (supabase/program_event_suggestions_migration.sql); these are the same
   rows, used until the table is seeded.

   action.type:
     enroll  { code }               enroll in a program (consent first when needed)
     step    { code, step }         open that program at the named step
     task    { code, name, due, priority }  create a task on the program
     review  {}                     nothing to change: mark reviewed
   Dates are MM/DD/YYYY; a task's due is MM-DD-YYYY like the tasks table. */

export const PROGRAM_EVENT_SUGGESTIONS = [
  {
    id: 'pes-11143-adt', memberId: '11143', eventKind: 'adt',
    eventTitle: 'Inpatient discharge', eventDetail: 'St. Mary Hospital · CHF exacerbation', eventSource: 'ADT feed', occurredAt: '11/08/2026',
    programCode: 'TOC IP',
    suggestion: 'Complete the 2-day interactive contact. It was due Tue 11/10; agent calls don’t count toward TCM.',
    action: { type: 'step', code: 'TOC IP', step: 'Outreach' },
  },
  {
    id: 'pes-11143-efax', memberId: '11143', eventKind: 'efax',
    eventTitle: 'Discharge summary received', eventDetail: 'St. Mary Hospital · 6 pages', eventSource: 'eFax', occurredAt: '11/09/2026',
    programCode: 'TOC IP',
    suggestion: 'File the discharge summary in TOC IP program documents and reconcile its medication list (furosemide stopped, torsemide 40 mg started).',
    action: { type: 'step', code: 'TOC IP', step: 'Program Documents' },
  },
  {
    id: 'pes-11143-imaging', memberId: '11143', eventKind: 'imaging',
    eventTitle: 'Chest X-ray', eventDetail: 'Mild pulmonary edema, improved from admission', eventSource: 'St. Mary Radiology', occurredAt: '11/07/2026',
    programCode: 'TOC IP',
    suggestion: 'Ask Dr. Chen whether a repeat chest X-ray is needed at the 7-day visit.',
    action: { type: 'task', code: 'TOC IP', name: 'Ask Dr. L. Chen about a repeat chest X-ray at the 7-day visit', due: '11-13-2026', priority: 'medium' },
  },
  {
    id: 'pes-11143-lab', memberId: '11143', eventKind: 'lab',
    eventTitle: 'BNP 890 pg/mL', eventDetail: 'High · reference under 100', eventSource: 'St. Mary Lab', occurredAt: '11/07/2026',
    programCode: 'DM',
    suggestion: 'Heart failure with a recent admission: enroll in Disease Management for the CHF assessment and daily-weight follow-up.',
    action: { type: 'enroll', code: 'DM' },
  },
  {
    id: 'pes-11089-adt', memberId: '11089', eventKind: 'adt',
    eventTitle: 'ED discharge', eventDetail: 'City Medical ER · chest pain, ACS ruled out', eventSource: 'ADT feed', occurredAt: '11/10/2026',
    programCode: 'TOC ED',
    suggestion: 'Enroll in TOC ED for the 7-day ED follow-up (due by 11/17) and the new ER medications.',
    action: { type: 'enroll', code: 'TOC ED' },
  },
  {
    id: 'pes-11089-efax', memberId: '11089', eventKind: 'efax',
    eventTitle: 'ED visit summary received', eventDetail: 'City Medical ER · 3 pages', eventSource: 'eFax', occurredAt: '11/11/2026',
    programCode: 'TOC IP',
    suggestion: 'File the ED summary in TOC IP program documents; it lists aspirin 81 mg and nitroglycerin as new.',
    action: { type: 'step', code: 'TOC IP', step: 'Program Documents' },
  },
  {
    id: 'pes-11089-lab', memberId: '11089', eventKind: 'lab',
    eventTitle: 'Potassium 5.3 mmol/L', eventDetail: 'High · reference 3.5 to 5.0', eventSource: 'City Medical Lab', occurredAt: '11/10/2026',
    programCode: 'DM',
    suggestion: 'She takes lisinopril: recheck potassium within a week, with the fasting labs on 11/13.',
    action: { type: 'task', code: 'DM', name: 'Add a potassium recheck to the fasting labs on 11/13', due: '11-12-2026', priority: 'high' },
  },
  {
    id: 'pes-11089-imaging', memberId: '11089', eventKind: 'imaging',
    eventTitle: 'Chest X-ray', eventDetail: 'No acute findings', eventSource: 'City Medical Radiology', occurredAt: '11/10/2026',
    programCode: 'TOC IP',
    suggestion: 'No follow-up needed. Mention the normal result at the 7-day visit.',
    action: { type: 'review' },
  },
];

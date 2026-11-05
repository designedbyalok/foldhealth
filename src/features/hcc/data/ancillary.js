// Ancillary mock data shown in the non-Codes / non-Activity tabs of the DiagPanel.
// Phase 2 uses static stubs: same content for every drawer. Phase 3 will move these
// to per-member records in the store and wire CRUD.

// Comments render as a timeline (Figma 1:53466) so each entry carries an
// absolute date + time pair, not a relative string. `edited: true` toggles
// the small "Edited" badge after the author/role. Content is coder-workflow
// oriented: HCC eligibility questions, DOS queries, coding decisions.
export const COMMENTS = [
  { id: 'c1', author: 'Deborah Hintz',   role: 'Coder',        date: '06/01/2026', time: '12:30 PM', icd: 'E11.21', dos: '04/18/2026', body: 'E11.21 supported by 04/18/2026 progress note, creatinine 1.8, ACR 320 mg/g documented. Accepting under HCC 37 (Diabetes with Chronic Complications).' },
  { id: 'c2', author: 'M. Almeda',       role: 'QA',           date: '06/02/2026', time: '09:15 AM', edited: true, icd: 'I50.9',  dos: '03/08/2026', body: 'Requesting supporting evidence for I50.9 → suggest confirming with recent BNP or echo. Note from 03/08/2026 mentions "history of CHF" only: MEAT criteria not clearly documented for this DOS.' },
  { id: 'c3', author: 'A. Beauchamp',    role: 'Support Team', date: '06/03/2026', time: '02:45 PM', icd: 'I48.91', dos: '03/08/2026', body: 'Records requested from PCP for I48.91 (a-fib). ECG report expected within 5 business days. Placing DOS on hold pending documentation.' },
];

// Comments shown on one patient's DiagPanel: rows scoped to that patient,
// plus legacy rows saved before comments carried a patient id (those were
// org-wide and have no owner to match). Mock rows only while the store is
// empty.
export function commentsForMember(all, memberId) {
  if (!all?.length) return COMMENTS;
  return all.filter(c => !c.memberId || c.memberId === memberId);
}

// True when a comment body @-mentions `name` (case-insensitive, and not as
// the prefix of a longer name).
export function mentionsUser(body, name) {
  if (!body || !name) return false;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`@${escaped}(?![A-Za-z])`, 'i').test(body);
}

// Documents render as a 2-column table (Figma 1:54865): "Document Name |
// Status". `ext` drives the per-extension file-icon variant (PDF/DOC/IMG).
// Uploads span the workflow: PCP-signed clinical docs come from the Support
// Team (SFTP intake); coders add supporting queries/attachments.
export const DOCUMENTS = [
  { id: 'd1', name: 'Progress Note - 04-18-2026.pdf',  ext: 'pdf', type: 'Clinical Note', uploadedBy: 'A. Beauchamp',   role: 'Support Team', date: '04/19/2026', time: '09:12', status: 'passed' },
  { id: 'd2', name: 'Comprehensive Metabolic Panel.pdf', ext: 'pdf', type: 'Lab Report',  uploadedBy: 'A. Beauchamp',   role: 'Support Team', date: '04/19/2026', time: '09:14', status: 'passed' },
  { id: 'd3', name: 'ECG - Atrial Fibrillation.png',    ext: 'img', type: 'Diagnostic',   uploadedBy: 'M. Thompson',    role: 'Support Team', date: '04/22/2026', time: '11:03', status: 'passed' },
  { id: 'd4', name: 'Physical Therapy Discharge Summary.docx', ext: 'doc', type: 'Physical Therapy', uploadedBy: 'Deborah Hintz', role: 'Coder', date: '04/25/2026', time: '14:45', status: 'passed' },
];

// Notes render as a table (Figma 41:358849): "Note Title | Status | Actions".
// Clinical narrative is authored by the rendering physician; the coder can
// add a coding-summary note but detailed clinical findings (BNP, EF, IV
// diuresis) belong to a physician / ARNP.
export const NOTES = [
  { id: 'n1', title: 'Inpatient Discharge Summary', author: 'Dr. Sarah Chen',   role: 'Physician',    date: '04/18/2026', time: '14:45', signed: true, body: 'Acute-on-Chronic Combined Systolic and Diastolic Heart Failure (I50.43) confirmed via 04/18/2026 inpatient admission. Admission BNP 380 pg/mL with clinical decompensation, dyspnea, orthopnea, 6 lb weight gain, bilateral pitting edema. Echo confirmed EF 45% with Grade II diastolic dysfunction. IV diuresis with Furosemide 80 mg BID resulted in 4.2 L net negative fluid balance. Discharge BNP 210 pg/mL. AKI (N17.9) noted as secondary cardiorenal complication and resolved at discharge.' },
  { id: 'n2', title: 'HCC Coding Summary',          author: 'Deborah Hintz',    role: 'Coder',        date: '04/20/2026', time: '10:12', signed: true, body: 'Accepted I50.43 → HCC 224 (Acute on Chronic Heart Failure) based on the 04/18/2026 discharge summary. E11.22 → HCC 37 (Diabetes with Chronic Complications) supported by CMP with eGFR 42. Deferred G47.33 (OSA): sleep study not on file; requesting records from PCP.' },
];

// Claims render as a timeline (Figma 41:364778), each carries submission
// date + time + provider so the meta line reads "date · time · provider".
export const CLAIMS = [
  { id: 'cl1', number: 'CLM-7845921', dos: '03/04/2025', amount: '$1,284.50', status: 'Paid',    date: '03/06/2025', time: '09:15 AM', submittedBy: 'Deborah Hintz', role: 'Coder' },
  { id: 'cl2', number: 'CLM-7845944', dos: '06/11/2025', amount: '$892.00',   status: 'Pending', date: '06/13/2025', time: '11:00 AM', submittedBy: 'Deborah Hintz', role: 'Coder' },
];

export const OUTREACH = [
  { id: 'o1', type: 'Phone Call', channel: 'Voice', time: 'Today, 2:15 PM', by: 'Delores Conn', outcome: 'Spoke with patient: confirmed next appointment' },
  { id: 'o2', type: 'SMS', channel: 'Text', time: 'Yesterday, 10:30 AM', by: 'System', outcome: 'Appointment reminder delivered' },
  { id: 'o3', type: 'Email', channel: 'Email', time: '3 days ago', by: 'Care Team', outcome: 'Medication reconciliation summary sent' },
  { id: 'o4', type: 'Phone Call', channel: 'Voice', time: '1 week ago', by: 'A. Beauchamp', outcome: 'No answer: voicemail left' },
];

// History renders as a 4-column table (Figma 1:65653): "DOS | HCC Code |
// Claims | ICD Status". Each row summarizes one HCC review for a given DOS.
// HCC codes are CMS V28 category numbers matched to plausible ICD-10
// documentation across the year: a coder auditing this trail should see a
// coherent longitudinal picture, not three "Diabetes w/ Complications" rows
// mapped to unrelated V28 categories.
export const HISTORY = [
  { id: 'h1', dos: '03/04/2025', hccCode: 'HCC 37',  hccName: 'Diabetes with Chronic Complications',    reviewedAt: '06/27/2025', by: 'A. Beauchamp',    role: 'Support Team', claims: 1, icdStatus: 'open'      },
  { id: 'h2', dos: '06/11/2025', hccCode: 'HCC 226', hccName: 'Heart Failure, Except End-Stage',        reviewedAt: '06/27/2025', by: 'Deborah Hintz',   role: 'Coder',        claims: 1, icdStatus: 'accepted'  },
  { id: 'h3', dos: '01/10/2026', hccCode: 'HCC 238', hccName: 'Cardiac Arrhythmias and Heart Block',    reviewedAt: '02/12/2026', by: 'Dr. Sarah Chen',  role: 'Physician',    claims: 1, icdStatus: 'open'      },
  { id: 'h4', dos: '03/10/2026', hccCode: 'HCC 280', hccName: 'Chronic Obstructive Pulmonary Disease',  reviewedAt: '04/02/2026', by: 'Deborah Hintz',   role: 'Coder',        claims: 1, icdStatus: 'dismissed' },
];

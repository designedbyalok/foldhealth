import { FOLD_DB_MAP } from './data/fold-db.js';

export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') { inQuotes = true; }
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(v => v !== '')) rows.push(row);
      row = [];
    } else { field += c; }
  }
  if (field !== '' || row.length) { row.push(field); if (row.some(v => v !== '')) rows.push(row); }
  return rows;
}

/* Parse an HTML-table .xls (the format produced by "Download File with Errors")
   so the download → correct → reupload round-trip works without the xlsx lib. */
export function parseHtmlTable(text) {
  const rows = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const tdRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  let tr;
  while ((tr = trRe.exec(text))) {
    const cells = [];
    let td;
    while ((td = tdRe.exec(tr[1]))) {
      cells.push(td[1].replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim());
    }
    if (cells.some(c => c !== '')) rows.push(cells);
  }
  return rows;
}

/* Route a file's text to the right parser (HTML-table .xls vs CSV/TSV). */
export function parseTable(text) {
  return /<table[\s>]/i.test(text) ? parseHtmlTable(text) : parseCsv(text);
}
export const POP_GROUPS = [
  { id:1,  name:'Patients having CAD with LDL > 100 and not seen in the last 3 months',     type:'Dynamic', count:43,   inactive:7,  updated:'01/16/2024', created:'02/22/2024' },
  { id:2,  name:'45 years or older without screening colonoscopy',                            type:'Dynamic', count:84,   inactive:12, updated:'01/16/2024', created:'02/22/2024' },
  { id:3,  name:'Diabetic patients with HBA1C Above 9 and are not on Statin',               type:'Dynamic', count:null, inactive:0,  updated:'01/16/2024', created:'02/22/2024' },
  { id:4,  name:"Active members who haven't interacted in last 6 months",                    type:'Dynamic', count:31,   inactive:3,  updated:'01/16/2024', created:'02/22/2024' },
  { id:5,  name:'Diabetic Patients with HBA1C between 8 and 9',                              type:'Static',  count:44,   inactive:8,  updated:'01/16/2024', created:'02/22/2024' },
  { id:6,  name:'Diabetic Complications Blood Glucose Patients',                              type:'Dynamic', count:79,   inactive:21, updated:'01/16/2024', created:'02/22/2024' },
  { id:7,  name:'Hypertension Patients with prescribed antihypertensive medications',        type:'Static',  count:14,   inactive:2,  updated:'01/16/2024', created:'02/22/2024' },
  { id:8,  name:'Patients with HBA1C Above 7',                                               type:'Dynamic', count:32,   inactive:5,  updated:'01/16/2024', created:'02/22/2024' },
  { id:9,  name:'Hypertension Patients with BMI > 25 on last appointment',                   type:'Dynamic', count:48,   inactive:9,  updated:'01/16/2024', created:'02/22/2024' },
  { id:10, name:'CHF patients with ejection fraction below 40% not on ACE inhibitor',        type:'Dynamic', count:27,   inactive:4,  updated:'03/05/2024', created:'03/05/2024' },
  { id:11, name:'Patients 65+ with no annual wellness visit in past 12 months',               type:'Dynamic', count:112,  inactive:18, updated:'03/08/2024', created:'03/08/2024' },
  { id:12, name:'COPD patients with 2+ ED visits in the last 90 days',                       type:'Dynamic', count:19,   inactive:1,  updated:'03/12/2024', created:'03/12/2024' },
  { id:13, name:'High-risk postpartum patients within 60 days of delivery',                   type:'Static',  count:8,    inactive:0,  updated:'03/15/2024', created:'03/15/2024' },
  { id:14, name:'SNP members not seen by PCP in last 6 months',                               type:'Dynamic', count:56,   inactive:11, updated:'03/20/2024', created:'03/20/2024' },
  { id:15, name:'Patients on 5+ chronic medications without a medication reconciliation',     type:'Dynamic', count:73,   inactive:14, updated:'03/22/2024', created:'03/22/2024' },
  { id:16, name:'Atrial fibrillation patients not on anticoagulation therapy',                type:'Dynamic', count:35,   inactive:6,  updated:'03/25/2024', created:'03/25/2024' },
  { id:17, name:'Pediatric patients with asthma and 1+ hospitalization this year',            type:'Static',  count:11,   inactive:0,  updated:'04/01/2024', created:'04/01/2024' },
  { id:18, name:'Patients with depression screening overdue by 6 months',                     type:'Dynamic', count:91,   inactive:22, updated:'04/03/2024', created:'04/03/2024' },
  { id:19, name:'CKD Stage 3–4 patients not referred to nephrology',                          type:'Dynamic', count:24,   inactive:3,  updated:'04/07/2024', created:'04/07/2024' },
  { id:20, name:'Members with uncontrolled type 2 diabetes and high BMI',                     type:'Dynamic', count:62,   inactive:9,  updated:'04/10/2024', created:'04/10/2024' },
  { id:21, name:'Post-discharge patients without follow-up within 7 days',                    type:'Dynamic', count:18,   inactive:2,  updated:'04/14/2024', created:'04/14/2024' },
  { id:22, name:'Patients with osteoporosis and no DEXA scan in 2 years',                     type:'Static',  count:37,   inactive:5,  updated:'04/16/2024', created:'04/16/2024' },
  { id:23, name:'High-cost members with 3+ specialist visits and no care coordination',       type:'Dynamic', count:15,   inactive:1,  updated:'04/18/2024', created:'04/18/2024' },
  { id:24, name:'Patients with tobacco use and no cessation counseling',                       type:'Dynamic', count:88,   inactive:16, updated:'04/22/2024', created:'04/22/2024' },
  { id:25, name:'Pediatric immunization gap list — missing MMR booster',                       type:'Static',  count:29,   inactive:0,  updated:'04/25/2024', created:'04/25/2024' },
  { id:26, name:'Patients with BMI ≥ 35 and no referral to weight management program',        type:'Dynamic', count:54,   inactive:7,  updated:'04/28/2024', created:'04/28/2024' },
  { id:27, name:'Patients awaiting colonoscopy with bowel prep instructions not sent',         type:'Static',  count:6,    inactive:0,  updated:'05/01/2024', created:'05/01/2024' },
  { id:28, name:'Members with lupus and no rheumatology visit in last 12 months',              type:'Dynamic', count:21,   inactive:4,  updated:'05/05/2024', created:'05/05/2024' },
  { id:29, name:'Patients with fall risk score ≥ 3 and no PT referral on record',              type:'Dynamic', count:40,   inactive:8,  updated:'05/08/2024', created:'05/08/2024' },
];

export const FILTER_OPTIONS = [
  { value:'static-search', label:'Static (Search & Add Members)' },
  { value:'static-csv',    label:'Static (Upload From CSV File)' },
  { value:'dynamic',       label:'Dynamic (Add By Patient characteristics)' },
];

export const MEMBERSHIP_OPTS = ['All Status','Active','Inactive','Churned','Pending'];

export const CRIT_ATTRS = [
  { label:'Age',            ops:['=','≠','>','<','≥','≤'],               type:'number' },
  { label:'Gender',         ops:['is','is not'],                          type:'select', opts:['Male','Female','Other'] },
  { label:'Condition',      ops:['includes','excludes'],                  type:'text' },
  { label:'Risk Level',     ops:['is','is not'],                          type:'select', opts:['High Risk','Medium Risk','Low Risk'] },
  { label:'Program Status', ops:['is','is not'],                          type:'select', opts:['Active','Completed','Enrolled','Discharged'] },
  { label:'Language',       ops:['is','is not'],                          type:'select', opts:['English','Spanish','French','Other'] },
  { label:'Lace Score',     ops:['>','<','≥','≤','='],                    type:'number' },
  { label:'HbA1c',          ops:['>','<','≥','≤'],                         type:'number' },
  { label:'Discharge Date', ops:['within last','before','after'],         type:'text' },
  { label:'Admission Type', ops:['is','is not'],                          type:'select', opts:['Inpatient','Outpatient','Emergency'] },
];

/* FOLD_DB and FOLD_DB_MAP are imported from './constants/fold-db.js' */
export const PROC_STEPS = [
  'Reading the uploaded file',
  'Extracting values for processing',
  'Matching Patient IDs with Fold Patients',
];
export function groupSignature({ name, description, memberStatus, memberIds }) {
  return JSON.stringify({
    name: (name || '').trim(),
    description: (description || '').trim(),
    memberStatus: memberStatus || 'All Status',
    members: (memberIds || []).map(String).sort(),
  });
}
export function reclassifyDuplicate(prev, removedEntryId) {
  const removed   = prev.duplicates.find(d => d.entryId === removedEntryId);
  const remaining = prev.duplicates.filter(d => d.entryId !== removedEntryId);
  const sibling   = removed ? remaining.find(d => d.rawId === removed.rawId) : null;

  if (!sibling) return { ...prev, duplicates: remaining };

  // Sibling is now alone — reclassify
  const newDups = remaining.filter(d => d.rawId !== sibling.rawId);
  const dbPat   = FOLD_DB_MAP[(sibling.rawId || '').toUpperCase()];

  if (!dbPat) {
    return { ...prev, duplicates: newDups, notFound: [...prev.notFound, { ...sibling, entryId: 'nf_' + sibling.entryId }] };
  }
  const [dbFn, ...rest] = (dbPat.name || '').toLowerCase().split(' ');
  const dbLn = rest.join(' ');
  const fnOk = sibling.rawFn?.trim().toLowerCase() === dbFn;
  const lnOk = sibling.rawLn?.trim().toLowerCase() === dbLn;
  const dobOk = !dbPat.dob || sibling.rawDob === dbPat.dob;

  if (fnOk && lnOk && dobOk) {
    return { ...prev, duplicates: newDups, matched: [...prev.matched, { id: dbPat.id, name: dbPat.name, dob: dbPat.dob, mrn: dbPat.id, pcp: dbPat.pcp }] };
  }
  return { ...prev, duplicates: newDups, notFound: [...prev.notFound, { ...sibling, entryId: 'nf_' + sibling.entryId }] };
}

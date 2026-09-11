// HCC ICD data — ported verbatim from /Users/alokk/Downloads/HCC/hcc_worklist_v2.tsx
// (ICD_DATA lines 175–357, NOT_LINKED_DATA lines 358–422). Keyed by member.name.
// Members not in this map have no ICD data; the DiagPanel shows an empty state.

export const ICDS = {
  "Annette Brave": [
    { code:"E11.22", desc:"Type 2 diabetes mellitus with diabetic chronic kidney disease",               hcc:"HCC 37 - Diabetes with Chronic Complications", status:"New",       type:null,      docs:3, cmts:3, notes:0, raf:0.302, last:"06/27/2025", by:"Dr. Benjamin Cummings (Physician)" },
    { code:"F32.1",  desc:"Major depressive disorder, single episode, moderate",                         hcc:"HCC 155 - Major Depressive Disorder, Moderate", status:"New",      type:null,      docs:3, cmts:3, notes:0, raf:0.309, last:"06/27/2025", by:"Dr. Benjamin Cummings (Physician)" },
    { code:"I50.43", desc:"Acute on chronic combined systolic and diastolic heart failure",              hcc:"HCC 224 - Acute on Chronic Heart Failure", status:"New",           type:null,      docs:3, cmts:3, notes:0, raf:0.368, last:"06/27/2025", by:"Dr. Benjamin Cummings (Physician)" },
    { code:"E41.0",  desc:"Nutritional marasmus",                                                        hcc:"HCC Not Linked",                     status:"New",         type:"Manual",   docs:3, cmts:3, notes:0, raf:0.000, last:"06/11/2025", by:"Deborah Hintz (Coder)" },
  ],
  "Frank Green": [
    { code:"I50.9",  desc:"Heart failure, unspecified",                                                  hcc:"HCC 226 - Heart Failure, Except End-Stage",  status:"Accepted",    type:null,       docs:2, cmts:1, notes:0, raf:0.331, last:"09/28/2025", by:"L. Schmidt (QA)" },
    { code:"E11.9",  desc:"Type 2 DM w/o complications",                                                hcc:"HCC 37 - Diabetes with Chronic Complications", status:"New",         type:null,       docs:1, cmts:0, notes:0, raf:0.195, last:"09/28/2025", by:"J. Levesque (Coder)" },
    { code:"J44.1",  desc:"COPD with acute exacerbation",                                                hcc:"HCC 111 - COPD",                     status:"In Progress", type:null,       docs:2, cmts:1, notes:0, raf:0.392, last:"09/28/2025", by:"J. Levesque (Coder)" },
  ],
  "Brian Carter": [
    { code:"F32.1",  desc:"Major depressive disorder, single episode",                                   hcc:"HCC 58 - Major Depression",          status:"Accepted",    type:null,       docs:2, cmts:0, notes:1, raf:0.309, last:"11/29/2025", by:"M. Almeda (QA)" },
    { code:"E11.65", desc:"Type 2 DM with hyperglycemia",                                                hcc:"HCC 37 - Diabetes with Chronic Complications", status:"Accepted",    type:null,       docs:1, cmts:1, notes:0, raf:0.302, last:"11/29/2025", by:"D. Hintz (Coder)" },
    { code:"I48.91", desc:"Unspecified atrial fibrillation",                                             hcc:"HCC 238 - Cardiac Arrhythmias and Heart Block",       status:"New",         type:"Suspect",  docs:2, cmts:0, notes:0, raf:0.421, last:"11/29/2025", by:"D. Hintz (Coder)" },
    { code:"M79.3",  desc:"Panniculitis, unspecified",                                                   hcc:"HCC 40 - Rheumatoid Arthritis",      status:"Dismissed",   type:null,       docs:1, cmts:0, notes:0, raf:0.081, last:"05/20/2026", by:"D. Hintz (Coder)", dismissReason:"Not supported by documentation" },
  ],
  "Christopher Thompson": [
    { code:"E11.22", desc:"Type 2 diabetes with diabetic chronic kidney disease",                        hcc:"HCC 37 - Diabetes with Chronic Complications", status:"New",         type:"Suspect",  docs:2, cmts:1, notes:0, raf:0.302, last:"03/20/2026", by:"M. Thompson (Support Team)" },
    { code:"I50.9",  desc:"Heart failure, unspecified",                                                  hcc:"HCC 226 - Heart Failure, Except End-Stage",  status:"In Progress", type:null,       docs:3, cmts:2, notes:1, raf:0.331, last:"03/20/2026", by:"Deborah Hintz (Coder)" },
    { code:"J44.1",  desc:"COPD with acute exacerbation",                                                hcc:"HCC 111 - COPD",                     status:"New",         type:null,       docs:1, cmts:0, notes:0, raf:0.392, last:"03/20/2026", by:"Deborah Hintz (Coder)" },
    { code:"I48.0",  desc:"Paroxysmal atrial fibrillation",                                              hcc:"HCC 238 - Cardiac Arrhythmias and Heart Block",       status:"Accepted",    type:null,       docs:1, cmts:0, notes:1, raf:0.421, last:"03/20/2026", by:"E. Fortier (QA)" },
    { code:"G47.33", desc:"Obstructive sleep apnea",                                                     hcc:"HCC 86 - Sleep Apnea",               status:"New",         type:"Suspect",  docs:1, cmts:1, notes:0, raf:0.164, last:"03/20/2026", by:"M. Thompson (Support Team)" },
    { code:"E66.01", desc:"Morbid (severe) obesity due to excess calories",                              hcc:"HCC 22 - Morbid Obesity",            status:"New",         type:null,       docs:1, cmts:0, notes:0, raf:0.272, last:"03/20/2026", by:"Deborah Hintz (Coder)" },
  ],
  "James Walker": [
    { code:"E11.65", desc:"Type 2 DM with hyperglycemia",                                                hcc:"HCC 37 - Diabetes with Chronic Complications", status:"New",         type:null,       docs:2, cmts:1, notes:0, raf:0.195, last:"01/22/2025", by:"M. Thompson (Support Team)" },
    { code:"I50.23", desc:"Acute on chronic systolic (congestive) heart failure",                        hcc:"HCC 224 - Acute on Chronic Heart Failure",  status:"New",         type:"Recapture",docs:1, cmts:0, notes:0, raf:0.389, last:"01/22/2025", by:"Deborah Hintz (Coder)" },
    { code:"J44.0",  desc:"COPD with acute lower respiratory infection",                                 hcc:"HCC 111 - COPD",                     status:"In Progress", type:null,       docs:2, cmts:2, notes:1, raf:0.321, last:"01/22/2025", by:"Deborah Hintz (Coder)" },
    { code:"F32.1",  desc:"Major depressive disorder, single episode",                                   hcc:"HCC 58 - Major Depression",          status:"New",         type:"Suspect",  docs:1, cmts:0, notes:0, raf:0.309, last:"01/22/2025", by:"M. Almeda (QA)" },
    { code:"N18.3",  desc:"Chronic kidney disease, stage 3",                                             hcc:"HCC 27 - End-Stage Renal Disease",   status:"Accepted",    type:null,       docs:1, cmts:1, notes:0, raf:0.184, last:"01/22/2025", by:"M. Almeda (QA)" },
  ],
  "Daniel Martinez": [
    { code:"E11.21", desc:"Type 2 diabetes with diabetic nephropathy",                                   hcc:"HCC 37 - Diabetes with Chronic Complications", status:"New",         type:null,       docs:2, cmts:0, notes:1, raf:0.302, last:"01/30/2026", by:"K. Stroman (Support Team)" },
    { code:"I50.9",  desc:"Heart failure, unspecified",                                                  hcc:"HCC 226 - Heart Failure, Except End-Stage",  status:"New",         type:"Suspect",  docs:1, cmts:1, notes:0, raf:0.331, last:"01/30/2026", by:"P. Plourde (Coder)" },
    { code:"J44.1",  desc:"COPD with acute exacerbation",                                                hcc:"HCC 111 - COPD",                     status:"In Progress", type:null,       docs:3, cmts:1, notes:0, raf:0.392, last:"01/30/2026", by:"P. Plourde (Coder)" },
    { code:"F33.1",  desc:"Major depressive disorder, recurrent, moderate",                              hcc:"HCC 58 - Major Depression",          status:"New",         type:null,       docs:1, cmts:0, notes:0, raf:0.309, last:"01/30/2026", by:"B. Olafson (QA)" },
    { code:"I70.201",desc:"Atherosclerosis of native arteries of extremities, right leg",                hcc:"HCC 108 - Vascular Disease",         status:"Accepted",    type:null,       docs:2, cmts:0, notes:1, raf:0.288, last:"01/30/2026", by:"P. Plourde (Coder)" },
    { code:"D68.9",  desc:"Coagulation defect, unspecified",                                             hcc:"HCC 48 - Coagulation Defects",       status:"New",         type:"Suspect",  docs:1, cmts:0, notes:0, raf:0.267, last:"01/30/2026", by:"K. Stroman (Support Team)" },
  ],
  "Robert Kim": [
    { code:"E11.9",  desc:"Type 2 DM without complications",                                             hcc:"HCC 19 - Diabetes w/o Complication", status:"New",         type:null,       docs:1, cmts:0, notes:0, raf:0.195, last:"02/14/2025", by:"A. Beauchamp (Support Team)" },
    { code:"I50.9",  desc:"Heart failure, unspecified",                                                  hcc:"HCC 226 - Heart Failure, Except End-Stage",  status:"New",         type:"Recapture",docs:2, cmts:1, notes:0, raf:0.331, last:"02/14/2025", by:"A. Beauchamp (Support Team)" },
    { code:"J44.1",  desc:"COPD with acute exacerbation",                                                hcc:"HCC 111 - COPD",                     status:"Accepted",    type:null,       docs:1, cmts:0, notes:1, raf:0.392, last:"02/14/2025", by:"P. Plourde (Coder)" },
    { code:"G47.33", desc:"Obstructive sleep apnea",                                                     hcc:"HCC 86 - Sleep Apnea",               status:"New",         type:"Suspect",  docs:1, cmts:0, notes:0, raf:0.164, last:"02/14/2025", by:"A. Beauchamp (Support Team)" },
  ],
  "Maria Santos": [
    { code:"E11.65", desc:"Type 2 DM with hyperglycemia",                                                hcc:"HCC 37 - Diabetes with Chronic Complications", status:"New",         type:"Suspect",  docs:1, cmts:0, notes:0, raf:0.195, last:"04/10/2025", by:"K. Stroman (Support Team)" },
    { code:"I48.91", desc:"Unspecified atrial fibrillation",                                             hcc:"HCC 238 - Cardiac Arrhythmias and Heart Block",       status:"In Progress", type:null,       docs:2, cmts:1, notes:0, raf:0.421, last:"04/10/2025", by:"K. Stroman (Support Team)" },
    { code:"G47.33", desc:"Obstructive sleep apnea",                                                     hcc:"HCC 86 - Sleep Apnea",               status:"New",         type:null,       docs:1, cmts:0, notes:0, raf:0.164, last:"04/10/2025", by:"K. Stroman (Support Team)" },
  ],
  "Grace Hill": [
    { code:"E11.21", desc:"Type 2 diabetes mellitus with diabetic nephropathy",                          hcc:"HCC 37 - Diabetes with Chronic Complications", status:"New",       type:null,       docs:2, cmts:1, notes:0, raf:0.302, last:"04/18/2026", by:"O. Twist (Support Team)" },
    { code:"G47.33", desc:"Obstructive sleep apnea",                                                     hcc:"HCC Not Linked",                     status:"New",         type:"Suspect",  docs:1, cmts:0, notes:0, raf:0.000, last:"04/18/2026", by:"Deborah Hintz (Coder)" },
    { code:"I48.0",  desc:"Paroxysmal atrial fibrillation",                                              hcc:"HCC 238 - Cardiac Arrhythmias and Heart Block", status:"Accepted", type:null,       docs:1, cmts:0, notes:1, raf:0.268, last:"04/18/2026", by:"B. Olafson (QA)" },
    { code:"N18.3",  desc:"Chronic kidney disease, stage 3",                                             hcc:"HCC 329 - Chronic Kidney Disease, Stage 3", status:"New",          type:null,       docs:1, cmts:1, notes:0, raf:0.127, last:"04/18/2026", by:"Deborah Hintz (Coder)" },
  ],
  "Cynthia Davis": [
    { code:"E11.9",  desc:"Type 2 DM without complications",                                             hcc:"HCC 19 - Diabetes w/o Complication", status:"New",         type:null,       docs:1, cmts:0, notes:0, raf:0.195, last:"05/22/2026", by:"A. Beauchamp (Support Team)" },
    { code:"J44.1",  desc:"COPD with acute exacerbation",                                                hcc:"HCC 111 - COPD",                     status:"New",         type:"Suspect",  docs:2, cmts:1, notes:0, raf:0.392, last:"05/22/2026", by:"A. Beauchamp (Support Team)" },
    { code:"G47.33", desc:"Obstructive sleep apnea",                                                     hcc:"HCC 86 - Sleep Apnea",               status:"Accepted",    type:null,       docs:1, cmts:0, notes:1, raf:0.164, last:"05/22/2026", by:"A. Beauchamp (Support Team)" },
    { code:"I48.91", desc:"Unspecified atrial fibrillation",                                             hcc:"HCC 238 - Cardiac Arrhythmias and Heart Block",       status:"New",         type:null,       docs:1, cmts:0, notes:0, raf:0.421, last:"05/22/2026", by:"A. Beauchamp (Support Team)" },
  ],
  "Emily Foster": [
    { code:"E11.9",  desc:"Type 2 DM without complications",                                             hcc:"HCC 19 - Diabetes w/o Complication", status:"New",         type:null,       docs:1, cmts:0, notes:0, raf:0.195, last:"12/01/2025", by:"K. Stroman (Support Team)" },
    { code:"G47.33", desc:"Obstructive sleep apnea",                                                     hcc:"HCC 86 - Sleep Apnea",               status:"Accepted",    type:null,       docs:1, cmts:0, notes:0, raf:0.164, last:"12/01/2025", by:"Deborah Hintz (Coder)" },
    { code:"F33.1",  desc:"Major depressive disorder, recurrent, moderate",                              hcc:"HCC 58 - Major Depression",          status:"New",         type:"Suspect",  docs:1, cmts:1, notes:0, raf:0.309, last:"12/01/2025", by:"K. Stroman (Support Team)" },
  ],
  "William Jammy": [
    { code:"E11.21", desc:"Type 2 diabetes mellitus with diabetic nephropathy",                          hcc:"HCC 37 - Diabetes with Chronic Complications", status:"New",       type:null,       docs:2, cmts:0, notes:1, raf:0.302, last:"05/21/2026", by:"Oliver Twist (Support Team)" },
    { code:"I50.9",  desc:"Heart failure, unspecified",                                                  hcc:"HCC 226 - Heart Failure, Except End-Stage", status:"New",          type:"Suspect",  docs:1, cmts:1, notes:0, raf:0.331, last:"05/21/2026", by:"D. Hintz (Coder)" },
    { code:"I48.91", desc:"Unspecified atrial fibrillation",                                             hcc:"HCC 238 - Cardiac Arrhythmias and Heart Block", status:"Accepted", type:null,       docs:1, cmts:0, notes:0, raf:0.268, last:"05/21/2026", by:"N. Richards (Compliance)" },
    { code:"J44.0",  desc:"COPD with acute lower respiratory infection",                                 hcc:"HCC 280 - Chronic Obstructive Pulmonary Disease", status:"New",     type:null,       docs:1, cmts:0, notes:0, raf:0.331, last:"05/21/2026", by:"D. Hintz (Coder)" },
  ],
  "Helen Park": [
    { code:"E11.22", desc:"Type 2 diabetes with diabetic chronic kidney disease",                        hcc:"HCC 37 - Diabetes with Chronic Complications", status:"New",         type:null,       docs:2, cmts:0, notes:0, raf:0.302, last:"03/18/2025", by:"L. Torrance (Support Team)" },
    { code:"I50.9",  desc:"Heart failure, unspecified",                                                  hcc:"HCC 226 - Heart Failure, Except End-Stage",  status:"In Progress", type:null,       docs:1, cmts:1, notes:0, raf:0.331, last:"03/18/2025", by:"L. Torrance (Support Team)" },
    { code:"F32.1",  desc:"Major depressive disorder, single episode",                                   hcc:"HCC 58 - Major Depression",          status:"Dismissed",   type:"Suspect",  docs:1, cmts:0, notes:0, raf:0.309, last:"03/18/2025", by:"L. Torrance (Support Team)", dismissReason:"Insufficient clinical evidence" },
  ],
  "Thomas Reed": [
    { code:"E11.22", desc:"Type 2 diabetes with diabetic chronic kidney disease",                        hcc:"HCC 37 - Diabetes with Chronic Complications", status:"New",         type:null,       docs:2, cmts:1, notes:0, raf:0.302, last:"02/28/2026", by:"O. Twist (Support Team)" },
    { code:"I25.10", desc:"Atherosclerotic heart disease of native coronary artery without angina",      hcc:"HCC 108 - Vascular Disease",         status:"In Progress", type:null,       docs:1, cmts:0, notes:1, raf:0.288, last:"02/28/2026", by:"P. Plourde (Coder)" },
    { code:"J45.50", desc:"Severe persistent asthma, uncomplicated",                                     hcc:"HCC 110 - Asthma",                   status:"New",         type:"Suspect",  docs:1, cmts:1, notes:0, raf:0.271, last:"02/28/2026", by:"O. Twist (Support Team)" },
    { code:"F33.1",  desc:"Major depressive disorder, recurrent, moderate",                              hcc:"HCC 58 - Major Depression",          status:"New",         type:null,       docs:1, cmts:0, notes:0, raf:0.309, last:"02/28/2026", by:"B. Olafson (QA)" },
    { code:"E66.01", desc:"Morbid (severe) obesity due to excess calories",                              hcc:"HCC 22 - Morbid Obesity",            status:"Dismissed",   type:null,       docs:1, cmts:0, notes:0, raf:0.272, last:"02/28/2026", by:"P. Plourde (Coder)", dismissReason:"Coded incorrectly" },
  ],
  "Linda Chen": [
    { code:"E11.22", desc:"Type 2 diabetes with diabetic chronic kidney disease",                        hcc:"HCC 37 - Diabetes with Chronic Complications", status:"New",         type:"Suspect",  docs:1, cmts:0, notes:0, raf:0.302, last:"05/01/2025", by:"E. Johnson (Support Team)" },
    { code:"I50.23", desc:"Acute on chronic systolic (congestive) heart failure",                        hcc:"HCC 224 - Acute on Chronic Heart Failure",  status:"New",         type:"Recapture",docs:1, cmts:1, notes:0, raf:0.389, last:"05/01/2025", by:"Deborah Hintz (Coder)" },
  ],
  "Michael Ortiz": [
    { code:"E11.22", desc:"Type 2 diabetes with diabetic chronic kidney disease",                        hcc:"HCC 37 - Diabetes with Chronic Complications", status:"New",         type:"Suspect",  docs:2, cmts:1, notes:0, raf:0.302, last:"04/25/2025", by:"K. Stroman (Support Team)" },
    { code:"E11.65", desc:"Type 2 DM with hyperglycemia",                                                hcc:"HCC 37 - Diabetes with Chronic Complications", status:"In Progress", type:null,       docs:1, cmts:0, notes:1, raf:0.195, last:"04/25/2025", by:"Deborah Hintz (Coder)" },
    { code:"I50.9",  desc:"Heart failure, unspecified",                                                  hcc:"HCC 226 - Heart Failure, Except End-Stage",  status:"New",         type:null,       docs:3, cmts:2, notes:0, raf:0.331, last:"04/25/2025", by:"Deborah Hintz (Coder)" },
    { code:"I48.91", desc:"Unspecified atrial fibrillation",                                             hcc:"HCC 238 - Cardiac Arrhythmias and Heart Block",       status:"New",         type:"Suspect",  docs:1, cmts:0, notes:0, raf:0.421, last:"04/25/2025", by:"K. Stroman (Support Team)" },
    { code:"J44.1",  desc:"COPD with acute exacerbation",                                                hcc:"HCC 111 - COPD",                     status:"New",         type:null,       docs:2, cmts:1, notes:0, raf:0.392, last:"04/25/2025", by:"Deborah Hintz (Coder)" },
    { code:"G47.33", desc:"Obstructive sleep apnea",                                                     hcc:"HCC 86 - Sleep Apnea",               status:"New",         type:null,       docs:1, cmts:0, notes:0, raf:0.164, last:"04/25/2025", by:"E. Fortier (QA)" },
    { code:"M79.3",  desc:"Panniculitis, unspecified",                                                   hcc:"HCC 40 - Rheumatoid Arthritis",      status:"Dismissed",   type:null,       docs:1, cmts:0, notes:0, raf:0.081, last:"04/25/2025", by:"Deborah Hintz (Coder)", dismissReason:"Not supported by documentation" },
  ],
  "Patricia Moore": [
    { code:"E11.9",  desc:"Type 2 DM without complications",                                             hcc:"HCC 19 - Diabetes w/o Complication", status:"New",         type:null,       docs:1, cmts:0, notes:0, raf:0.195, last:"06/15/2025", by:"K. Stroman (Support Team)" },
    { code:"G47.33", desc:"Obstructive sleep apnea",                                                     hcc:"HCC 86 - Sleep Apnea",               status:"New",         type:"Suspect",  docs:1, cmts:1, notes:0, raf:0.164, last:"06/15/2025", by:"K. Stroman (Support Team)" },
  ],
  "Charles Rivera": [
    { code:"E11.9",  desc:"Type 2 DM without complications",                                             hcc:"HCC 19 - Diabetes w/o Complication", status:"New",         type:null,       docs:1, cmts:0, notes:0, raf:0.195, last:"07/01/2025", by:"A. Beauchamp (Support Team)" },
    { code:"I25.10", desc:"Atherosclerotic heart disease of native coronary artery without angina",      hcc:"HCC 108 - Vascular Disease",         status:"New",         type:"Recapture",docs:2, cmts:1, notes:0, raf:0.288, last:"07/01/2025", by:"P. Plourde (Coder)" },
    { code:"G47.33", desc:"Obstructive sleep apnea",                                                     hcc:"HCC 86 - Sleep Apnea",               status:"Accepted",    type:null,       docs:1, cmts:0, notes:1, raf:0.164, last:"07/01/2025", by:"P. Plourde (Coder)" },
    { code:"F32.1",  desc:"Major depressive disorder, single episode",                                   hcc:"HCC 58 - Major Depression",          status:"New",         type:"Suspect",  docs:1, cmts:0, notes:0, raf:0.309, last:"07/01/2025", by:"A. Beauchamp (Support Team)" },
  ],
  "Dorothy Nguyen": [
    { code:"E11.22", desc:"Type 2 diabetes with diabetic chronic kidney disease",                        hcc:"HCC 37 - Diabetes with Chronic Complications", status:"Accepted",    type:null,       docs:2, cmts:0, notes:1, raf:0.302, last:"08/12/2025", by:"M. Thompson (Support Team)" },
    { code:"I48.91", desc:"Unspecified atrial fibrillation",                                             hcc:"HCC 238 - Cardiac Arrhythmias and Heart Block",       status:"New",         type:null,       docs:1, cmts:1, notes:0, raf:0.421, last:"08/12/2025", by:"Deborah Hintz (Coder)" },
    { code:"N18.5",  desc:"Chronic kidney disease, stage 5",                                             hcc:"HCC 27 - End-Stage Renal Disease",   status:"In Progress", type:null,       docs:2, cmts:0, notes:0, raf:0.650, last:"08/12/2025", by:"Deborah Hintz (Coder)" },
    { code:"M06.00", desc:"Rheumatoid arthritis, unspecified, unspecified site",                         hcc:"HCC 40 - Rheumatoid Arthritis",      status:"New",         type:"Suspect",  docs:1, cmts:1, notes:0, raf:0.421, last:"08/12/2025", by:"N. Richards (Compliance)" },
  ],
  "Richard Scott": [
    { code:"G47.33", desc:"Obstructive sleep apnea",                                                     hcc:"HCC 86 - Sleep Apnea",               status:"New",         type:"Suspect",  docs:1, cmts:0, notes:0, raf:0.164, last:"09/05/2025", by:"K. Stroman (Support Team)" },
    { code:"F33.1",  desc:"Major depressive disorder, recurrent, moderate",                              hcc:"HCC 58 - Major Depression",          status:"In Progress", type:null,       docs:1, cmts:1, notes:0, raf:0.309, last:"09/05/2025", by:"K. Stroman (Support Team)" },
  ],
  "Sandra Lee": [
    { code:"E11.22", desc:"Type 2 diabetes with diabetic chronic kidney disease",                        hcc:"HCC 37 - Diabetes with Chronic Complications", status:"New",         type:"Suspect",  docs:2, cmts:1, notes:0, raf:0.302, last:"10/18/2025", by:"L. Torrance (Support Team)" },
    { code:"F32.1",  desc:"Major depressive disorder, single episode",                                   hcc:"HCC 58 - Major Depression",          status:"In Progress", type:null,       docs:1, cmts:0, notes:1, raf:0.309, last:"10/18/2025", by:"Deborah Hintz (Coder)" },
    { code:"I48.91", desc:"Unspecified atrial fibrillation",                                             hcc:"HCC 238 - Cardiac Arrhythmias and Heart Block",       status:"New",         type:null,       docs:1, cmts:1, notes:0, raf:0.421, last:"10/18/2025", by:"M. Almeda (QA)" },
    { code:"M06.00", desc:"Rheumatoid arthritis, unspecified, unspecified site",                         hcc:"HCC 40 - Rheumatoid Arthritis",      status:"New",         type:null,       docs:1, cmts:0, notes:0, raf:0.421, last:"10/18/2025", by:"L. Torrance (Support Team)" },
    { code:"I50.9",  desc:"Heart failure, unspecified",                                                  hcc:"HCC 226 - Heart Failure, Except End-Stage",  status:"Accepted",    type:null,       docs:2, cmts:0, notes:1, raf:0.331, last:"10/18/2025", by:"Deborah Hintz (Coder)" },
  ],
  "Kevin Brown": [
    { code:"E11.65", desc:"Type 2 diabetes mellitus with hyperglycemia",                                 hcc:"HCC 38 - Diabetes with Glycemic Complications", status:"New",      type:"Suspect",  docs:1, cmts:0, notes:0, raf:0.166, last:"05/15/2026", by:"E. Johnson (Support Team)" },
    { code:"I48.91", desc:"Unspecified atrial fibrillation",                                             hcc:"HCC 238 - Cardiac Arrhythmias and Heart Block", status:"In Progress", type:null,    docs:1, cmts:1, notes:0, raf:0.268, last:"05/15/2026", by:"E. Johnson (Support Team)" },
    { code:"N18.3",  desc:"Chronic kidney disease, stage 3",                                             hcc:"HCC 329 - Chronic Kidney Disease, Stage 3", status:"New",          type:null,       docs:1, cmts:0, notes:0, raf:0.127, last:"05/15/2026", by:"E. Johnson (Support Team)" },
  ],
  "Lisa White": [
    { code:"I50.9",  desc:"Heart failure, unspecified",                                                  hcc:"HCC 226 - Heart Failure, Except End-Stage",  status:"New",         type:"Recapture",docs:2, cmts:1, notes:0, raf:0.331, last:"12/08/2025", by:"O. Twist (Support Team)" },
    { code:"E11.65", desc:"Type 2 DM with hyperglycemia",                                                hcc:"HCC 37 - Diabetes with Chronic Complications", status:"New",         type:null,       docs:1, cmts:0, notes:0, raf:0.195, last:"12/08/2025", by:"O. Twist (Support Team)" },
    { code:"F33.1",  desc:"Major depressive disorder, recurrent, moderate",                              hcc:"HCC 58 - Major Depression",          status:"New",         type:"Suspect",  docs:1, cmts:1, notes:0, raf:0.309, last:"12/08/2025", by:"O. Twist (Support Team)" },
    { code:"J44.1",  desc:"COPD with acute exacerbation",                                                hcc:"HCC 111 - COPD",                     status:"Dismissed",   type:null,       docs:1, cmts:0, notes:0, raf:0.392, last:"12/08/2025", by:"O. Twist (Support Team)", dismissReason:"Not clinically supported" },
  ],
  "David Evans": [
    { code:"E11.65", desc:"Type 2 DM with hyperglycemia",                                                hcc:"HCC 37 - Diabetes with Chronic Complications", status:"New",         type:"Suspect",  docs:1, cmts:0, notes:0, raf:0.195, last:"03/08/2026", by:"E. Johnson (Support Team)" },
    { code:"I50.23", desc:"Acute on chronic systolic (congestive) heart failure",                        hcc:"HCC 224 - Acute on Chronic Heart Failure",  status:"In Progress", type:null,       docs:2, cmts:1, notes:1, raf:0.389, last:"03/08/2026", by:"Deborah Hintz (Coder)" },
    { code:"G35",    desc:"Multiple sclerosis",                                                          hcc:"HCC 77 - Multiple Sclerosis",        status:"New",         type:null,       docs:1, cmts:0, notes:0, raf:0.455, last:"03/08/2026", by:"E. Fortier (QA)" },
    { code:"I48.0",  desc:"Paroxysmal atrial fibrillation",                                              hcc:"HCC 238 - Cardiac Arrhythmias and Heart Block",       status:"New",         type:null,       docs:1, cmts:1, notes:0, raf:0.421, last:"03/08/2026", by:"Deborah Hintz (Coder)" },
    { code:"N18.5",  desc:"Chronic kidney disease, stage 5",                                             hcc:"HCC 27 - End-Stage Renal Disease",   status:"Accepted",    type:null,       docs:2, cmts:0, notes:1, raf:0.650, last:"03/08/2026", by:"E. Fortier (QA)" },
  ],
  "Michelle Jackson": [
    { code:"E11.22", desc:"Type 2 diabetes with diabetic chronic kidney disease",                        hcc:"HCC 37 - Diabetes with Chronic Complications", status:"New",         type:"Suspect",  docs:1, cmts:0, notes:0, raf:0.302, last:"02/25/2026", by:"K. Stroman (Support Team)" },
    { code:"I50.9",  desc:"Heart failure, unspecified",                                                  hcc:"HCC 226 - Heart Failure, Except End-Stage",  status:"New",         type:"Recapture",docs:1, cmts:1, notes:0, raf:0.331, last:"02/25/2026", by:"K. Stroman (Support Team)" },
  ],
  "Amanda Wilson": [
    { code:"E11.21", desc:"Type 2 diabetes with diabetic nephropathy",                                   hcc:"HCC 37 - Diabetes with Chronic Complications", status:"New",         type:"Suspect",  docs:1, cmts:1, notes:0, raf:0.302, last:"04/12/2026", by:"A. Beauchamp (Support Team)" },
    { code:"I25.10", desc:"Atherosclerotic heart disease of native coronary artery without angina",      hcc:"HCC 108 - Vascular Disease",         status:"New",         type:null,       docs:2, cmts:0, notes:0, raf:0.288, last:"04/12/2026", by:"A. Beauchamp (Support Team)" },
    { code:"F32.1",  desc:"Major depressive disorder, single episode",                                   hcc:"HCC 58 - Major Depression",          status:"Accepted",    type:null,       docs:1, cmts:0, notes:1, raf:0.309, last:"04/12/2026", by:"A. Beauchamp (Support Team)" },
    { code:"G47.33", desc:"Obstructive sleep apnea",                                                     hcc:"HCC 86 - Sleep Apnea",               status:"New",         type:null,       docs:1, cmts:0, notes:0, raf:0.164, last:"04/12/2026", by:"A. Beauchamp (Support Team)" },
  ],
  "Matthew Harris": [
    { code:"E11.22", desc:"Type 2 diabetes with diabetic chronic kidney disease",                        hcc:"HCC 37 - Diabetes with Chronic Complications", status:"New",         type:"Suspect",  docs:2, cmts:1, notes:0, raf:0.302, last:"05/05/2026", by:"L. Torrance (Support Team)" },
    { code:"I50.23", desc:"Acute on chronic systolic (congestive) heart failure",                        hcc:"HCC 224 - Acute on Chronic Heart Failure",  status:"New",         type:null,       docs:1, cmts:0, notes:0, raf:0.389, last:"05/05/2026", by:"P. Plourde (Coder)" },
    { code:"J44.0",  desc:"COPD with acute lower respiratory infection",                                 hcc:"HCC 111 - COPD",                     status:"In Progress", type:null,       docs:2, cmts:1, notes:1, raf:0.321, last:"05/05/2026", by:"P. Plourde (Coder)" },
    { code:"I48.91", desc:"Unspecified atrial fibrillation",                                             hcc:"HCC 238 - Cardiac Arrhythmias and Heart Block",       status:"Accepted",    type:null,       docs:1, cmts:0, notes:0, raf:0.421, last:"05/05/2026", by:"M. Almeda (QA)" },
    { code:"E66.01", desc:"Morbid (severe) obesity due to excess calories",                              hcc:"HCC 22 - Morbid Obesity",            status:"New",         type:null,       docs:1, cmts:0, notes:0, raf:0.272, last:"05/05/2026", by:"L. Torrance (Support Team)" },
  ],
  "Jessica Clark": [
    { code:"E11.65", desc:"Type 2 diabetes mellitus with hyperglycemia",                                 hcc:"HCC 38 - Diabetes with Glycemic Complications", status:"New",      type:"Suspect",  docs:1, cmts:0, notes:0, raf:0.166, last:"06/18/2026", by:"K. Stroman (Support Team)" },
    { code:"I48.0",  desc:"Paroxysmal atrial fibrillation",                                              hcc:"HCC 238 - Cardiac Arrhythmias and Heart Block", status:"New",      type:null,       docs:1, cmts:1, notes:0, raf:0.268, last:"06/18/2026", by:"K. Stroman (Support Team)" },
  ],
  "Andrew Lewis": [
    { code:"E11.22", desc:"Type 2 diabetes with diabetic chronic kidney disease",                        hcc:"HCC 37 - Diabetes with Chronic Complications", status:"New",         type:"Suspect",  docs:2, cmts:0, notes:0, raf:0.302, last:"07/22/2026", by:"O. Twist (Support Team)" },
    { code:"I50.23", desc:"Acute on chronic systolic (congestive) heart failure",                        hcc:"HCC 224 - Acute on Chronic Heart Failure",  status:"New",         type:null,       docs:1, cmts:1, notes:0, raf:0.389, last:"07/22/2026", by:"Deborah Hintz (Coder)" },
    { code:"J44.1",  desc:"COPD with acute exacerbation",                                                hcc:"HCC 111 - COPD",                     status:"In Progress", type:null,       docs:2, cmts:0, notes:1, raf:0.392, last:"07/22/2026", by:"Deborah Hintz (Coder)" },
    { code:"I48.0",  desc:"Paroxysmal atrial fibrillation",                                              hcc:"HCC 238 - Cardiac Arrhythmias and Heart Block",       status:"New",         type:null,       docs:1, cmts:1, notes:0, raf:0.421, last:"07/22/2026", by:"K. Patel (Compliance)" },
    { code:"F33.1",  desc:"Major depressive disorder, recurrent, moderate",                              hcc:"HCC 58 - Major Depression",          status:"Accepted",    type:null,       docs:1, cmts:0, notes:0, raf:0.309, last:"07/22/2026", by:"K. Patel (Compliance)" },
    { code:"E66.01", desc:"Morbid (severe) obesity due to excess calories",                              hcc:"HCC 22 - Morbid Obesity",            status:"New",         type:"Suspect",  docs:1, cmts:0, notes:0, raf:0.272, last:"07/22/2026", by:"O. Twist (Support Team)" },
  ],
  "Jennifer Robinson": [
    { code:"E11.65", desc:"Type 2 DM with hyperglycemia",                                                hcc:"HCC 37 - Diabetes with Chronic Complications", status:"New",         type:"Suspect",  docs:1, cmts:0, notes:0, raf:0.195, last:"08/28/2026", by:"E. Johnson (Support Team)" },
    { code:"G47.33", desc:"Obstructive sleep apnea",                                                     hcc:"HCC 86 - Sleep Apnea",               status:"New",         type:null,       docs:1, cmts:1, notes:0, raf:0.164, last:"08/28/2026", by:"E. Johnson (Support Team)" },
    { code:"I48.0",  desc:"Paroxysmal atrial fibrillation",                                              hcc:"HCC 238 - Cardiac Arrhythmias and Heart Block",       status:"Dismissed",   type:null,       docs:1, cmts:0, notes:0, raf:0.421, last:"08/28/2026", by:"E. Johnson (Support Team)", dismissReason:"Resolved prior to encounter" },
  ],
};
// ── Deterministic ICD generator ─────────────────────────────────────────
// The curated ICDS map above only covers the design-reference patients. The
// worklist (Supabase) carries many more members, so any patient without a
// curated entry would otherwise open an empty drawer + empty hover popover.
// This generator produces a coherent, stable-per-name set of HCC gaps for ANY
// member so every patient has related ICDs. Multi-DOS association is handled
// downstream (DiagPanel spreads each ICD across the member's dos_list).

// FNV-1a string hash — stable, so a member always gets the same generated set.
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < String(s).length; i++) {
    h ^= String(s).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Clinically-common HCC-relevant ICDs (V28 categories), used to compose a
// member's suspected/open gaps.
const ICD_POOL = [
  { code: 'E11.22', desc: 'Type 2 diabetes with diabetic chronic kidney disease',              hcc: 'HCC 37 - Diabetes with Chronic Complications', raf: 0.302 },
  { code: 'E11.65', desc: 'Type 2 diabetes mellitus with hyperglycemia',                       hcc: 'HCC 38 - Diabetes with Glycemic Complications', raf: 0.166 },
  { code: 'E11.9',  desc: 'Type 2 diabetes mellitus without complications',                    hcc: 'HCC 36 - Diabetes without Complication', raf: 0.105 },
  { code: 'I50.9',  desc: 'Heart failure, unspecified',                                        hcc: 'HCC 226 - Heart Failure, Except End-Stage', raf: 0.331 },
  { code: 'I50.23', desc: 'Acute on chronic systolic (congestive) heart failure',             hcc: 'HCC 224 - Acute on Chronic Heart Failure', raf: 0.389 },
  { code: 'J44.1',  desc: 'COPD with acute exacerbation',                                      hcc: 'HCC 280 - Chronic Obstructive Pulmonary Disease', raf: 0.331 },
  { code: 'N18.3',  desc: 'Chronic kidney disease, stage 3',                                   hcc: 'HCC 329 - Chronic Kidney Disease, Stage 3', raf: 0.127 },
  { code: 'N18.4',  desc: 'Chronic kidney disease, stage 4',                                   hcc: 'HCC 328 - Chronic Kidney Disease, Stage 4', raf: 0.237 },
  { code: 'F32.1',  desc: 'Major depressive disorder, single episode, moderate',              hcc: 'HCC 155 - Major Depressive Disorder, Moderate', raf: 0.309 },
  { code: 'F33.1',  desc: 'Major depressive disorder, recurrent, moderate',                    hcc: 'HCC 155 - Major Depressive Disorder, Moderate', raf: 0.309 },
  { code: 'I48.0',  desc: 'Paroxysmal atrial fibrillation',                                    hcc: 'HCC 238 - Cardiac Arrhythmias and Heart Block', raf: 0.268 },
  { code: 'I48.91', desc: 'Unspecified atrial fibrillation',                                   hcc: 'HCC 238 - Cardiac Arrhythmias and Heart Block', raf: 0.268 },
  { code: 'E66.01', desc: 'Morbid (severe) obesity due to excess calories',                    hcc: 'HCC 48 - Morbid Obesity', raf: 0.250 },
  { code: 'I25.10', desc: 'Atherosclerotic heart disease of native coronary artery',          hcc: 'HCC 264 - Vascular Disease', raf: 0.288 },
  { code: 'J45.50', desc: 'Severe persistent asthma, uncomplicated',                           hcc: 'HCC 279 - Asthma', raf: 0.271 },
  { code: 'G47.33', desc: 'Obstructive sleep apnea',                                           hcc: 'HCC Not Linked', raf: 0.000 },
];

const GEN_STATUS = ['New', 'In Progress', 'New', 'Accepted', 'New'];

// Pick `count` distinct pool entries, stepping by a per-member stride so the
// selection is varied but deterministic.
function pickPool(seed, count) {
  const step = 3 + (seed % 5);
  const seen = new Set();
  const out = [];
  let idx = seed % ICD_POOL.length;
  while (out.length < count && seen.size < ICD_POOL.length) {
    if (!seen.has(idx)) { seen.add(idx); out.push(ICD_POOL[idx]); }
    idx = (idx + step) % ICD_POOL.length;
  }
  return out;
}

// Stable "last documented" date derived from a hash: MM/DD/YYYY, anchored
// so generated members read the same as the hand-curated ICDS map above
// (mid-2025 through early-2026). Used by every generator so every ICD row
// carries a real date the UI can render (no "-" placeholders).
function genLastDocumented(seed) {
  const monthIdx = seed % 12;        // 0-11
  const day = 1 + (seed % 28);        // 1-28
  const yearOff = (seed >> 5) % 2;    // 0 or 1
  const year = 2025 + yearOff;
  const mm = String(monthIdx + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${mm}/${dd}/${year}`;
}

function generateIcdsForMember(name) {
  const h = hashStr(name);
  const count = 3 + (h % 4); // 3–6 linked/suspect ICDs
  return pickPool(h, count).map((base) => {
    const hh = hashStr(`${name}|${base.code}`);
    const isAI = hh % 3 === 0 && base.hcc !== 'HCC Not Linked';
    return {
      code: base.code, desc: base.desc, hcc: base.hcc, raf: base.raf,
      status: isAI ? 'New' : GEN_STATUS[hh % GEN_STATUS.length],
      type: isAI ? (hh % 2 ? 'Suspect' : 'Recapture') : null,
      docs: 1 + (hh % 3), cmts: hh % 2, notes: (hh >> 3) % 2,
      last: genLastDocumented(hh),
    };
  });
}

function generateNotLinkedForMember(name) {
  const h = hashStr(`${name}::notlinked`);
  const count = 1 + (h % 2); // 1–2 unlinked suspects/recaptures
  return pickPool(h, count).map((base) => {
    const hh = hashStr(`${name}|nl|${base.code}`);
    return {
      code: base.code, desc: base.desc, hcc: base.hcc,
      status: 'New', type: hh % 2 ? 'Suspect' : 'Recapture',
      docs: 1, cmts: hh % 2,
      last: genLastDocumented(hh),
    };
  });
}

export const getIcdsForMember = (name) =>
  ICDS[name] || (name ? generateIcdsForMember(name) : []);


export const NOT_LINKED = {
  "Annette Brave": [
    { code:"I50.23",  desc:"Acute on chronic systolic (congestive) heart failure",         hcc:"HCC 224 - Acute on Chronic Heart Failure",      status:"New", type:"Recapture", docs:1, cmts:2 },
    { code:"E11.65",  desc:"Type 2 diabetes mellitus with hyperglycemia",                  hcc:"HCC 38 - Diabetes with Glycemic Complications", status:"New", type:"Suspect",   docs:1, cmts:0 },
    { code:"N18.32",  desc:"Chronic kidney disease, stage 3b",                             hcc:"HCC 329 - Chronic Kidney Disease, Stage 3",     status:"New", type:"Suspect",   docs:1, cmts:0 },
  ],
  "Frank Green": [
    { code:"Z87.39",  desc:"Personal history of other musculoskeletal disorders",          hcc:"HCC Not Linked", status:"New", type:"Recapture", docs:1, cmts:0 },
    { code:"Z96.641", desc:"Presence of right artificial hip joint",                       hcc:"HCC Not Linked", status:"New", type:null,        docs:1, cmts:0 },
  ],
  "Christopher Thompson": [
    { code:"I25.10",  desc:"Atherosclerotic heart disease of native coronary artery",      hcc:"HCC 108 - Vascular Disease",         status:"New", type:"Recapture", docs:1, cmts:1 },
  ],
  "James Walker": [
    { code:"E66.01",  desc:"Morbid (severe) obesity due to excess calories",               hcc:"HCC 22 - Morbid Obesity",            status:"New", type:"Suspect",   docs:1, cmts:0 },
    { code:"N18.3",   desc:"Chronic kidney disease, stage 3",                             hcc:"HCC 27 - End-Stage Renal Disease",   status:"New", type:null,        docs:1, cmts:0 },
  ],
  "Daniel Martinez": [
    { code:"G47.33",  desc:"Obstructive sleep apnea",                                      hcc:"HCC 86 - Sleep Apnea",               status:"New", type:"Suspect",   docs:1, cmts:0 },
  ],
  "Robert Kim": [
    { code:"F32.1",   desc:"Major depressive disorder, single episode",                    hcc:"HCC 58 - Major Depression",          status:"New", type:"Suspect",   docs:1, cmts:1 },
  ],
  "Grace Hill": [
    { code:"I50.23",  desc:"Acute on chronic systolic (congestive) heart failure",         hcc:"HCC 224 - Acute on Chronic Heart Failure",  status:"New", type:"Recapture", docs:1, cmts:0 },
  ],
  "Cynthia Davis": [
    { code:"F32.1",   desc:"Major depressive disorder, single episode",                    hcc:"HCC 58 - Major Depression",          status:"New", type:null,        docs:1, cmts:0 },
  ],
  "Michael Ortiz": [
    { code:"I25.10",  desc:"Atherosclerotic heart disease of native coronary artery",      hcc:"HCC 108 - Vascular Disease",         status:"New", type:"Recapture", docs:2, cmts:1 },
    { code:"E66.01",  desc:"Morbid (severe) obesity due to excess calories",               hcc:"HCC 22 - Morbid Obesity",            status:"New", type:null,        docs:1, cmts:0 },
  ],
  "Charles Rivera": [
    { code:"I50.9",   desc:"Heart failure, unspecified",                                   hcc:"HCC 226 - Heart Failure, Except End-Stage",  status:"New", type:"Recapture", docs:1, cmts:0 },
  ],
  "Sandra Lee": [
    { code:"J44.1",   desc:"COPD with acute exacerbation",                                 hcc:"HCC 111 - COPD",                     status:"New", type:"Suspect",   docs:1, cmts:0 },
  ],
  "Lisa White": [
    { code:"E66.01",  desc:"Morbid (severe) obesity due to excess calories",               hcc:"HCC 22 - Morbid Obesity",            status:"New", type:"Recapture", docs:1, cmts:0 },
  ],
  "David Evans": [
    { code:"F32.1",   desc:"Major depressive disorder, single episode",                    hcc:"HCC 58 - Major Depression",          status:"New", type:"Suspect",   docs:1, cmts:0 },
  ],
  "Thomas Reed": [
    { code:"I50.9",   desc:"Heart failure, unspecified",                                   hcc:"HCC 226 - Heart Failure, Except End-Stage",  status:"New", type:"Recapture", docs:1, cmts:1 },
    { code:"G47.33",  desc:"Obstructive sleep apnea",                                      hcc:"HCC 86 - Sleep Apnea",               status:"New", type:null,        docs:1, cmts:0 },
  ],
  "Andrew Lewis": [
    { code:"G47.33",  desc:"Obstructive sleep apnea",                                      hcc:"HCC 86 - Sleep Apnea",               status:"New", type:"Suspect",   docs:1, cmts:0 },
  ],
  "William Jammy": [
    { code:"F32.1",   desc:"Major depressive disorder, single episode, moderate",          hcc:"HCC 155 - Major Depressive Disorder, Moderate", status:"New", type:"Suspect",   docs:1, cmts:0 },
  ],
  "Amanda Wilson": [
    { code:"E66.01",  desc:"Morbid (severe) obesity due to excess calories",               hcc:"HCC 22 - Morbid Obesity",            status:"New", type:"Recapture", docs:1, cmts:0 },
  ],
  "Matthew Harris": [
    { code:"G47.33",  desc:"Obstructive sleep apnea",                                      hcc:"HCC 86 - Sleep Apnea",               status:"New", type:"Suspect",   docs:1, cmts:0 },
  ],
  "Helen Park": [
    { code:"J44.1",   desc:"COPD with acute exacerbation",                                 hcc:"HCC 111 - COPD",                     status:"New", type:"Recapture", docs:1, cmts:0 },
  ],
};
export const getNotLinkedForMember = (name) =>
  NOT_LINKED[name] || (name ? generateNotLinkedForMember(name) : []);

// Single source of truth for "open ICDs" — the worklist count badge AND the
// hover popover both use this so they can never disagree. Open = not yet
// Accepted or Dismissed. AI-suggested (Suspect/Recapture) linked ICDs are
// grouped with the genuinely unlinked ones, matching the popover's sections.
const isIcdAISuggested = (i) => ['Suspect', 'Recapture'].includes(i.type || '');
const isIcdOpen = (i) => i.status !== 'Dismissed' && i.status !== 'Accepted';
export function getOpenIcdsForMember(name) {
  const open = getIcdsForMember(name).filter(isIcdOpen);
  const linked = open.filter((i) => !isIcdAISuggested(i));
  const notLinkedClean = [
    ...open.filter(isIcdAISuggested),
    ...getNotLinkedForMember(name).filter(isIcdOpen),
  ];
  return { linked, notLinkedClean, all: [...linked, ...notLinkedClean] };
}


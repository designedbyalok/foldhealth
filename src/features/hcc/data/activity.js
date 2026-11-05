// HCC activity log: ported verbatim from /Users/alokk/Downloads/HCC/hcc_worklist_v2.tsx
// (GLOBAL_ACTIVITY lines 487–551). Keyed by member.name; falls back to _default.

export const ACTIVITY = {
  "Annette Brave": [
    { t:"group", label:"Jan 2026" },
    { t:"outreach",    date:"06/01",      time:"12:30 PM", by:"Delores Conn",      role:"Coder",       dos:null,         icds:["E11.22","E11.21","E44.0","E11.51"], headline:"Outreach log for HCC 18, HCC 112 & HCC 120", tag:"Provider Communication" },
    { t:"status_dos",  date:"01/26/2026", time:"12:30 PM", by:"Benjamin Cummings", role:"QA",  dos:"03/04/2025", icds:["E11.22","E11.21","E44.0","E11.51"], headline:"DOS 03/04/2025 Status Changed", from:"New", to:"Returned" },
    { t:"status_hcc",  date:"01/24/2026", time:"12:30 PM", by:"Automation",        role:null,          dos:"03/04/2025", icds:["E11.22","E11.21","E44.0"], headline:"HCC 18, HCC 112 and HCC 120 Status Changed", from:"Open", to:"Completed" },
    { t:"accept",      date:"01/24/2026", time:"12:30 PM", by:"Delores Conn",      role:"Coder",       dos:"03/04/2025", icds:["E11.22","E11.51","E44.0"], headline:"3 ICD: E11.22, E11.51 and E44.0 Status Changed to Accept",
      details:[
        { hcc:"HCC 18 - Diabetes w/ Complications",       icd:"E11.22 - Type 2 diabetes with diabetic chronic kidney disease",                                          from:"None", to:"Accepted" },
        { hcc:"HCC 108 - Peripheral Vascular Disease",     icd:"E11.51 - Type 2 diabetes mellitus with diabetic peripheral angiopathy without gangrene",                from:"None", to:"Accepted" },
        { hcc:"HCC 120 - Protein-Calorie Malnutrition",    icd:"E44.0 - Moderate protein-calorie malnutrition",                                                         from:"None", to:"Accepted" },
      ]
    },
    { t:"dismiss",     date:"01/21/2026", time:"12:30 PM", by:"Lucy Moen",         role:"Compliance",  dos:"03/04/2025", icds:["I47.1"], headline:"ICD: I47.1  Status Changed to Dismiss",
      details:[
        { hcc:"HCC 18 - Diabetes w/ Complications", icd:"I47.1 - Supraventricular Tachycardia", reason:"Condition Not Present (Unsupported, Resolved or Transient)", note:"Condition Not Present (Unsupported, Resolved or Transient)", from:"Accepted", to:"Dismissed" }
      ]
    },
    { t:"delete",      date:"01/15/2026", time:"12:30 PM", by:"Delores Conn",      role:"Coder",       dos:"03/04/2025", icds:["E11.51"], headline:"ICD: E11.51(Manual) is Deleted",
      details:[
        { hcc:"HCC 108 - Peripheral Vascular Disease", icd:"E11.51 - Type 2 diabetes mellitus with diabetic peripheral angiopathy without gangrene" }
      ]
    },
    { t:"upload",      date:"01/15/2026", time:"12:30 PM", by:"Delores Conn",      role:"Support Team",dos:"03/04/2025", icds:["E11.51","E11.22"], headline:"Document Uploaded for HCC18 (E11.51) and HCC48 (E11.22)", file:"Tracheostomy Imaging.pdf", fileType:"Imaging Report" },
    { t:"create",      date:"01/11/2026", time:"12:30 PM", by:"Benjamin Cummings", role:"QA",  dos:"03/04/2025", icds:["E11.51"], headline:"ICD: E11.51 Created Manually" },
    { t:"assign_coder",date:"01/10/2026", time:"12:30 PM", by:"Benjamin Cummings", role:"QA",  dos:"03/04/2025", icds:["E11.22","E11.21","E44.0","E11.51"], headline:"Coder Changed", fromAvatar:{initials:"AR",name:"Dr. Aldo Richman"}, toAvatar:{initials:"BC",name:"Benjamin Cummings"} },
  ],
  "Frank Green": [
    { t:"group", label:"Jan 2026" },
    { t:"status_dos",  date:"01/26/2026", time:"10:00 AM", by:"L. Schmidt",    role:"QA",  dos:"09/28/2023", icds:["I50.9","E11.9","J44.1"],  headline:"DOS 09/28/2023 Status Changed to Completed", from:"In Progress", to:"Completed" },
    { t:"accept",      date:"01/15/2026", time:"09:00 AM", by:"L. Schmidt",    role:"QA",  dos:"09/28/2023", icds:["I50.9"],                   headline:"ICD: I50.9 Status Changed to Accept",
      details:[{ hcc:"HCC 85 - Congestive Heart Failure", icd:"I50.9 - Heart failure, unspecified", from:"None", to:"Accepted" }]
    },
    { t:"dismiss",     date:"01/12/2026", time:"03:00 PM", by:"J. Levesque",   role:"Coder",       dos:"09/28/2023", icds:["E11.9"],                   headline:"ICD: E11.9 Status Changed to Dismiss",
      details:[{ hcc:"HCC 18 - Diabetes w/ Complications", icd:"E11.9 - Type 2 DM w/o complications", reason:"Documentation insufficient", note:"No supporting notes found", from:"None", to:"Dismissed" }]
    },
    { t:"upload",      date:"01/10/2026", time:"11:00 AM", by:"L. Schmidt",    role:"Support Team",dos:"09/28/2023", icds:["J44.1","I50.9"],            headline:"Document Uploaded for HCC 111 (J44.1)", file:"COPD Evaluation.pdf", fileType:"Lab Report" },
    { t:"create",      date:"01/09/2026", time:"02:00 PM", by:"J. Levesque",   role:"Coder",       dos:"09/28/2023", icds:["J44.1"],                   headline:"ICD: J44.1 Created Manually" },
    { t:"assign_coder",date:"01/08/2026", time:"09:00 AM", by:"L. Schmidt",    role:"QA",  dos:"09/28/2023", icds:["I50.9","E11.9","J44.1"],  headline:"Coder Changed", fromAvatar:{initials:"DH",name:"D. Hintz"}, toAvatar:{initials:"JL",name:"J. Levesque"} },
  ],
  "Brian Carter": [
    { t:"group", label:"Nov 2023" },
    { t:"accept",      date:"11/29/2023", time:"02:00 PM", by:"M. Almeda",     role:"QA",  dos:"11/29/2023", icds:["F32.1","E11.65"],          headline:"2 ICD: F32.1, E11.65 Status Changed to Accept",
      details:[
        { hcc:"HCC 58 - Major Depression",             icd:"F32.1 - Major depressive disorder, single episode", from:"None", to:"Accepted" },
        { hcc:"HCC 18 - Diabetes w/ Complications",    icd:"E11.65 - Type 2 DM w/ hyperglycemia",               from:"None", to:"Accepted" },
      ]
    },
    { t:"dismiss",     date:"11/20/2023", time:"11:00 AM", by:"D. Hintz",      role:"Coder",       dos:"05/20/2024", icds:["M79.3"],                   headline:"ICD: M79.3 Status Changed to Dismiss",
      details:[{ hcc:"HCC 40 - Rheumatoid Arthritis", icd:"M79.3 - Panniculitis, unspecified", reason:"Not supported by documentation", note:"", from:"None", to:"Dismissed" }]
    },
    { t:"status_dos",  date:"11/15/2023", time:"09:00 AM", by:"D. Hintz",      role:"Coder",       dos:"11/29/2023", icds:["F32.1","E11.65","I48.91","M79.3"], headline:"DOS 11/29/2023 Status Changed", from:"New", to:"In Progress" },
    { t:"create",      date:"11/12/2023", time:"10:00 AM", by:"D. Hintz",      role:"Coder",       dos:"11/29/2023", icds:["I48.91"],                  headline:"ICD: I48.91 Created Manually" },
    { t:"upload",      date:"11/11/2023", time:"01:00 PM", by:"M. Almeda",     role:"Support Team",dos:"11/29/2023", icds:["F32.1","E11.65"],           headline:"Document Uploaded for HCC58 (F32.1)", file:"Psych Evaluation.pdf", fileType:"Clinical Note" },
    { t:"assign_coder",date:"11/10/2023", time:"09:00 AM", by:"M. Almeda",     role:"QA",  dos:"11/29/2023", icds:["F32.1","E11.65","I48.91","M79.3"], headline:"Coder Changed", fromAvatar:{initials:"AR",name:"A. Reed"}, toAvatar:{initials:"DH",name:"D. Hintz"} },
  ],
  "_default": [
    { t:"group", label:"Jan 2026" },
    { t:"status_role", date:"01/26/2026", time:"03:10 PM", by:"D. Hintz",        role:"Coder",       dos:"07/04/2024", headline:"Coder status changed to Record Requested", from:"In Progress", to:"Record Requested", note:"Progress note for 07/04/2024 is missing the signature page." },
    { t:"status_role", date:"01/25/2026", time:"11:05 AM", by:"Automation",      role:null,          dos:"07/04/2024", headline:"Coder status changed to In Progress", from:"New", to:"In Progress" },
    { t:"status_role", date:"01/25/2026", time:"11:05 AM", by:"A. Beauchamp",    role:"Support",     dos:"07/04/2024", headline:"Support status changed to Completed", from:"In Progress", to:"Completed" },
    { t:"status_hcc",  date:"01/24/2026", time:"12:30 PM", by:"Automation",      role:null,          dos:"07/04/2024", icds:["E11.21","I48.91","J44.0"], headline:"HCC 18, HCC 96 and HCC 111 Status Changed", from:"Open", to:"Completed" },
    { t:"accept",      date:"01/24/2026", time:"12:30 PM", by:"N. Richards",     role:"QA",  dos:"07/04/2024", icds:["E11.21","I48.91"],         headline:"2 ICD: E11.21, I48.91 Status Changed to Accept",
      details:[
        { hcc:"HCC 18 - Diabetes w/ Complications", icd:"E11.21 - Type 2 diabetes with diabetic nephropathy", from:"None", to:"Accepted" },
        { hcc:"HCC 96 - Atrial Fibrillation",       icd:"I48.91 - Unspecified atrial fibrillation",          from:"None", to:"Accepted" },
      ]
    },
    { t:"dismiss",     date:"01/21/2026", time:"12:30 PM", by:"Lucy Moen",       role:"Compliance",  dos:"07/04/2024", icds:["I50.9"],                   headline:"ICD: I50.9  Status Changed to Dismiss",
      details:[{ hcc:"HCC 85 - Congestive Heart Failure", icd:"I50.9 - Heart failure, unspecified", reason:"Condition Not Present (Unsupported, Resolved or Transient)", from:"Accepted", to:"Dismissed" }]
    },
    { t:"delete",      date:"01/15/2026", time:"12:30 PM", by:"D. Hintz",        role:"Coder",       dos:"07/04/2024", icds:["F32.1"],                   headline:"ICD: F32.1(Manual) is Deleted",
      details:[{ hcc:"HCC 58 - Major Depression", icd:"F32.1 - Major depressive disorder, single episode" }]
    },
    { t:"upload",      date:"01/14/2026", time:"09:00 AM", by:"A. Beauchamp",    role:"Support Team",dos:"07/04/2024", icds:["E11.21","J44.0"],          headline:"Document Uploaded for HCC18 (E11.21) and HCC111 (J44.0)", file:"Progress Note.pdf", fileType:"Visit Note" },
    { t:"create",      date:"01/11/2026", time:"12:30 PM", by:"Benjamin Cummings",role:"QA", dos:"07/04/2024", icds:["I48.91"],                  headline:"ICD: I48.91 Created Manually" },
    { t:"override",    date:"01/09/2026", time:"12:30 PM", by:"Automation",      role:null,          dos:"07/04/2024", icds:["J44.0"],                   headline:"HCC 111 Overridden by HCC 112" },
    { t:"comment",     date:"01/06/2026", time:"12:30 PM", by:"Dr Aldo Richman", role:"Physician",   dos:"07/04/2024", icds:["E11.21","F32.1"],          headline:"Added a Comment for HCC18 (E11.21), HCC58 (F32.1)" },
    { t:"assign_coder",date:"01/10/2026", time:"09:00 AM", by:"A. Beauchamp",    role:"Support",     dos:"07/04/2024", icds:["E11.21","I48.91","J44.0","I50.9","F32.1"], headline:"Coder Changed", fromAvatar:{initials:"DH",name:"D. Hintz"}, toAvatar:{initials:"NR",name:"N. Richards"} },
  ],
};
export const getActivityForMember = (name) => ACTIVITY[name] || ACTIVITY._default || [];

/**
 * DB-preferring variant: pass the `hccGapActivity` store slice
 * ({ memberName: [entry, ...] }) as `dbMap`. Returns the member's rows,
 * else the seeded '_default' rows, else the JS mock. Keeps the
 * Timeline tab working while the seed rolls out.
 */
export const getActivityFromDb = (dbMap, name) => {
  if (dbMap?.[name]?.length) return dbMap[name];
  if (dbMap?._default?.length) return dbMap._default;
  return ACTIVITY[name] || ACTIVITY._default || [];
};


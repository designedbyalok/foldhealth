// Sweep-mode ICD data: deduplicated list across all DOSes per member.
// Each entry has a `dos_entries` array showing per-DOS status / RAF / claim.
//
// Ported from /Users/ketanp/Downloads/HCC/hcc_worklist_v2.tsx (SWEEP_ICD_DATA
// lines 510–564 + getSweepICDs line 565). Falls back to `_default` for any
// member not in the map.

export const SWEEP_ICD_DATA = {
  // Annette Brave: the design reference patient (Paper 1WXT / 17R). Every
  // dos_entries date is one of her worklist DOS dates (03/04/2026,
  // 03/31/2026, 06/11/2025) so the drawer's ICD→DOS grouping mirrors the
  // worklist record. HCCs are V28.
  'Annette Brave': [
    {
      code: 'E11.22',
      desc: 'Type 2 diabetes mellitus with diabetic chronic kidney disease',
      hcc: 'HCC 37 - Diabetes with Chronic Complications',
      type: null,
      dos_entries: [
        { dos: '03/04/2026', status: 'Accepted', raf: 0.302, claimed: true  },
        { dos: '03/31/2026', status: 'New',      raf: 0.302, claimed: false },
      ],
      docs: 3, cmts: 3, notes: 0, last: '06/27/2025', by: 'Dr. Benjamin Cummings (Physician)',
    },
    {
      code: 'F32.1',
      desc: 'Major depressive disorder, single episode, moderate',
      hcc: 'HCC 155 - Major Depressive Disorder, Moderate',
      type: null,
      dos_entries: [
        { dos: '03/04/2026', status: 'New', raf: 0.309, claimed: false },
        { dos: '03/31/2026', status: 'New', raf: 0.309, claimed: false },
        { dos: '06/11/2025', status: 'New', raf: 0.309, claimed: false },
      ],
      docs: 3, cmts: 3, notes: 0, last: '06/27/2025', by: 'Dr. Benjamin Cummings (Physician)',
    },
    {
      code: 'I50.43',
      desc: 'Acute on chronic combined systolic and diastolic heart failure',
      hcc: 'HCC 224 - Acute on Chronic Heart Failure',
      type: null,
      dos_entries: [
        { dos: '03/31/2026', status: 'New', raf: 0.368, claimed: false },
        { dos: '06/11/2025', status: 'New', raf: 0.368, claimed: false },
      ],
      docs: 3, cmts: 3, notes: 0, last: '06/27/2025', by: 'Dr. Benjamin Cummings (Physician)',
    },
    {
      code: 'E41.0',
      desc: 'Nutritional marasmus',
      hcc: 'HCC Not Linked',
      type: 'Manual',
      dos_entries: [{ dos: '06/11/2025', status: 'New', raf: 0.000, claimed: false }],
      docs: 3, cmts: 3, notes: 0, last: '06/11/2025', by: 'Deborah Hintz (Coder)',
    },
  ],
  _default: [
    {
      code: 'E11.22',
      desc: 'Type 2 diabetes mellitus with diabetic chronic kidney disease',
      hcc: 'HCC 37 - Diabetes with Chronic Complications',
      type: 'Suspect',
      dos_entries: [{ dos: '03/04/2026', status: 'New', raf: 0.302, claimed: false }],
      docs: 2, cmts: 1, notes: 0, last: '06/27/2025', by: 'System',
    },
  ],
};

export const getSweepIcdsForMember = (name) =>
  SWEEP_ICD_DATA[name] || SWEEP_ICD_DATA._default;

/**
 * DB-preferring variant: pass the `hccGapSweep` store slice
 * ({ memberName: [row, ...] }) as `dbMap`. Returns the member's rows,
 * else the seeded '_default' rows, else the JS mock. Keeps the
 * DiagPanel sweep grouping working while the seed rolls out to every
 * environment.
 */
export const getSweepIcdsFromDb = (dbMap, name) => {
  if (dbMap?.[name]?.length) return dbMap[name];
  if (dbMap?._default?.length) return dbMap._default;
  return SWEEP_ICD_DATA[name] || SWEEP_ICD_DATA._default;
};

// RAF Impact breakdown per member: what conditions add up to the member's
// total RAF score. Used by the RafTooltip that appears on hover over the
// RAF Score / RAF Impact cells.
//
// Ported from /Users/ketanp/Downloads/HCC/hcc_worklist_v2.tsx (RAF_HCC_BREAKDOWN
// lines 3396–3428). Keyed by member.name; falls back to `_default` for any
// member not explicitly listed.

export const RAF_BREAKDOWN = {
  'Annette Brave': [
    { hcc: 'HCC 18',  name: 'Diabetes with Chronic Complications', impact: 0.302 },
    { hcc: 'HCC 85',  name: 'Congestive Heart Failure',            impact: 0.323 },
    { hcc: 'HCC 112', name: 'Fibrosis of Lung',                    impact: 0.156 },
    { hcc: 'HCC 120', name: 'COPD',                                impact: 0.302 },
  ],
  'Frank Green': [
    { hcc: 'HCC 22',  name: 'Morbid Obesity',                      impact: 0.368 },
    { hcc: 'HCC 55',  name: 'Drug/Alcohol Psychosis',              impact: 0.429 },
  ],
  'Brian Carter': [
    { hcc: 'HCC 18',  name: 'Diabetes with Chronic Complications', impact: 0.302 },
    { hcc: 'HCC 111', name: 'Chronic Obstructive Pulmonary Disease', impact: 0.335 },
    { hcc: 'HCC 85',  name: 'Congestive Heart Failure',            impact: 0.323 },
  ],
  'David Evans': [
    { hcc: 'HCC 17',  name: 'Diabetes with Acute Complications',   impact: 0.318 },
    { hcc: 'HCC 85',  name: 'Congestive Heart Failure',            impact: 0.323 },
    { hcc: 'HCC 59',  name: 'Major Depressive Disorder',           impact: 0.309 },
    { hcc: 'HCC 34',  name: 'Chronic Kidney Disease Stage 5',      impact: 0.289 },
  ],
  'Grace Hill': [
    { hcc: 'HCC 22',  name: 'Morbid Obesity',                      impact: 0.368 },
    { hcc: 'HCC 85',  name: 'Congestive Heart Failure',            impact: 0.323 },
    { hcc: 'HCC 106', name: 'Atherosclerosis of Arteries',         impact: 0.288 },
  ],
  _default: [
    { hcc: 'HCC 18',  name: 'Diabetes with Chronic Complications', impact: 0.185 },
    { hcc: 'HCC 22',  name: 'Morbid Obesity',                      impact: 0.129 },
    { hcc: 'HCC 85',  name: 'Congestive Heart Failure',            impact: 0.195 },
  ],
};

export const getRafBreakdown = (name) => RAF_BREAKDOWN[name] || RAF_BREAKDOWN._default;

/**
 * DB-preferring variant of getRafBreakdown: pass the `hccMemberRaf` store
 * slice ({ memberName: [{ hcc, name, impact }] }) as `dbMap`. Returns the
 * DB rows when the member is seeded, then the DB _default row, then the
 * JS mock. Keeps the RafTooltip working while the seed rolls out.
 */
export const getRafBreakdownFromDb = (dbMap, name) => {
  if (dbMap?.[name]?.length) return dbMap[name];
  if (dbMap?._default?.length) return dbMap._default;
  return RAF_BREAKDOWN[name] || RAF_BREAKDOWN._default;
};

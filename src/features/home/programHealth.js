// Team programs (program_health), shared by desktop Home and the mobile app.

// Program code → its Population worklist, for programs that have one.
export const WORKLIST = { SNP: 'SNP', AWV: 'Annual Visit', CCM: 'CCM', 'TOC IP': 'TOC IP', DM: 'DM', CMP: 'CMP', TCM: 'TCM' };

/** Needs attention first (most members flagged on top), then on track by code. */
export function sortProgramHealth(health) {
  return [...(health || [])].sort((a, b) => (b.attentionMembers > 0) - (a.attentionMembers > 0)
    || b.attentionMembers - a.attentionMembers || a.code.localeCompare(b.code));
}

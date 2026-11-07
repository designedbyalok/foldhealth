// Who owns a CMP enrollment: the Assignee, then the care team roles. Each is
// set per sub-program (one cmp_members row each).
export const CMP_CARE_TEAM_ROLES = [
  { key: 'nurseHealthCoach', label: 'Nurse/Health Coach' },
  { key: 'coordinator', label: 'Coordinator' },
  { key: 'socialWorker', label: 'Social Worker' },
  { key: 'communityHealthWorker', label: 'Community Health Worker' },
];
export const CMP_OWNER_ROLES = [{ key: 'assignee', label: 'Assignee' }, ...CMP_CARE_TEAM_ROLES];

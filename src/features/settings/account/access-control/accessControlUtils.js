export const usersWithRole = (people, roleName) =>
  (people || []).filter(p => roleName && (p.clinicalRoles || []).includes(roleName));

// Deleting a role is blocked while anyone would be left with no role at all.
export const usersWithOnlyRole = (people, roleName) =>
  (people || []).filter(p => (p.clinicalRoles || []).length === 1 && p.clinicalRoles[0] === roleName);

const BUILT_IN_HINT = 'Built-in roles keep their name';

/** The ⋯ menu for a role card and the permissions header. */
export function roleMenuItems(role, canEdit) {
  if (!canEdit) return [];
  return [
    { key: 'duplicate', icon: 'solar:copy-linear', label: 'Duplicate' },
    { key: 'rename', icon: 'solar:pen-new-square-linear', label: 'Rename', disabled: role.builtIn, hint: role.builtIn ? BUILT_IN_HINT : undefined },
    { key: 'copy', icon: 'solar:shield-linear', label: 'Copy Permissions' },
    { key: 'delete', icon: 'solar:trash-bin-2-linear', label: 'Delete Role', danger: true, disabled: role.builtIn, hint: role.builtIn ? 'Built-in roles can\'t be deleted' : undefined },
  ];
}

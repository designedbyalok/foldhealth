import { clinicalRolesPickerLabel } from '../../../lib/worklistAssignee';
import { initialsOf } from '../mobileFormat';

// Same exclusion as the desktop SNP / CMP / Pharmacy assignee cells: HCC-only
// roles never own a program row.
const HCC_ONLY_ROLES = new Set(['Coder', 'Support', 'QA', 'Compliance']);

/** platformUsers as picker rows ({ id, name, initials, role }), as the desktop cells build them. */
export function pickerUsers(platformUsers, { excludeHccOnly = false } = {}) {
  return (platformUsers || [])
    .filter(u => u?.name && !(excludeHccOnly && u.clinicalRoles?.some(r => HCC_ONLY_ROLES.has(r))))
    .map(u => ({ id: u.id, name: u.name, initials: u.initials || initialsOf(u.name), role: clinicalRolesPickerLabel(u) }));
}

import { useProgramAccess } from '../../../patient/hooks/useProgramAccess';

/**
 * Whether the signed-in user manages the template library: import, approve
 * and publish versions. Supervisors and admins do, and so does anyone not
 * limited to particular programs.
 */
export function useCanManageTemplates() {
  const access = useProgramAccess();
  return !access.scoped || access.admin || Object.values(access.levels || {}).includes('supervisor');
}

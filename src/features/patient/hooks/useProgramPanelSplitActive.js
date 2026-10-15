import { useAppStore } from '../../../store/useAppStore';
import { showsPatientCarePlan } from '../right-panel/tabs/care-programs/care-plan/lib/carePlanMode';

// Sub-tabs that don't host the program detail; any other stored value
// resolves to Care Programs in CareManagementView.
const NON_PROGRAM_SUBTABS = new Set(['Care Plan', 'Comprehensive Care Plan', 'Program Activity Log']);

/**
 * What the split layout's main right-hand panel shows, or null when the
 * split doesn't apply. It applies when the user chose "Open in Right Panel",
 * the floating sidebar is on, and the Care Management tab is showing either
 * an open care program ('program') or, for orgs that plan at patient level,
 * the patient's Care Plan ('patient-plan').
 */
function splitTarget(s) {
  if (!s.programPanelSplit || s.sidebarShape !== 'floating' || !s.selectedPatientId) return null;
  if (s.patientProfileTab !== 'Care Management') return null;
  if (s.careManagementTab === 'Care Plan' && showsPatientCarePlan(s.carePlanMode)) return 'patient-plan';
  if (s.selectedCareProgramKey && !NON_PROGRAM_SUBTABS.has(s.careManagementTab)) return 'program';
  return null;
}

export function useProgramPanelSplitTarget() {
  return useAppStore(splitTarget);
}

export function useProgramPanelSplitActive() {
  return useAppStore(s => splitTarget(s) !== null);
}

/**
 * The "Open in Right Panel" / "Open Inline" entry for a ••• menu (care
 * program header, care plan header), plus its handler. Floating-shell only,
 * so `items` is empty with the standard sidebar. `select(key)` returns true
 * when it handled the key.
 */
export function useRightPanelMenuOption() {
  const floating = useAppStore(s => s.sidebarShape === 'floating');
  const split = useAppStore(s => s.programPanelSplit);
  const setProgramPanelSplit = useAppStore(s => s.setProgramPanelSplit);
  const items = floating
    ? [
      split
        ? { key: 'panel', icon: 'solar:minimize-square-minimalistic-linear', label: 'Open Inline' }
        : { key: 'panel', icon: 'solar:sidebar-minimalistic-linear', label: 'Open in Right Panel' },
      { divider: true },
    ]
    : [];
  const select = (key) => {
    if (key !== 'panel') return false;
    setProgramPanelSplit(!split);
    return true;
  };
  return { items, select };
}

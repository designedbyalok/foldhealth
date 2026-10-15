import { useAppStore } from '../../../store/useAppStore';

// Sub-tabs that don't host the program detail; any other stored value
// resolves to Care Programs in CareManagementView.
const NON_PROGRAM_SUBTABS = new Set(['Care Plan', 'Comprehensive Care Plan', 'Program Activity Log']);

/**
 * True when the open care program should render as its own right-hand card
 * beside the patient card: the user chose "Open in right panel", the floating
 * sidebar is on, and a program is open on the Care Management tab.
 */
export function useProgramPanelSplitActive() {
  return useAppStore(s => (
    s.programPanelSplit
    && s.sidebarShape === 'floating'
    && !!s.selectedPatientId
    && !!s.selectedCareProgramKey
    && s.patientProfileTab === 'Care Management'
    && !NON_PROGRAM_SUBTABS.has(s.careManagementTab)
  ));
}

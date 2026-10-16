import { useAppStore } from '../../../store/useAppStore';
import { showsPatientCarePlan, isPatientLevelProgram } from '../right-panel/tabs/care-programs/care-plan/lib/carePlanMode';

// Sub-tabs that don't host the program detail; any other stored value
// resolves to Care Programs in CareManagementView.
const NON_PROGRAM_SUBTABS = new Set(['Care Plan', 'Comprehensive Care Plan', 'Program Activity Log']);

/**
 * What the split layout's main right-hand panel shows, or null when the
 * split doesn't apply. Floating sidebar only. It applies when:
 * - the HCC Diagnosis Gaps Details was opened in the side panel and its
 *   member is the open patient ('diag');
 * - the user chose "Open in Right Panel" and the Care Management tab is
 *   showing an open care program ('program') or, for orgs that plan at
 *   patient level, the patient's Care Plan ('patient-plan').
 */
function splitTarget(s) {
  if (s.sidebarShape !== 'floating' || !s.selectedPatientId) return null;
  if (s.diagPanelOpen && s.diagPanelSplit && s.activePage === 'population'
    && String(s.diagPanelMemberId) === String(s.selectedPatientId)) return 'diag';
  if (!s.programPanelSplit) return null;
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

/** True while Diagnosis Gaps Details is the split's main panel (so not a drawer). */
export function useDiagPanelInSplit() {
  return useAppStore(s => splitTarget(s) === 'diag');
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

/** Panel id of a program's care plan opened as its own panel in the split. */
export const CARE_PLAN_PANEL_ID = 'careplan';

// The stack for the open program, or a fresh one (program alone) when the
// stored stack was built over a different main panel.
function programStack(s) {
  const key = s.selectedCareProgramKey;
  const cur = s.programPanelStack;
  return cur && cur.programKey === key ? cur : { programKey: key, ids: ['program'], activeId: 'program' };
}

/** Open (or focus) the open program's care plan as its own panel, first in the stack. */
export function openCarePlanPanel() {
  const st = useAppStore.getState();
  const base = programStack(st);
  const ids = base.ids.includes(CARE_PLAN_PANEL_ID) ? base.ids : [CARE_PLAN_PANEL_ID, ...base.ids];
  st.setProgramPanelStack({ ...base, ids, activeId: CARE_PLAN_PANEL_ID });
}

/** Close the care plan panel; the program's Care Plan step shows it again. */
export function closeCarePlanPanel() {
  const st = useAppStore.getState();
  const base = programStack(st);
  const idx = base.ids.indexOf(CARE_PLAN_PANEL_ID);
  if (idx < 0) return;
  const ids = base.ids.filter(id => id !== CARE_PLAN_PANEL_ID);
  const activeId = base.activeId === CARE_PLAN_PANEL_ID ? ids[Math.min(idx, ids.length - 1)] : base.activeId;
  st.setProgramPanelStack({ ...base, ids, activeId });
}

/** Bring the care plan panel into focus. */
export function focusCarePlanPanel() {
  const st = useAppStore.getState();
  st.setProgramPanelStack({ ...programStack(st), activeId: CARE_PLAN_PANEL_ID });
}

/** True when the open program's care plan is showing as its own panel. */
export function useCarePlanPanelOpen() {
  return useAppStore(s => splitTarget(s) === 'program' && programStack(s).ids.includes(CARE_PLAN_PANEL_ID));
}

/**
 * The care plan header's ⋯ entry, by where the header is (floating sidebar
 * only):
 * - patient-level plan: the same Open in Right Panel / Open Inline toggle
 *   the program menu has;
 * - a program's Care Plan step, split on: "Open in Separate Panel";
 * - a program's Care Plan step, split off: "Open in Right Panel" switches to
 *   the split with the plan already in its own panel;
 * - inside the care plan panel: "Show in Program" closes the panel.
 * `select(key)` returns true when it handled the key.
 */
export function useCarePlanPanelMenu({ program, inPanel = false }) {
  const toggle = useRightPanelMenuOption();
  const target = useProgramPanelSplitTarget();
  const setProgramPanelSplit = useAppStore(s => s.setProgramPanelSplit);
  const floating = toggle.items.length > 0;
  if (!floating) return { items: [], select: () => false };
  if (isPatientLevelProgram(program)) return toggle;

  const item = inPanel
    ? { key: 'careplan-panel', icon: 'solar:minimize-square-minimalistic-linear', label: 'Show in Program' }
    : target === 'program'
      ? { key: 'careplan-panel', icon: 'solar:sidebar-minimalistic-linear', label: 'Open in Separate Panel' }
      : { key: 'careplan-panel', icon: 'solar:sidebar-minimalistic-linear', label: 'Open in Right Panel' };
  const select = (key) => {
    if (key !== 'careplan-panel') return false;
    if (inPanel) closeCarePlanPanel();
    else {
      if (target !== 'program') setProgramPanelSplit(true);
      openCarePlanPanel();
    }
    return true;
  };
  return { items: [item, { divider: true }], select };
}

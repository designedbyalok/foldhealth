// Care Plan Library — organized by domain for easy selection
// panel/   → library list (tabs: template/goals/interventions/barriers)
// create/  → full-pane template creation
// goals/   → goal drawers + pickers
// interventions/ → vital / form / content drawers
// lib/     → shared formatting & options

export { CarePlanLibraryPanel } from './panel/CarePlanLibraryPanel/CarePlanLibraryPanel.jsx';
export { CarePlanCreateView } from './create/CarePlanCreateView/CarePlanCreateView.jsx';
export { CreateGoalDrawer } from './goals/CreateGoalDrawer/CreateGoalDrawer.jsx';
export { AddGoalsDrawer } from './goals/AddGoalsDrawer/AddGoalsDrawer.jsx';
export { InterventionDrawer, INTERVENTION_EDITORS } from './interventions/index.js';

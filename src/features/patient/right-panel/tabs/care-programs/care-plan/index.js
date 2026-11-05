// care-plan: dedicated Care Plan module
// Elevated from program-detail/steps/CarePlanView because Care Plan is a
// large, multi-workflow feature (goals, interventions, sharing, versions,
// history, export, summary). Keeping it at care-programs/care-plan/ makes
// the ownership explicit and prevents steps/ from becoming a catch-all.
//
// Structure:
//   CarePlanView/: core table view (goals + interventions)
//   drawers/: one folder per workflow drawer
//   lib/: export/template logic (carePlanExport)
//   summary/: cross-program read-only snapshot (CarePlanSummaryView)

export { CarePlanView } from './CarePlanView/CarePlanView.jsx';
export { CarePlanSummaryView } from './summary/CarePlanSummaryView/CarePlanSummaryView.jsx';
export { buildCarePlanHtml, downloadCarePlanDocument } from './lib/carePlanExport.js';

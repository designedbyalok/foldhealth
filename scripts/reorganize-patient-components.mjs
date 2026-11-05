#!/usr/bin/env node
/**
 * Reorganizes src/features/patient/components into tab/section folders.
 * Each component gets its own folder with co-located .jsx + .module.css files.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';
import { execSync } from 'child_process';

const ROOT = resolve(process.cwd());
const PATIENT = join(ROOT, 'src/features/patient');
const OLD_COMPONENTS = join(PATIENT, 'components');
const SRC = join(ROOT, 'src');

/** @type {Record<string, string>} component base name -> path under patient/ (no ext) */
const COMPONENT_DEST = {
  // Shell: profile chrome
  PatientP360Banner: 'shell/PatientP360Banner/PatientP360Banner',
  ProfileTabBar: 'shell/ProfileTabBar/ProfileTabBar',
  CcmTimerWidget: 'shell/CcmTimerWidget/CcmTimerWidget',
  PatientHeader: 'shell/PatientHeader/PatientHeader',

  // Left panel
  PatientProfileTabs: 'left-panel/PatientProfileTabs/PatientProfileTabs',

  // Left panel: Gaps tab
  CareGapSection: 'left-panel/tabs/gaps/CareGapSection/CareGapSection',
  CareGapItem: 'left-panel/tabs/gaps/CareGapItem/CareGapItem',
  DiagnosisGapsTable: 'left-panel/tabs/gaps/DiagnosisGapsTable/DiagnosisGapsTable',
  AlertsTable: 'left-panel/tabs/gaps/AlertsTable/AlertsTable',

  // Left panel: other tabs
  PAMIHxTab: 'left-panel/tabs/pami-hx/PAMIHxTab/PAMIHxTab',
  VitalsLabsTab: 'left-panel/tabs/vitals-labs/VitalsLabsTab/VitalsLabsTab',
  CommsTab: 'left-panel/tabs/comms/CommsTab/CommsTab',
  OutreachTab: 'left-panel/tabs/outreach/OutreachTab/OutreachTab',
  AddTaskDrawer: 'left-panel/tabs/outreach/AddTaskDrawer/AddTaskDrawer',
  SummaryTab: 'left-panel/tabs/summary/SummaryTab/SummaryTab',
  TasksTab: 'left-panel/tabs/tasks/TasksTab/TasksTab',

  // Shared widgets (Summary + Overview)
  HealthMapWidget: 'shared/widgets/HealthMapWidget/HealthMapWidget',
  PatientSynopsisWidget: 'shared/widgets/PatientSynopsisWidget/PatientSynopsisWidget',
  CareUtilizationWidget: 'shared/widgets/CareUtilizationWidget/CareUtilizationWidget',
  PriorAuthWidget: 'shared/widgets/PriorAuthWidget/PriorAuthWidget',
  PopulationGroupsWidget: 'shared/widgets/PopulationGroupsWidget/PopulationGroupsWidget',
  CareJourneysWidget: 'shared/widgets/CareJourneysWidget/CareJourneysWidget',
  SubscriptionWidget: 'shared/widgets/SubscriptionWidget/SubscriptionWidget',
  ActiveAutomationsWidget: 'shared/widgets/ActiveAutomationsWidget/ActiveAutomationsWidget',
  InsuranceWidget: 'shared/widgets/InsuranceWidget/InsuranceWidget',

  // Right panel: Overview
  OverviewTab: 'right-panel/tabs/overview/OverviewTab/OverviewTab',
  AppointmentsDrawer: 'right-panel/tabs/overview/AppointmentsDrawer/AppointmentsDrawer',

  // Right panel: Care Management
  CareManagementView: 'right-panel/tabs/care-management/CareManagementView/CareManagementView',
  ProgramActivityCard: 'right-panel/tabs/care-management/ProgramActivityCard/ProgramActivityCard',
  TimelineItem: 'right-panel/tabs/care-management/TimelineItem/TimelineItem',

  // Right panel: Care Programs
  CareProgramsTab: 'right-panel/tabs/care-programs/CareProgramsTab/CareProgramsTab',
  ProgramDetailView: 'right-panel/tabs/care-programs/program-detail/ProgramDetailView/ProgramDetailView',
  ProgramDetailSkeleton: 'right-panel/tabs/care-programs/program-detail/shared/ProgramDetailSkeleton/ProgramDetailSkeleton',
  ProgramStatusRing: 'right-panel/tabs/care-programs/program-detail/shared/ProgramStatusRing/ProgramStatusRing',
  ProgramBadges: 'right-panel/tabs/care-programs/program-detail/shared/ProgramBadges/ProgramBadges',

  // Care Plan: dedicated module (elevated from steps)
  CarePlanView: 'right-panel/tabs/care-programs/care-plan/CarePlanView/CarePlanView',
  CarePlanShareDrawer: 'right-panel/tabs/care-programs/care-plan/drawers/CarePlanShareDrawer/CarePlanShareDrawer',
  CarePlanHistoryDrawer: 'right-panel/tabs/care-programs/care-plan/drawers/CarePlanHistoryDrawer/CarePlanHistoryDrawer',
  CarePlanVersionsDrawer: 'right-panel/tabs/care-programs/care-plan/drawers/CarePlanVersionsDrawer/CarePlanVersionsDrawer',
  AddInterventionDrawer: 'right-panel/tabs/care-programs/care-plan/drawers/AddInterventionDrawer/AddInterventionDrawer',
  CarePlanSummaryView: 'right-panel/tabs/care-programs/care-plan/summary/CarePlanSummaryView/CarePlanSummaryView',

  // Program detail: steps (CarePlanView now lives in care-plan/)
  PreVisitStep: 'right-panel/tabs/care-programs/program-detail/steps/PreVisitStep/PreVisitStep',
  AssessmentFormView: 'right-panel/tabs/care-programs/program-detail/steps/AssessmentFormView/AssessmentFormView',
  AppointmentStep: 'right-panel/tabs/care-programs/program-detail/steps/AppointmentStep/AppointmentStep',
  PostVisitChecklist: 'right-panel/tabs/care-programs/program-detail/steps/PostVisitChecklist/PostVisitChecklist',
  OpenCareGaps: 'right-panel/tabs/care-programs/program-detail/steps/OpenCareGaps/OpenCareGaps',
  MedicationReconciliation: 'right-panel/tabs/care-programs/program-detail/steps/MedicationReconciliation/MedicationReconciliation',
  ReferralReview: 'right-panel/tabs/care-programs/program-detail/steps/ReferralReview/ReferralReview',

  // Program detail: billing
  CcmBillingReview: 'right-panel/tabs/care-programs/program-detail/billing/CcmBillingReview/CcmBillingReview',
  CcmBillingLogTable: 'right-panel/tabs/care-programs/program-detail/billing/CcmBillingLogTable/CcmBillingLogTable',
  CcmBillingReportDrawer: 'right-panel/tabs/care-programs/program-detail/billing/CcmBillingReportDrawer/CcmBillingReportDrawer',
  CcmUnloggedTable: 'right-panel/tabs/care-programs/program-detail/billing/CcmUnloggedTable/CcmUnloggedTable',
  CcmUnloggedDrawer: 'right-panel/tabs/care-programs/program-detail/billing/CcmUnloggedDrawer/CcmUnloggedDrawer',

  // Program detail: letters
  SendLetterDrawer: 'right-panel/tabs/care-programs/program-detail/letters/SendLetterDrawer/SendLetterDrawer',
  AddLetterDrawer: 'right-panel/tabs/care-programs/program-detail/letters/AddLetterDrawer/AddLetterDrawer',
  LetterHistoryDrawer: 'right-panel/tabs/care-programs/program-detail/letters/LetterHistoryDrawer/LetterHistoryDrawer',
  LetterPreviewDrawer: 'right-panel/tabs/care-programs/program-detail/letters/LetterPreviewDrawer/LetterPreviewDrawer',

  // Program detail: related
  ProgramRelatedTasks: 'right-panel/tabs/care-programs/program-detail/related/ProgramRelatedTasks/ProgramRelatedTasks',
  ProgramRelatedFiles: 'right-panel/tabs/care-programs/program-detail/related/ProgramRelatedFiles/ProgramRelatedFiles',
};

function toPosix(p) {
  return p.split('\\').join('/');
}

function relImport(fromFile, importTargetAbs) {
  let rel = toPosix(relative(dirname(fromFile), importTargetAbs));
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel;
}

function moveComponent(name, destBase) {
  const jsxOld = join(OLD_COMPONENTS, `${name}.jsx`);
  const cssOld = join(OLD_COMPONENTS, `${name}.module.css`);
  const destDir = join(PATIENT, dirname(destBase));
  mkdirSync(destDir, { recursive: true });

  const jsxNew = join(PATIENT, `${destBase}.jsx`);
  const cssNew = join(PATIENT, `${destBase}.module.css`);

  if (existsSync(jsxOld)) {
    execSync(`git mv "${jsxOld}" "${jsxNew}"`, { cwd: ROOT, stdio: 'inherit' });
  }
  if (existsSync(cssOld)) {
    execSync(`git mv "${cssOld}" "${cssNew}"`, { cwd: ROOT, stdio: 'inherit' });
  }
}

function resolveOldImport(fromFile, importPath) {
  if (!importPath.startsWith('.')) return null;

  // Sibling component: ./Foo or ./Foo.module.css
  const sibling = importPath.match(/^\.\/([^./]+)(\.module\.css)?$/);
  if (sibling) {
    const base = sibling[1];
    if (COMPONENT_DEST[base]) {
      const ext = sibling[2] ? '.module.css' : '.jsx';
      return join(PATIENT, `${COMPONENT_DEST[base]}${ext}`);
    }
  }

  // Resolve as if file still lived in old components/ dir
  const oldDir = OLD_COMPONENTS;
  return resolve(oldDir, importPath);
}

function fixImportsInFile(filePath) {
  let content = readFileSync(filePath, 'utf8');
  const importRe = /(\bfrom\s+['"]|import\s+['"])([^'"]+)(['"])/g;

  content = content.replace(importRe, (full, prefix, importPath, suffix) => {
    if (!importPath.startsWith('.')) return full;

    const absOld = resolveOldImport(filePath, importPath);
    if (!absOld) return full;

    // Map data imports to patient/data even if path changed
    if (importPath.includes('/data/') || importPath.startsWith('../data/')) {
      const dataFile = importPath.replace(/^(\.\.\/)+data\//, '');
      const target = join(PATIENT, 'data', dataFile);
      return `${prefix}${relImport(filePath, target)}${suffix}`;
    }

    // Map to src/components, src/store, or other features via old absolute resolution
    let target = absOld;
    if (importPath.includes('.module.css')) {
      // css module: target is the resolved css file path
      if (!existsSync(target)) {
        const base = importPath.match(/\.\/([^./]+)\.module\.css/)?.[1];
        if (base && COMPONENT_DEST[base]) {
          target = join(PATIENT, `${COMPONENT_DEST[base]}.module.css`);
        }
      }
    } else if (!existsSync(target) && !importPath.endsWith('.css')) {
      // Might be .jsx that moved
      const base = importPath.match(/\.\/([^./]+)$/)?.[1];
      if (base && COMPONENT_DEST[base]) {
        target = join(PATIENT, `${COMPONENT_DEST[base]}.jsx`);
      }
    }

    // For paths that pointed outside patient (components, store, features/*)
    if (importPath.includes('../../') && !COMPONENT_DEST[importPath.split('/').pop()]) {
      target = resolve(OLD_COMPONENTS, importPath);
    }

    const newPath = relImport(filePath, target);
    return `${prefix}${newPath}${suffix}`;
  });

  writeFileSync(filePath, content);
}

function walkFiles(dir, ext, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walkFiles(p, ext, out);
    else if (p.endsWith(ext)) out.push(p);
  }
  return out;
}

function updateExternalImports() {
  const replacements = [
    [
      /from ['"]\.\/components\/PatientP360Banner['"]/g,
      "from './shell/PatientP360Banner/PatientP360Banner'",
    ],
    [
      /from ['"]\.\/components\/PatientProfileTabs['"]/g,
      "from './left-panel/PatientProfileTabs/PatientProfileTabs'",
    ],
    [
      /from ['"]\.\/components\/ProfileTabBar['"]/g,
      "from './shell/ProfileTabBar/ProfileTabBar'",
    ],
    [
      /from ['"]\.\/components\/CareManagementView['"]/g,
      "from './right-panel/tabs/care-management/CareManagementView/CareManagementView'",
    ],
    [
      /from ['"]\.\/components\/CareProgramsTab['"]/g,
      "from './right-panel/tabs/care-programs/CareProgramsTab/CareProgramsTab'",
    ],
    [
      /from ['"]\.\/components\/OverviewTab['"]/g,
      "from './right-panel/tabs/overview/OverviewTab/OverviewTab'",
    ],
    [
      /from ['"]\.\/components\/CcmTimerWidget['"]/g,
      "from './shell/CcmTimerWidget/CcmTimerWidget'",
    ],
    [
      /from ['"]\.\.\/\.\.\/features\/patient\/components\/PatientP360Banner['"]/g,
      "from '../../features/patient/shell/PatientP360Banner/PatientP360Banner'",
    ],
    [
      /from ['"]\.\.\/\.\.\/features\/patient\/components\/PatientProfileTabs['"]/g,
      "from '../../features/patient/left-panel/PatientProfileTabs/PatientProfileTabs'",
    ],
  ];

  const files = walkFiles(join(ROOT, 'src'), '.jsx');
  for (const file of files) {
    let content = readFileSync(file, 'utf8');
    let changed = false;
    for (const [re, rep] of replacements) {
      if (re.test(content)) {
        content = content.replace(re, rep);
        changed = true;
      }
    }
    if (changed) writeFileSync(file, content);
  }
}

// ── Run ──
console.log('Moving patient components…');
for (const [name, dest] of Object.entries(COMPONENT_DEST)) {
  moveComponent(name, dest);
}

console.log('Fixing imports…');
const patientFiles = [
  ...walkFiles(PATIENT, '.jsx'),
  ...walkFiles(PATIENT, '.css'),
];
for (const file of patientFiles) {
  if (file.includes('/components/') && !file.includes('/program-detail/')) {
    // skip old components dir if anything left
  }
  if (file.endsWith('.jsx') || file.endsWith('.css')) {
    fixImportsInFile(file);
  }
}

// PatientDetailView at patient root
fixImportsInFile(join(PATIENT, 'PatientDetailView.jsx'));

updateExternalImports();

// Remove empty components directory if possible
try {
  const remaining = readdirSync(OLD_COMPONENTS);
  if (remaining.length === 0) {
    execSync(`rmdir "${OLD_COMPONENTS}"`, { cwd: ROOT });
    console.log('Removed empty components/ directory.');
  } else {
    console.warn('components/ not empty:', remaining);
  }
} catch {
  // already gone
}

console.log('Done.');

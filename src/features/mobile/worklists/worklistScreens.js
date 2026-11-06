import { AiTasksScreen } from './AiTasksScreen';
import { HedisGapScreen } from './HedisGapScreen';
import { PharmacyMemberScreen } from './PharmacyMemberScreen';
import { PharmacyOutreachScreen } from './PharmacyOutreachScreen';

// Worklist action screens pushed from the worklist cards.
export const WORKLIST_SCREENS = {
  worklistGap: HedisGapScreen,
  worklistPharmacy: PharmacyMemberScreen,
  worklistPharmacyOutreach: PharmacyOutreachScreen,
  worklistAiTasks: AiTasksScreen,
};
// Pinned composer / Log Outreach footer: no tab bar under them.
export const WORKLIST_FULL_SCREEN = ['worklistGap', 'worklistPharmacy', 'worklistPharmacyOutreach'];

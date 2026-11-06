import { MoreScreen } from './MoreScreen';
import { CampaignsScreen } from '../campaigns/CampaignsScreen';
import { AutomationsScreen } from '../automations/AutomationsScreen';
import { AutomationScreen } from '../automations/AutomationScreen';
import { AutomationRunScreen } from '../automations/AutomationRunScreen';
import { AgentsScreen } from '../automations/AgentsScreen';
import { AgentScreen } from '../automations/AgentScreen';
import { FormsScreen } from '../forms/FormsScreen';
import { FormFillScreen } from '../forms/FormFillScreen';
import { FormResponsesScreen } from '../forms/FormResponsesScreen';
import { ContentScreen } from '../forms/ContentScreen';
import { SettingsScreen } from '../settings/SettingsScreen';
import { EditProfileScreen } from '../settings/EditProfileScreen';
import { AvailabilityScreen } from '../settings/AvailabilityScreen';
import { AvailabilitySlotScreen } from '../settings/AvailabilitySlotScreen';
import { BusinessHoursScreen } from '../settings/BusinessHoursScreen';

// The More hub (from Profile) and the desktop areas it opens.
export const MORE_SCREENS = {
  more: MoreScreen,
  campaigns: CampaignsScreen,
  automations: AutomationsScreen,
  automation: AutomationScreen,
  automationRun: AutomationRunScreen,
  aiAgents: AgentsScreen,
  aiAgent: AgentScreen,
  forms: FormsScreen,
  formFill: FormFillScreen,
  formResponses: FormResponsesScreen,
  contentLibrary: ContentScreen,
  settingsHome: SettingsScreen,
  myProfileEdit: EditProfileScreen,
  myAvailability: AvailabilityScreen,
  availabilitySlot: AvailabilitySlotScreen,
  businessHours: BusinessHoursScreen,
};
// Screens with a pinned footer action hide the tab bar.
export const MORE_FULL_SCREEN = ['automation', 'automationRun', 'formFill', 'myProfileEdit', 'myAvailability', 'availabilitySlot', 'businessHours'];

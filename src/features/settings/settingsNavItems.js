/**
 * Settings sub-nav definition: single source for the section list, their
 * store nav keys (which double as SideNav keys), and display labels.
 * Consumed by SettingsSubNav (rendering) and SettingsLayout (empty-state
 * titles); URL slugs live in src/lib/router.js (SETTINGS_SECTION_TO_NAV).
 */
export const SETTINGS_MENU_ITEMS = [
  { icon: 'solar:user-check-rounded-linear', label: 'Member/Leads' },
  { icon: 'solar:calendar-date-linear', label: 'Calendar', key: 'calendar' },
  { icon: 'solar:checklist-minimalistic-linear', label: 'Tasks', key: 'tasks' },
  { icon: 'solar:chat-square-linear', label: 'Messages', key: 'messages' },
  { icon: 'solar:phone-linear', label: 'Calls', key: 'calls' },
  { icon: 'solar:clipboard-list-linear', label: 'Care Plan Library', key: 'care-plan-library' },
  { icon: 'solar:health-linear', label: 'Care Program Configuration', key: 'care-program-config' },
  { icon: 'solar:widget-add-linear', label: 'CRM Widgets', key: 'crm-widgets' },
  { icon: 'solar:code-square-linear', label: 'Embed', key: 'embedded-components' },
  { icon: 'solar:documents-linear', label: 'Content', key: 'content' },
  { icon: 'solar:watch-square-linear', label: 'Wearables', key: 'wearables' },
  { icon: 'solar:rocket-linear', label: 'Journeys', key: 'journeys' },
  { icon: 'solar:ghost-smile-linear', label: 'Agents', key: 'agents' },
  { icon: 'solar:bolt-linear', label: 'Automations', key: 'automations' },
  { icon: 'solar:library-linear', label: 'Cost Template', key: 'cost-template' },
  { icon: 'solar:user-id-linear', label: 'Memberships', key: 'memberships' },
  { icon: 'solar:bill-list-linear', label: 'Billing', key: 'billing' },
  { icon: 'solar:shield-user-linear', label: 'Account', key: 'account' },
];

export const SECTION_LABELS = Object.fromEntries(
  SETTINGS_MENU_ITEMS.map(item => [item.key || item.label.toLowerCase(), item.label]),
);

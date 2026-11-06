import { useMemo } from 'react';
import { useCan } from '../../../lib/useCan';
import { settingsPermissionKey } from '../../../lib/accessControl';
import { MobileSubHeader } from '../MobileHeader';
import { MobileEmpty } from '../MobileParts';
import { useMobileNav } from '../MobileNavContext';
import { GroupedRow, GroupedSection } from './GroupedList';
import common from '../mobile.module.css';
import styles from './more.module.css';

// Everything the desktop sidebar and Settings hold that has no bottom tab.
// `perm` is the desktop nav permission; `section` adds the Settings section
// permission (settings:<section>) the desktop sub-nav checks.
const GROUPS = [
  {
    label: 'Work',
    items: [
      { key: 'tasks', icon: 'solar:checklist-minimalistic-linear', label: 'Tasks', perm: 'nav:tasks' },
      { key: 'analytics', icon: 'solar:chart-2-linear', label: 'Analytics', perm: 'nav:analytics' },
    ],
  },
  {
    label: 'Engagement',
    items: [
      { key: 'campaigns', icon: 'solar:letter-linear', label: 'Campaigns', perm: 'nav:campaign' },
      { key: 'automations', icon: 'solar:bolt-linear', label: 'Automations', perm: 'nav:settings', section: 'automations' },
      { key: 'aiAgents', icon: 'solar:ghost-smile-linear', label: 'AI Agents', perm: 'nav:settings', section: 'agents' },
      { key: 'forms', icon: 'solar:clipboard-text-linear', label: 'Forms', perm: 'nav:settings', section: 'content' },
      { key: 'contentLibrary', icon: 'solar:documents-linear', label: 'Content library', perm: 'nav:settings', section: 'content' },
    ],
  },
  {
    label: 'Me',
    items: [
      { key: 'myAvailability', icon: 'solar:calendar-date-linear', label: 'My Availability', perm: 'nav:settings', section: 'calendar' },
      { key: 'settingsHome', icon: 'solar:settings-linear', label: 'Settings', perm: 'nav:settings' },
    ],
  },
];

/** More: the desktop areas without a bottom tab, as a grouped list. */
export function MoreScreen() {
  const { push } = useMobileNav();
  const can = useCan();
  const groups = useMemo(() => GROUPS
    .map(g => ({ ...g, items: g.items.filter(i => can(i.perm) && (!i.section || can(settingsPermissionKey(i.section)))) }))
    .filter(g => g.items.length), [can]);

  return (
    <div className={common.screen}>
      <MobileSubHeader title="More" />
      <div className={common.body}>
        {groups.length === 0 ? (
          <MobileEmpty icon="solar:lock-keyhole-linear" title="Nothing more to show" description="Ask your admin for access to more of Fold Health." />
        ) : (
          <div className={styles.stack}>
            {groups.map(g => (
              <GroupedSection key={g.label} label={g.label}>
                {g.items.map(i => <GroupedRow key={i.key} icon={i.icon} label={i.label} onClick={() => push(i.key)} />)}
              </GroupedSection>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useMemo } from 'react';
import { DesktopOnlyNote } from '../../../components/DesktopOnlyNote/DesktopOnlyNote';
import { useCan } from '../../../lib/useCan';
import { settingsPermissionKey, settingsSectionKey } from '../../../lib/accessControl';
import { SETTINGS_MENU_ITEMS } from '../../settings/settingsNavItems';
import { MobileSubHeader } from '../MobileHeader';
import { useMobileNav } from '../MobileNavContext';
import { GroupedRow, GroupedSection } from '../more/GroupedList';
import common from '../mobile.module.css';
import more from '../more/more.module.css';

// Settings sections with a phone screen; every other section opens on a computer.
const ON_PHONE = { automations: 'automations', agents: 'aiAgents', content: 'contentLibrary' };

/**
 * Settings on the phone: what you change for yourself (profile, availability,
 * messaging hours) and the desktop sections, each gated by its
 * settings:<section> permission like the desktop sub-nav.
 */
export function SettingsScreen() {
  const { push } = useMobileNav();
  const can = useCan();
  const sections = useMemo(() => SETTINGS_MENU_ITEMS
    .map(item => ({ ...item, key: settingsSectionKey(item) }))
    .filter(item => can(settingsPermissionKey(item.key))), [can]);
  const allowed = (key) => can(settingsPermissionKey(key));
  const mine = [
    allowed('account') && { key: 'myProfileEdit', icon: 'solar:user-linear', label: 'My profile' },
    allowed('calendar') && { key: 'myAvailability', icon: 'solar:calendar-date-linear', label: 'My Availability' },
    allowed('messages') && { key: 'businessHours', icon: 'solar:clock-circle-linear', label: 'Messages business hours' },
  ].filter(Boolean);
  // Settings > Account on desktop: its Users, Access Control and Locations tabs.
  const account = allowed('account') ? [
    { key: 'settingsUsers', icon: 'solar:users-group-rounded-linear', label: 'Users' },
    { key: 'settingsRoles', icon: 'solar:shield-user-linear', label: 'Access control' },
    { key: 'settingsLocations', icon: 'solar:map-point-linear', label: 'Locations' },
  ] : [];

  return (
    <div className={common.screen}>
      <MobileSubHeader title="Settings" />
      <div className={common.body}>
        <div className={more.stack}>
          {mine.length > 0 && (
            <GroupedSection label="Mine">
              {mine.map(r => <GroupedRow key={r.key} icon={r.icon} label={r.label} onClick={() => push(r.key)} />)}
            </GroupedSection>
          )}
          {account.length > 0 && (
            <GroupedSection label="Account">
              {account.map(r => <GroupedRow key={r.key} icon={r.icon} label={r.label} onClick={() => push(r.key)} />)}
            </GroupedSection>
          )}
          <GroupedSection label="Workspace">
            {sections.map(s => (ON_PHONE[s.key] ? (
              <GroupedRow key={s.key} icon={s.icon} label={s.label} onClick={() => push(ON_PHONE[s.key])} />
            ) : (
              <GroupedRow
                key={s.key}
                icon={s.icon}
                label={s.label}
                tone="muted"
                detail="On a computer"
              />
            )))}
          </GroupedSection>
          <DesktopOnlyNote size="lg" title="Open on a computer" description="Care plans, programs, billing, org details and the other workspace settings need a bigger screen." />
        </div>
      </div>
    </div>
  );
}

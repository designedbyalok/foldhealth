import { useMemo } from 'react';
import { SideNav } from '../../components/SideNav/SideNav';
import { SETTINGS_MENU_ITEMS } from './settingsNavItems';
import { useCan } from '../../lib/useCan';
import { settingsPermissionKey } from '../../lib/accessControl';

const SECTIONS = [{
  key: 'settings',
  items: SETTINGS_MENU_ITEMS.map(item => ({
    key: item.key || item.label.toLowerCase(),
    label: item.label,
    icon: item.icon,
  })),
}];

export function SettingsSubNav({ activeItem = 'agents', onItemClick, width = 180 }) {
  const can = useCan();
  const sections = useMemo(
    () => SECTIONS.map(sec => ({ ...sec, items: sec.items.filter(item => can(settingsPermissionKey(item.key))) })),
    [can],
  );
  return (
    <SideNav
      width={width}
      sections={sections}
      activeKey={activeItem}
      onSelect={(key) => onItemClick?.(key)}
    />
  );
}

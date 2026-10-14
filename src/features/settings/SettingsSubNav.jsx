import { SideNav } from '../../components/SideNav/SideNav';
import { SETTINGS_MENU_ITEMS } from './settingsNavItems';

const SECTIONS = [{
  key: 'settings',
  items: SETTINGS_MENU_ITEMS.map(item => ({
    key: item.key || item.label.toLowerCase(),
    label: item.label,
    icon: item.icon,
  })),
}];

export function SettingsSubNav({ activeItem = 'agents', onItemClick, width = 180 }) {
  return (
    <SideNav
      width={width}
      sections={SECTIONS}
      activeKey={activeItem}
      onSelect={(key) => onItemClick?.(key)}
    />
  );
}

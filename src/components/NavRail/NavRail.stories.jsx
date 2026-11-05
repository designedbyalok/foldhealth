import { useState } from 'react';
import { NavRail } from './NavRail';

const ITEMS = [
  { id: 'home', label: 'Home', icon: 'solar:home-2-linear' },
  { id: 'messages', label: 'Messages', icon: 'solar:chat-round-line-linear', count: 8 },
  { id: 'settings', label: 'Settings', icon: 'solar:settings-linear' },
];
const FOOTER = [
  { id: 'help', label: 'Help', icon: 'solar:question-circle-linear' },
  { id: 'logout', label: 'Logout', icon: 'solar:logout-2-linear' },
];

export default {
  title: 'Navigation/NavRail',
  component: NavRail,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Light vertical navigation rail (icon over label, active tile, count badge). Store-free, used by the patient app shell.',
      },
    },
  },
  argTypes: {
    activeId: { control: 'select', options: [...ITEMS, ...FOOTER].map((i) => i.id) },
    onSelect: { action: 'onSelect' },
  },
  args: { items: ITEMS, footerItems: FOOTER, activeId: 'home' },
  decorators: [(Story) => <div style={{ height: 560, display: 'flex', background: 'var(--neutral-50)' }}><Story /></div>],
};

export const Default = {};

export const Interactive = {
  render: (args) => {
    const [active, setActive] = useState('home');
    return <NavRail {...args} activeId={active} onSelect={setActive} />;
  },
};

export const LargeCount = {
  args: { items: ITEMS.map((i) => (i.id === 'messages' ? { ...i, count: 128 } : i)) },
};

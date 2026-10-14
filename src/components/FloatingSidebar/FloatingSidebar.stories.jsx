import { useState } from 'react';
import { FloatingSidebar } from './FloatingSidebar';
const NAV_ITEMS = [
  { key: 'home', icon: 'solar:home-2-linear', filledIcon: 'solar:home-2-bold', label: 'Home', shortcut: '⌘1' },
  { key: 'population', icon: 'solar:users-group-rounded-linear', filledIcon: 'solar:users-group-rounded-bold', label: 'Population', shortcut: '⌘2' },
  { key: 'calendar', icon: 'solar:calendar-linear', filledIcon: 'solar:calendar-bold', label: 'Calendar', shortcut: '⌘3' },
  { key: 'tasks', icon: 'solar:checklist-minimalistic-linear', filledIcon: 'solar:checklist-minimalistic-bold', label: 'Tasks', shortcut: '⌘4' },
  { key: 'messages', icon: 'solar:chat-round-dots-linear', filledIcon: 'solar:chat-round-dots-bold', label: 'Comms', shortcut: '⌘5' },
  { key: 'calls', icon: 'solar:phone-linear', filledIcon: 'solar:phone-bold', label: 'Calls', shortcut: '⌘6' },
  { key: 'leads', icon: 'solar:user-speak-linear', filledIcon: 'solar:user-speak-bold', label: 'Leads', shortcut: '⌘7' },
  { key: 'analytics', icon: 'solar:chart-linear', filledIcon: 'solar:chart-bold', label: 'Analytics', shortcut: '⌘8' },
  { key: 'settings', icon: 'solar:settings-linear', filledIcon: 'solar:settings-bold', label: 'Settings', shortcut: '⌘,' },
];

const BOTTOM_ITEMS = [
  { key: 'help', icon: 'solar:question-circle-linear', filledIcon: 'solar:question-circle-bold', label: 'Help', shortcut: '⌘/' },
];

const PATIENTS_SECTIONS = [
  {
    key: 'worklists',
    label: 'Worklists',
    items: [
      { key: 'day-optimizer', label: 'Day Optimizer', count: 89 },
      { key: 'review-hra', label: 'Review HRA', count: 65 },
      { key: 'ip-visits', label: 'IP Visits', count: 92 },
      { key: 'high-risk', label: 'High Risk', count: 114 },
      { key: 'high-cost', label: 'High Cost', count: 110 },
    ],
  },
  {
    key: 'shared-lists',
    label: 'Shared Lists',
    items: [
      { key: 'snp', label: 'SNP', count: 84 },
      { key: 'awv', label: 'AWV', count: 133 },
      { key: 'toc', label: 'TOC', count: 72 },
      { key: 'high-utilizers', label: 'High Utilizers', count: 68 },
      { key: 'dm', label: 'DM', count: 57 },
    ],
  },
  {
    key: 'patients',
    label: 'Patients',
    items: [
      { key: 'my-patients', label: 'My Patients' },
      { key: 'all-patients', label: 'All Patients' },
    ],
  },
  {
    key: 'population-groups',
    label: 'Population Groups',
    items: [],
  },
  {
    key: 'leads-contacts',
    label: 'Leads & Contacts',
    items: [],
  },
];

export default {
  title: 'Navigation/FloatingSidebar',
  component: FloatingSidebar,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Variant of the primary nav where the dark rail and the active section\'s sub-nav float together as one rounded card. Figma Fold-Pixel node 1255:42011. Composes `SideNav` on the right for the sections list; the rail is a tighter 44px icon-only column so the two panels line up visually.',
      },
    },
  },
};

function stageStyle(bg = 'var(--neutral-50)') {
  return {
    minHeight: '100vh',
    padding: 16,
    background: bg,
    display: 'flex',
    alignItems: 'stretch',
  };
}

function PlaygroundDemo({ initialPage = 'population', initialSub = 'toc', ...rest }) {
  const [page, setPage] = useState(initialPage);
  const [sub, setSub] = useState(initialSub);
  return (
    <div style={stageStyle()}>
      <FloatingSidebar
        items={NAV_ITEMS}
        bottomItems={BOTTOM_ITEMS}
        activeKey={page}
        onNavigate={setPage}
        sections={PATIENTS_SECTIONS}
        activeSubKey={sub}
        onSubSelect={setSub}
        {...rest}
      />
    </div>
  );
}

export const Playground = {
  render: (args) => <PlaygroundDemo {...args} />,
  args: {
    width: 240,
    searchable: true,
    showSubNav: true,
  },
};

export const RailOnly = {
  render: () => (
    <div style={stageStyle()}>
      <FloatingSidebar
        items={NAV_ITEMS}
        bottomItems={BOTTOM_ITEMS}
        activeKey="home"
        onNavigate={() => {}}
        showSubNav={false}
      />
    </div>
  ),
  parameters: {
    docs: { description: { story: 'Collapsed state. The sub-nav hides and the rail stands alone as a 52px floating column, same chrome as the paired layout.' } },
  },
};

export const WithBadges = {
  render: () => {
    const withBadges = NAV_ITEMS.map(i =>
      i.key === 'messages' ? { ...i, badge: 7 }
      : i.key === 'tasks' ? { ...i, badge: 12 }
      : i,
    );
    return (
      <div style={stageStyle()}>
        <FloatingSidebar
          items={withBadges}
          bottomItems={BOTTOM_ITEMS}
          activeKey="population"
          onNavigate={() => {}}
          sections={PATIENTS_SECTIONS}
          activeSubKey="toc"
          onSubSelect={() => {}}
        />
      </div>
    );
  },
  parameters: {
    docs: { description: { story: 'Unread-count badges anchor to the top-right corner of each tile, same shape as the primary `Sidebar` component.' } },
  },
};

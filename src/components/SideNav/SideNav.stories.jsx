import { useMemo, useState } from 'react';
import { SideNav } from './SideNav';
import { Button } from '../Button/Button';

export default {
  title: 'Navigation/SideNav',
  component: SideNav,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The shared second-level navigation rail behind every section sub-nav (Population worklists, ' +
          'Messages/Calls comm panels, Analytics report pages, Settings menu). Sections hold items with ' +
          'optional Solar icons, count badges, and a locked state; the active row is highlighted by one ' +
          'sliding indicator that glides between rows. Flip `preset` to preview each real surface, or use ' +
          'the individual controls (`sectionLabelVariant`, `width`, `showHeader`, `sortable`, `loading`) ' +
          'to compose your own.',
      },
    },
  },
  argTypes: {
    preset: {
      control: 'select',
      options: ['population', 'messages', 'analytics', 'settings'],
      description: 'Item/section data mirroring each real surface.',
    },
    width: { control: { type: 'number', min: 160, max: 280, step: 10 } },
    sectionLabelVariant: {
      control: 'select',
      options: ['uppercase', 'title'],
      description: 'Section label casing: comm panels use uppercase, Population uses title case.',
    },
    showHeader: {
      control: 'boolean',
      description: 'Render the header slot (full-width "Create New" button, as in Messages/Calls).',
    },
    sortable: {
      control: 'boolean',
      description: 'Enable drag-to-reorder on the first section (as Population worklists do).',
    },
    loading: {
      control: 'boolean',
      description: 'Skeleton rows while nav config loads (as Calls does).',
    },
  },
};

const PRESETS = {
  population: {
    sectionLabelVariant: 'title',
    width: 200,
    sections: [
      {
        key: 'worklists',
        label: 'Worklists',
        items: [
          { key: 'TOC IP', label: 'TOC IP', count: 28 },
          { key: 'TCM', label: 'TCM', count: 28 },
          { key: 'SNP', label: 'SNP', count: 15 },
          { key: 'Annual Visit', label: 'Annual Visit', count: 25 },
          { key: 'HCC', label: 'HCC', count: 53 },
          { key: 'HEDIS', label: 'HEDIS', count: 15 },
        ],
      },
      {
        key: 'patients',
        label: 'Patients',
        items: [
          { key: 'My Patients', label: 'My Patients', count: 0 },
          { key: 'All Patients', label: 'All Patients', count: 127 },
        ],
      },
      { key: 'leads', label: 'Leads & Contacts', items: [] },
    ],
  },
  messages: {
    sectionLabelVariant: 'uppercase',
    width: 200,
    sections: [
      {
        key: 'inbox',
        label: 'Inbox',
        items: [
          { key: 'assigned', label: 'Assigned to me', icon: 'solar:user-check-rounded-linear' },
          { key: 'mentions', label: 'Mentions', icon: 'solar:mention-circle-linear' },
          { key: 'unassigned', label: 'Unassigned', icon: 'solar:user-linear' },
          { key: 'starred', label: 'Starred', icon: 'solar:star-linear' },
          { key: 'archived', label: 'Archived', icon: 'solar:archive-minimalistic-linear' },
        ],
      },
      {
        key: 'channels',
        label: 'Channels',
        items: [
          { key: 'all', label: 'All Conversations', icon: 'solar:chart-linear', count: 3 },
          { key: 'chat', label: 'Chat', icon: 'solar:chat-round-line-linear', count: 3 },
          { key: 'sms', label: 'SMS', icon: 'solar:chat-square-linear' },
          { key: 'email', label: 'Email', icon: 'solar:letter-linear' },
        ],
      },
    ],
  },
  analytics: {
    sectionLabelVariant: 'uppercase',
    width: 210,
    sections: [
      {
        key: 'overview',
        label: 'Overview',
        items: [{ key: 'exec', label: 'Executive Dashboard', icon: 'solar:chart-2-linear' }],
      },
      {
        key: 'analytics',
        label: 'Analytics',
        items: [
          { key: 'population', label: 'Population Overview', icon: 'solar:users-group-two-rounded-linear' },
          { key: 'financial', label: 'Financial Analytics', icon: 'solar:dollar-linear' },
          { key: 'risk', label: 'Risk & Revenue', icon: 'solar:danger-circle-linear', locked: true },
          { key: 'quality', label: 'Quality Management', icon: 'solar:check-circle-linear' },
        ],
      },
    ],
  },
  settings: {
    sectionLabelVariant: 'title',
    width: 180,
    sections: [
      {
        key: 'menu',
        items: [
          { key: 'member/leads', label: 'Member/Leads', icon: 'solar:user-check-rounded-linear' },
          { key: 'calendar', label: 'Calendar', icon: 'solar:calendar-date-linear' },
          { key: 'tasks', label: 'Tasks', icon: 'solar:checklist-minimalistic-linear' },
          { key: 'messages', label: 'Messages', icon: 'solar:chat-square-linear' },
          { key: 'agents', label: 'Agents', icon: 'solar:ghost-smile-linear' },
          { key: 'billing', label: 'Billing', icon: 'solar:bill-list-linear' },
          { key: 'account', label: 'Account', icon: 'solar:shield-user-linear' },
        ],
      },
    ],
  },
};

function Wrapper({ preset, width, sectionLabelVariant, showHeader, sortable, loading }) {
  const base = PRESETS[preset] || PRESETS.population;
  const [sections, setSections] = useState(base.sections);
  const [activeKey, setActiveKey] = useState(base.sections[0].items[0]?.key);
  // Reset local state when the preset control changes.
  const [lastPreset, setLastPreset] = useState(preset);
  if (preset !== lastPreset) {
    setLastPreset(preset);
    setSections(base.sections);
    setActiveKey(base.sections[0].items[0]?.key);
  }

  const sortableSection = sortable ? sections[0]?.key : undefined;

  const handleReorder = (orderedKeys) => {
    setSections(prev => prev.map((s, i) => i === 0
      ? { ...s, items: orderedKeys.map(k => s.items.find(it => it.key === k)) }
      : s));
  };

  const header = useMemo(() => (
    showHeader
      ? <Button leadingIcon="solar:add-circle-bold" fullWidth onClick={() => {}}>Create New</Button>
      : null
  ), [showHeader]);

  return (
    <div style={{ height: '100vh', display: 'flex', background: 'var(--neutral-50)' }}>
      <SideNav
        sections={sections}
        activeKey={activeKey}
        onSelect={setActiveKey}
        header={header}
        width={width ?? base.width}
        sectionLabelVariant={sectionLabelVariant ?? base.sectionLabelVariant}
        sortableSection={sortableSection}
        onReorder={handleReorder}
        loading={loading}
      />
    </div>
  );
}

export const Playground = {
  render: (args) => <Wrapper {...args} />,
  args: {
    preset: 'population',
    width: 200,
    sectionLabelVariant: 'title',
    showHeader: false,
    sortable: true,
    loading: false,
  },
};

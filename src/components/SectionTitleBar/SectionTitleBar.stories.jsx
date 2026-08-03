import { useMemo, useState } from 'react';
import { SectionTitleBar } from './SectionTitleBar';

export default {
  title: 'Navigation/SectionTitleBar',
  component: SectionTitleBar,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Shared third-level header. Flip `variant` between `tabs`, `titleOnly`, `titleWithDropdown`, and `titleWithToggle`. When in `tabs` mode, use `tabCount` and `tabLabels` to preview how the bar handles overflow — extras collapse into a `More ▾` dropdown so nothing overlaps the right-side action cluster. Toggle the right-side icons via the `show*` flags.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['tabs', 'titleOnly', 'titleWithDropdown', 'titleWithToggle'],
      description: 'Left-side layout.',
      table: { type: { summary: "'tabs' | 'titleOnly' | 'titleWithDropdown' | 'titleWithToggle'" } },
    },
    title: {
      control: 'text',
      description: 'Title text (`titleOnly` / `titleWithDropdown` / `titleWithToggle`).',
      if: { arg: 'variant', neq: 'tabs' },
    },
    tabCount: {
      control: { type: 'number', min: 1, max: 12, step: 1 },
      description: 'Number of tabs to render (`tabs` variant). Try >5 to see the overflow "More ▾" dropdown.',
      if: { arg: 'variant', eq: 'tabs' },
    },
    tabLabels: {
      control: 'text',
      description: 'Comma-separated labels used when `tabCount` exceeds the default set (`tabs` variant).',
      if: { arg: 'variant', eq: 'tabs' },
    },
    showNotifDot: {
      control: 'boolean',
      description: 'When true, the second tab renders the pulsing notif dot ("new activity") indicator.',
      if: { arg: 'variant', eq: 'tabs' },
    },
    showSearch: { control: 'boolean' },
    showFilter: { control: 'boolean' },
    showHistory: { control: 'boolean' },
    showUpload: { control: 'boolean' },
    showDownload: { control: 'boolean' },
    showSavedFilters: { control: 'boolean' },
    filterBadgeCount: { control: 'number' },
    uploadHasDropdown: { control: 'boolean' },
  },
};

const DEFAULT_TAB_LABELS = [
  'Worklist', 'Agent Queue', 'Reports', 'Analytics', 'Coverage',
  'Utilization', 'Quality', 'Population', 'Configuration', 'Billing',
  'Audit Log', 'Archive',
];

const DUE_OPTIONS = ['Overdue', 'Due Today', 'Due This Week', 'Due Next Week', 'Due More Than 2 Weeks'];
const SNP_TOGGLE = [
  { key: 'enrolled', label: 'Enrolled' },
  { key: 'eligible', label: 'Eligible' },
];

function Wrapper({ tabCount, tabLabels, showNotifDot, ...props }) {
  const tabs = useMemo(() => {
    const custom = (tabLabels || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const labels = custom.length > 0 ? custom : DEFAULT_TAB_LABELS;
    const count = Math.max(1, Math.min(tabCount ?? 2, 12));
    return Array.from({ length: count }, (_, i) => ({
      key: `tab-${i}`,
      label: labels[i] ?? `Tab ${i + 1}`,
      notif: showNotifDot && i === 1,
    }));
  }, [tabCount, tabLabels, showNotifDot]);

  const [activeTab, setActiveTab] = useState('tab-0');
  const [dropdown, setDropdown] = useState(null);
  const [toggle, setToggle] = useState('enrolled');
  const [search, setSearch] = useState('');

  return (
    <SectionTitleBar
      {...props}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      dropdownOptions={DUE_OPTIONS}
      dropdownValue={dropdown}
      onDropdownChange={setDropdown}
      dropdownLabel="Due Date"
      toggleItems={SNP_TOGGLE}
      toggleActive={toggle}
      onToggleChange={setToggle}
      searchValue={search}
      onSearchChange={setSearch}
      onFilter={() => {}}
      onHistory={() => {}}
      onUpload={() => {}}
      onDownload={() => {}}
      onSavedFilters={() => {}}
    />
  );
}

export const Playground = {
  render: (args) => <Wrapper {...args} />,
  args: {
    variant: 'tabs',
    title: 'HCC List',
    tabCount: 2,
    tabLabels: '',
    showNotifDot: true,
    showSearch: true,
    showFilter: true,
    showHistory: true,
    showUpload: true,
    showDownload: false,
    showSavedFilters: false,
    filterBadgeCount: 0,
    uploadHasDropdown: false,
  },
};

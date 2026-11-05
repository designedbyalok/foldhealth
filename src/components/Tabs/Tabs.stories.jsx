import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { Tabs } from './Tabs';
import { OverflowTabs } from './OverflowTabs';

const ITEMS = [
  { key: 'overview', label: 'Overview' },
  { key: 'activity', label: 'Activity', count: 4 },
  { key: 'documents', label: 'Documents', notif: true },
];

export default {
  title: 'Navigation/Tabs',
  component: Tabs,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A row of tabs that switches what is shown below it. `variant="underline"` (default) is the app tab bar with a sliding underline; `variant="pill"` is the secondary switch inside a tab. Controlled with `value` + `onValueChange`, or uncontrolled with `defaultValue`. One tab stop; Left / Right / Home / End move and select. Replaces `TabStrip` and `SubTabs`; `OverflowTabs` folds tabs that do not fit into More. To pick a value instead, use `SegmentedControl`.',
      },
    },
  },
  argTypes: {
    variant: { control: 'select', options: ['underline', 'pill'], table: { defaultValue: { summary: 'underline' } } },
    size: { control: 'select', options: ['sm', 'md'], table: { defaultValue: { summary: 'md' } } },
    onValueChange: { action: 'onValueChange' },
  },
};

export const Playground = {
  args: { items: ITEMS, defaultValue: 'overview', variant: 'underline', size: 'md', 'aria-label': 'Patient sections' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const first = canvas.getByRole('tab', { name: 'Overview' });
    await userEvent.click(first);
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('tab', { name: /Activity/ })).toHaveAttribute('aria-selected', 'true');
    await expect(canvas.getByRole('tab', { name: /Activity/ })).toHaveFocus();
  },
};

/** Both variants at both sizes. */
export const VariantMatrix = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', width: 520 }}>
      <Tabs aria-label="Underline md" items={ITEMS} defaultValue="overview" fullWidth={false} />
      <Tabs aria-label="Underline sm" items={ITEMS} defaultValue="activity" size="sm" fullWidth={false} />
      <Tabs aria-label="Pill md" variant="pill" items={['Care Programs', 'Comprehensive Care Plan', 'Activity Log']} defaultValue="Care Programs" />
      <Tabs aria-label="Pill sm" variant="pill" size="sm" items={['Summary', 'Details', 'History']} defaultValue="Details" />
    </div>
  ),
};

function OverflowDemo() {
  const [tab, setTab] = useState('t1');
  const items = Array.from({ length: 9 }, (_, i) => ({ key: `t${i + 1}`, label: `Section ${i + 1}` }));
  return (
    <div style={{ width: 420 }}>
      <OverflowTabs items={items} value={tab} onValueChange={setTab} />
    </div>
  );
}

/** Tabs that do not fit fold into More. */
export const Overflow = { render: () => <OverflowDemo /> };

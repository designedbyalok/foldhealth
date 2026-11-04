import { useState } from 'react';
import { SubTabs } from './SubTabs';

export default {
  title: 'Navigation/SubTabs',
  component: SubTabs,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Pill-style secondary tab row. The active tab becomes a white pill with a hairline border. Controlled with `value` + `onValueChange`, or uncontrolled with `defaultValue`. Use for a secondary switch inside a tab; use TabStrip for top-level tabs.',
      },
    },
  },
  argTypes: {
    tabs: { control: 'object', description: 'Tabs, in display order. A bare string is both key and label.' },
    value: { control: 'text', description: 'Currently selected tab key.' },
    defaultValue: { control: 'text', description: 'Initially selected key, when uncontrolled.' },
    onValueChange: { action: 'onValueChange', description: 'Fires with the picked tab key.' },
    size: { control: 'select', options: ['sm', 'md'], description: 'md 28px, sm 24px', table: { defaultValue: { summary: 'md' } } },
  },
};

export const Default = () => {
  const [tab, setTab] = useState('Care Programs');
  return (
    <SubTabs
      tabs={['Care Programs', 'Comprehensive Care Plan', 'Program Activity Log']}
      value={tab}
      onValueChange={setTab}
    />
  );
};

export const TwoTabs = () => {
  const [tab, setTab] = useState('All');
  return <SubTabs tabs={['All', 'New', 'Enrolled', 'Completed', 'Closed']} value={tab} onValueChange={setTab} />;
};

export const Small = {
  args: { tabs: ['Summary', 'Details', 'History'], defaultValue: 'Summary', size: 'sm' },
};

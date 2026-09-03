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
          'Pill-style secondary tab row. The active tab becomes a white pill with a hairline border. Controlled — the parent owns the active key. Use for a secondary switch inside a tab; use TabStrip for top-level tabs.',
      },
    },
  },
  argTypes: {
    tabs: { control: 'object', description: 'Tabs, in display order. A bare string is both key and label.' },
    activeKey: { control: 'text', description: 'Currently selected tab key.' },
    onChange: { action: 'onChange', description: 'Fires with the picked tab key.' },
  },
};

export const Default = () => {
  const [tab, setTab] = useState('Care Programs');
  return (
    <SubTabs
      tabs={['Care Programs', 'Comprehensive Care Plan', 'Program Activity Log']}
      activeKey={tab}
      onChange={setTab}
    />
  );
};

export const TwoTabs = () => {
  const [tab, setTab] = useState('All');
  return <SubTabs tabs={['All', 'New', 'Enrolled', 'Completed', 'Closed']} activeKey={tab} onChange={setTab} />;
};

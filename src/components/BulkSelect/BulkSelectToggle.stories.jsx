import { useState } from 'react';
import { BulkSelectToggle } from './BulkSelectToggle';

export default {
  title: 'Core/BulkSelectToggle',
  component: BulkSelectToggle,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The bulk-select toggle that lives in a table’s SectionTitleBar. Off shows a neutral "select cells" glyph; on shows a primary close glyph. Pair with the `useBulkSelect` hook: the hook owns `bulkMode` + the selected-id Set, this button flips it. Used across the Forms, Agents, Users, Insurance Plans, and Locations settings tables so bulk-select reads identically everywhere.',
      },
    },
  },
  argTypes: {
    active: { control: 'boolean', description: 'Bulk mode on/off' },
    size: { control: 'select', options: ['S', 'L', 'XL'] },
  },
};

export const Inactive = { args: { active: false, size: 'L' } };
export const Active = { args: { active: true, size: 'L' } };

export const Interactive = {
  render: () => {
    const [on, setOn] = useState(false);
    return <BulkSelectToggle active={on} onToggle={() => setOn((v) => !v)} />;
  },
};

import { useState } from 'react';
import { SegmentedControl } from './SegmentedControl';

export default {
  title: 'Core/SegmentedControl',
  component: SegmentedControl,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Pick one of two to four short options, side by side, with a sliding pill that animates to the selected one (HCC / ICD, PMPM / Total Cost). The choices are always visible and mutually exclusive. Was `Toggle`. To switch what is shown below, use `Tabs`; for on/off use `Switch`; for longer lists use `Select` or `RadioButton`.',
      },
    },
  },
  argTypes: {
    size: { control: 'select', options: ['sm', 'md'], description: 'sm = 28px/13px, md = 32px/14px', table: { defaultValue: { summary: 'md' } } },
    variant: { control: 'select', options: ['soft', 'ghost'], description: 'soft: grey track; ghost: no track (on a grey surface), 28px segments, only the selected pill' },
    onValueChange: { action: 'onValueChange', description: 'Fires with the picked key.' },
    fullWidth: { control: 'boolean', description: 'Flex buttons to fill width' },
  },
};

export const Playground = {
  args: { items: ['HCC', 'ICD'], defaultValue: 'HCC', size: 'md', fullWidth: false, 'aria-label': 'Code type' },
};

function SizesDemo() {
  const [view, setView] = useState('Workflow');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
      <SegmentedControl aria-label="View" items={['Workflow', 'Configure', 'Analytics']} value={view} onValueChange={setView} />
      <SegmentedControl aria-label="View, small" size="sm" items={['Workflow', 'Configure', 'Analytics']} defaultValue="Configure" />
    </div>
  );
}

/** Both sizes; the first is controlled, the second uncontrolled. */
export const Sizes = {
  parameters: { controls: { disable: true } },
  render: () => <SizesDemo />,
};

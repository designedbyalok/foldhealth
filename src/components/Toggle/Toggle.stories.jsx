import { useState } from 'react';
import { Toggle } from './Toggle';

export default {
  title: 'Core/Toggle',
  component: Toggle,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A segmented on/off control: two to four short labels with a sliding pill that animates to the active option. Use it for view switches (HCC / ICD, Workflow / Configure / Analytics) where the choices are always visible and mutually exclusive. For binary on/off preferences prefer `Switch`; for longer option lists prefer `Select` or `RadioButton`.',
      },
    },
  },
  argTypes: {
    size: { control: 'select', options: ['sm', 'md'], description: 'sm = 28px/13px, md = 32px/14px', table: { defaultValue: { summary: 'md' } } },
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
      <Toggle aria-label="View" items={['Workflow', 'Configure', 'Analytics']} value={view} onValueChange={setView} />
      <Toggle aria-label="View, small" size="sm" items={['Workflow', 'Configure', 'Analytics']} defaultValue="Configure" />
    </div>
  );
}

/** Both sizes; the first is controlled, the second uncontrolled. */
export const Sizes = {
  parameters: { controls: { disable: true } },
  render: () => <SizesDemo />,
};

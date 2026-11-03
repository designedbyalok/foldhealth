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
    size: { control: 'select', options: ['S', 'M'], description: 'S = 28px/13px, M = 32px/14px' },
    variant: { control: 'select', options: ['soft', 'ghost'], description: 'soft: grey track; ghost: no track (on a grey surface), 28px segments, only the selected pill' },
    fullWidth: { control: 'boolean', description: 'Flex buttons to fill width' },
  },
};

function Wrapper(props) {
  const items = props.items || ['Option A', 'Option B'];
  const [active, setActive] = useState(typeof items[0] === 'string' ? items[0] : items[0]?.key);
  return <Toggle {...props} items={items} active={active} onChange={setActive} />;
}

export const Playground = {
  render: (args) => <Wrapper {...args} />,
  args: { items: ['HCC', 'ICD'], size: 'M', fullWidth: false },
};

import { useState } from 'react';
import { RadioButton } from './RadioButton';

export default {
  title: 'Forms/RadioButton',
  component: RadioButton,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: { component: 'Single radio input. Compose several with a shared `name` to build a mutually-exclusive group.' },
    },
  },
  argTypes: {
    checked: {
      control: 'boolean',
      description: 'Current selected state.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' } },
    },
    onChange: {
      action: 'onChange',
      description: 'Fires when the radio is clicked.',
      table: { type: { summary: '(event: React.ChangeEvent<HTMLInputElement>) => void' } },
    },
    label: {
      control: 'text',
      description: 'Optional visible label text.',
      table: { type: { summary: 'string' } },
    },
    disabled: {
      control: 'boolean',
      description: 'Disable interaction.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' } },
    },
    name: {
      control: 'text',
      description: 'HTML `name` attribute: shared across a mutually-exclusive group.',
      table: { type: { summary: 'string' } },
    },
    value: {
      control: 'text',
      description: 'HTML `value` attribute.',
      table: { type: { summary: 'string' } },
    },
  },
};

function SingleWrapper({ checked: initial = false, ...props }) {
  const [checked, setChecked] = useState(initial);
  return <RadioButton {...props} checked={checked} onChange={() => setChecked(v => !v)} />;
}

function GroupWrapper({ options, initial }) {
  const [selected, setSelected] = useState(initial);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {options.map(opt => (
        <RadioButton
          key={opt.value}
          name="story-group"
          value={opt.value}
          label={opt.label}
          checked={selected === opt.value}
          onChange={() => setSelected(opt.value)}
        />
      ))}
    </div>
  );
}

export const Playground = {
  render: (args) => <SingleWrapper {...args} />,
  args: {
    checked: false,
    label: 'I agree',
    disabled: false,
    name: 'consent',
    value: 'yes',
  },
};

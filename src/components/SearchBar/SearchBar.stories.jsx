import { useState } from 'react';
import { SearchBar } from './SearchBar';

export default {
  title: 'Forms/SearchBar',
  component: SearchBar,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: { component: 'Search input with leading magnifier and (optional) trailing close button. Controlled, parent owns `value`.' },
    },
  },
  argTypes: {
    placeholder: {
      control: 'text',
      description: 'Native input placeholder.',
      table: { type: { summary: 'string' }, defaultValue: { summary: 'Search…' } },
    },
    autoFocus: {
      control: 'boolean',
      description: 'Focus the input on mount.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'true' } },
    },
    fullWidth: {
      control: 'boolean',
      description: 'Stretch to fill the parent container.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' } },
    },
    showClose: {
      control: 'boolean',
      description: 'Story-only prop: when true, wires an `onClose` handler and the ✕ button appears.',
      table: { type: { summary: 'boolean' } },
    },
    value: {
      control: 'text',
      description: 'Current input value.',
      table: { type: { summary: 'string' } },
    },
    onChange: {
      action: 'onChange',
      description: 'Fires with the native change event.',
      table: { type: { summary: '(event: React.ChangeEvent<HTMLInputElement>) => void' } },
    },
    onClose: {
      action: 'onClose',
      description: 'Fires when the ✕ button is clicked, button is hidden when omitted.',
      table: { type: { summary: '() => void' } },
    },
  },
};

function Wrapper({ initial = '', showClose = false, ...props }) {
  const [value, setValue] = useState(initial);
  return (
    <SearchBar
      {...props}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onClose={showClose ? () => setValue('') : undefined}
    />
  );
}

export const Playground = {
  render: (args) => <Wrapper {...args} />,
  args: {
    placeholder: 'Search patients…',
    autoFocus: false,
    fullWidth: false,
    showClose: true,
  },
};

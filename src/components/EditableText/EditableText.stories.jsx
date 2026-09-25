import { useState } from 'react';
import { EditableText } from './EditableText';

export default {
  title: 'Forms/EditableText',
  component: EditableText,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: { component: 'Text you edit where it stands: click it and type. It never turns into an input, so it keeps its own type styles. Enter or blur commits, Escape restores.' },
    },
  },
  argTypes: {
    placeholder: { control: 'text' },
    maxLength: { control: 'number' },
    disabled: { control: 'boolean' },
  },
};

export const Default = {
  args: { placeholder: 'Add a title', maxLength: 100 },
  render: (args) => {
    const [value, setValue] = useState('Overview');
    return (
      <div style={{ width: 360, fontSize: 'var(--font-lg)', fontWeight: 500, color: 'var(--neutral-400)' }}>
        <EditableText {...args} value={value} onCommit={setValue} ariaLabel="Section title" />
      </div>
    );
  },
};

export const Subtitle = {
  args: { placeholder: 'Add a subtitle', maxLength: 150 },
  render: (args) => {
    const [value, setValue] = useState('Membership size, revenue, growth and retention');
    return (
      <div style={{ width: 360, fontSize: 'var(--font-base)', color: 'var(--neutral-300)' }}>
        <EditableText {...args} value={value} onCommit={setValue} ariaLabel="Section subtitle" />
      </div>
    );
  },
};

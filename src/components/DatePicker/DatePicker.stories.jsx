import { useState } from 'react';
import { DatePicker } from './DatePicker';

export default {
  title: 'Core/DatePicker',
  component: DatePicker,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Fold-brand date field. Delegates to `<Input type="date">` for single-date usage and opens `DatePickerPopover`, a portal-mounted calendar matching Figma Fold-Pixel-1.0 node 8646:12169. Set `mode="range"` for a two-endpoint range picker.',
      },
    },
  },
  argTypes: {
    mode: {
      control: 'select',
      options: ['single', 'range'],
      description: 'Single date or start/end range.',
      table: { type: { summary: "'single' | 'range'" }, defaultValue: { summary: 'single' } },
    },
    value: {
      control: 'text',
      description: 'ISO date (single) or JSON `{start,end}` (range).',
      table: { type: { summary: 'string | { start, end }' } },
    },
    onSelect: {
      action: 'onSelect',
      description: 'Fires with the new ISO date (single) or `{start,end}` (range).',
      table: { type: { summary: '(next) => void' } },
    },
    placeholder: { control: 'text', description: 'Input placeholder.' },
    hasError: { control: 'boolean', description: 'Apply the error border/ring.' },
    disabled: { control: 'boolean', description: 'Disable interaction.' },
    min: { control: 'text', description: 'Minimum selectable ISO date.' },
    max: { control: 'text', description: 'Maximum selectable ISO date.' },
  },
};

function SingleWrapper({ value: initial = '', ...props }) {
  const [value, setValue] = useState(initial);
  return <DatePicker {...props} value={value} onSelect={setValue} />;
}

function RangeWrapper({ value: initial = { start: '', end: '' }, ...props }) {
  const [value, setValue] = useState(initial);
  return <DatePicker {...props} mode="range" value={value} onSelect={setValue} />;
}

export const Playground = {
  render: (args) => (args.mode === 'range' ? <RangeWrapper {...args} /> : <SingleWrapper {...args} />),
  args: {
    mode: 'single',
    value: '',
    placeholder: '',
    hasError: false,
    disabled: false,
    min: '',
    max: '',
  },
};

export const SingleDate = {
  render: () => <SingleWrapper />,
  parameters: {
    docs: { description: { story: 'Default single-date mode. Click the calendar icon to open the popover, then pick a day. Value is stored as an ISO `YYYY-MM-DD` string.' } },
  },
};

export const DateRange = {
  render: () => <RangeWrapper />,
  parameters: {
    docs: { description: { story: 'Range mode. First click sets the start; second click sets the end and closes the popover. Between clicks the popover previews the range as the cursor moves.' } },
  },
};

export const WithError = {
  render: () => <SingleWrapper hasError placeholder="Pick a date" />,
  parameters: {
    docs: { description: { story: 'Error variant: Input\'s error border + ring tokens.' } },
  },
};

export const Disabled = {
  render: () => <SingleWrapper disabled placeholder="Pick a date" />,
};

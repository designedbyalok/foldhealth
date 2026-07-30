import { useState } from 'react';
import { Slider } from './ShadcnSlider';

export default {
  title: 'shadcn/Slider',
  component: Slider,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'shadcn/ui `Slider` (Radix-backed). Pass one value for a single thumb, two for a range slider.',
      },
    },
  },
  argTypes: {
    value: {
      control: 'object',
      description: 'Current value(s) — one entry per thumb.',
      table: { type: { summary: 'number[]' } },
    },
    defaultValue: {
      control: 'object',
      description: 'Initial value(s) for uncontrolled use.',
      table: { type: { summary: 'number[]' } },
    },
    onValueChange: {
      action: 'onValueChange',
      description: 'Fires with the new value array while dragging.',
      table: { type: { summary: '(next: number[]) => void' } },
    },
    min: {
      control: 'number',
      description: 'Minimum value.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '0' } },
    },
    max: {
      control: 'number',
      description: 'Maximum value.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '100' } },
    },
    step: {
      control: 'number',
      description: 'Increment size.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '1' } },
    },
    disabled: {
      control: 'boolean',
      description: 'Disables the slider.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' } },
    },
  },
};

function Wrapper(props) {
  const [value, setValue] = useState(props.defaultValue || [40]);
  return (
    <div style={{ width: 280, padding: 8 }}>
      <label id="slider-demo-label" style={{ display: 'block', fontSize: 12, color: 'var(--neutral-400)', marginBottom: 6 }}>
        Value
      </label>
      <Slider {...props} value={value} onValueChange={setValue} aria-labelledby="slider-demo-label" />
      <div style={{ fontSize: 12, color: 'var(--neutral-300)', marginTop: 8 }}>{value.join(' – ')}</div>
    </div>
  );
}

export const Playground = { render: (args) => <Wrapper {...args} />, args: { min: 0, max: 100, step: 1 } };

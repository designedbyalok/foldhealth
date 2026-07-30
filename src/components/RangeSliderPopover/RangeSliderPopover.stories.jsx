import { useRef, useState } from 'react';
import { RangeSliderPopover } from './RangeSliderPopover';

export default {
  title: 'Overlays/RangeSliderPopover',
  component: RangeSliderPopover,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Dual-thumb numeric range picker in a popover. Used by the HCC Decile filter (1–10) but generic — set `min`/`max`/`step`/`unitLabel` for other ranges (e.g. age in years).',
      },
    },
  },
  argTypes: {
    label: {
      control: 'text',
      description: 'Header label.',
      table: { type: { summary: 'string' } },
    },
    min: {
      control: { type: 'number' },
      description: 'Lower bound (inclusive).',
      table: { type: { summary: 'number' }, defaultValue: { summary: '0' } },
    },
    max: {
      control: { type: 'number' },
      description: 'Upper bound (inclusive).',
      table: { type: { summary: 'number' }, defaultValue: { summary: '10' } },
    },
    step: {
      control: { type: 'number' },
      description: 'Step increment.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '1' } },
    },
    unitLabel: {
      control: 'text',
      description: 'Optional suffix shown next to each end value (e.g. "decile", "yrs").',
      table: { type: { summary: 'string' } },
    },
    width: {
      control: { type: 'number', min: 200, max: 480 },
      description: 'Popover width in px.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '280' } },
    },
    onApply: {
      action: 'onApply',
      description: 'Fires when Apply is clicked with the picked `[min, max]`.',
      table: { type: { summary: '(min: number, max: number) => void' } },
    },
    onClose: {
      action: 'onClose',
      description: 'Fires when dismissed without applying.',
      table: { type: { summary: '() => void' } },
    },
  },
};

function Demo(props) {
  const btnRef = useRef(null);
  const [rect, setRect] = useState(null);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24 }}>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => setRect(rect ? null : e.currentTarget.getBoundingClientRect())}
        style={{
          padding: '6px 12px', borderRadius: 6, border: '1px solid var(--neutral-150)',
          background: 'var(--neutral-0)', cursor: 'pointer', fontSize: 13, color: 'var(--neutral-400)',
        }}
      >
        Filter {props.label}
      </button>
      {rect && (
        <RangeSliderPopover
          {...props}
          anchorRect={rect}
          onClose={() => setRect(null)}
        />
      )}
    </div>
  );
}

export const Playground = {
  render: (args) => <Demo {...args} />,
  args: { label: 'Decile', min: 1, max: 10, step: 1, unitLabel: 'decile', width: 280 },
};

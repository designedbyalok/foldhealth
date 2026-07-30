import { useRef, useState } from 'react';
import { DateRangePopover } from './DateRangePopover';

export default {
  title: 'Overlays/DateRangePopover',
  component: DateRangePopover,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Dual-month calendar popover for picking a date range with click-then-click selection. First click sets the start, second click sets the end; hovering after the first click previews the range. Used by HCC filter chips of type `date` (DOB, Create Date, Last Visit Date). Returns ISO date strings (`YYYY-MM-DD`).',
      },
    },
  },
  argTypes: {
    label: {
      control: 'text',
      description: 'Filter label shown in the header.',
      table: { type: { summary: 'string' } },
    },
    width: {
      control: { type: 'number', min: 320, max: 720 },
      description: 'Popover width in px.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '504' } },
    },
    selected: {
      control: 'object',
      description: 'Current value: `[startISO, endISO]` or `[]` for none.',
      table: { type: { summary: 'string[]' } },
    },
    onChange: {
      action: 'onChange',
      description: 'Fires with a 0- or 2-element ISO date array.',
      table: { type: { summary: '(range: string[]) => void' } },
    },
    onClose: {
      action: 'onClose',
      description: 'Fires on overlay click / Escape / Apply / Clear.',
      table: { type: { summary: '() => void' } },
    },
  },
};

function Demo({ label, width, selected: initial }) {
  const btnRef = useRef(null);
  const [rect, setRect] = useState(null);
  const [range, setRange] = useState(initial || []);
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
        {range.length === 2 ? `${range[0]} → ${range[1]}` : `Pick ${label}`}
      </button>
      {rect && (
        <DateRangePopover
          anchorRect={rect}
          label={label}
          width={width}
          selected={range}
          onChange={setRange}
          onClose={() => setRect(null)}
        />
      )}
    </div>
  );
}

export const Playground = {
  render: (args) => <Demo {...args} />,
  args: { label: 'Create Date', width: 504, selected: [] },
};

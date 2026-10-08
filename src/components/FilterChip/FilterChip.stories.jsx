import { useState } from 'react';
import { FilterChip } from './FilterChip';

export default {
  title: 'Forms/FilterChip',
  component: FilterChip,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The single filter primitive used across the app. Inactive renders as `Label ⌄`; when values are selected it flips to `Label : Value ✕` and opens a popover of options.',
      },
    },
  },
  argTypes: {
    label: {
      control: 'text',
      description: 'Chip trigger label (e.g. "Status"). Shown before any picked values.',
      table: { type: { summary: 'string' } },
    },
    popoverLabel: {
      control: 'text',
      description:
        'Optional header shown inside the popover. Defaults to `label`. Use when the trigger text and the popover header should differ.',
      table: { type: { summary: 'string' } },
    },
    options: {
      control: 'object',
      description: 'Available values.',
      table: { type: { summary: 'string[] | { label: string, value: string }[]' } },
    },
    selected: {
      control: 'object',
      description: 'Currently selected values. Empty → chip renders as "Label ⌄".',
      table: { type: { summary: 'string[]' }, defaultValue: { summary: '[]' } },
    },
    singleSelect: {
      control: 'boolean',
      description: 'Use the RadioListPopover (single-select) instead of the checkbox popover.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' } },
    },
    size: {
      control: 'inline-radio',
      options: ['M', 'S', 'XS'],
      description: 'Regular (32px, 14px font, 16px icons), Small (28px, 12px font, 14px icons) or Extra small (20px, 12px font, 12px icons; matches a size-S Badge).',
      table: { type: { summary: "'M' | 'S' | 'XS'" }, defaultValue: { summary: "'M'" } },
    },
    onChange: {
      action: 'onChange',
      description: 'Fires with the new selected array whenever the user picks a value.',
      table: { type: { summary: '(next: string[]) => void' } },
    },
  },
};

function Wrapper(props) {
  const [selected, setSelected] = useState(props.selected || []);
  return <FilterChip {...props} selected={selected} onChange={setSelected} />;
}

export const Playground = {
  render: (args) => (
    <div style={{ padding: 24 }}>
      <Wrapper {...args} />
    </div>
  ),
  args: {
    label: 'Status',
    options: ['New', 'In Progress', 'Under Review', 'Closed'],
    selected: [],
    singleSelect: false,
    size: 'M',
  },
};

export const Sizes = {
  render: () => (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Row title="Regular (M) — 32px, 14px font, 16px icons">
        <Wrapper label="Status" options={['New', 'In Progress', 'Under Review', 'Closed']} size="M" />
        <Wrapper label="Status" options={['New', 'In Progress', 'Under Review', 'Closed']} selected={['New', 'In Progress', 'Under Review']} size="M" />
      </Row>
      <Row title="Small (S) — 28px, 12px font, 14px icons">
        <Wrapper label="Status" options={['New', 'In Progress', 'Under Review', 'Closed']} size="S" />
        <Wrapper label="Status" options={['New', 'In Progress', 'Under Review', 'Closed']} selected={['New', 'In Progress', 'Under Review']} size="S" />
      </Row>
      <Row title="Extra small (XS) — 20px, 12px font, 12px icons">
        <Wrapper label="Status" options={['New', 'In Progress', 'Under Review', 'Closed']} size="XS" />
        <Wrapper label="Status" options={['New', 'In Progress', 'Under Review', 'Closed']} selected={['New', 'In Progress', 'Under Review']} size="XS" />
      </Row>
    </div>
  ),
};

function Row({ title, children }) {
  return (
    <div>
      <div style={{ fontSize: 'var(--font-sm)', color: 'var(--neutral-300)', marginBottom: 6 }}>{title}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{children}</div>
    </div>
  );
}

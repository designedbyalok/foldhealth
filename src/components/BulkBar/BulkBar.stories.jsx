import { BulkBar } from './BulkBar';

export default {
  title: 'Composed/BulkBar',
  component: BulkBar,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: { component: 'Floating bottom bar that appears when rows are selected in a list. Shows the selection count and bulk actions.' },
    },
  },
  argTypes: {
    selectedIds: {
      control: 'object',
      description: 'Array of selected row IDs. Bar appears when length > 0.',
      table: { type: { summary: 'string[]' } },
    },
    onClear: {
      action: 'onClear',
      description: 'Clear-all handler.',
      table: { type: { summary: '() => void' } },
    },
    onChangeAssignee: {
      action: 'onChangeAssignee',
      description: 'Override the default "Change Assignee" action.',
      table: { type: { summary: '() => void' } },
    },
    actions: {
      control: 'object',
      description: 'Custom action buttons: replaces the default cluster.',
      table: { type: { summary: '{ label, icon?, variant?, onClick }[]' } },
    },
    moreActions: {
      control: 'object',
      description: 'Overflow menu items: only rendered when `actions` is also provided.',
      table: { type: { summary: '{ label, icon?, variant?, onClick }[]' } },
    },
  },
};

// The bar is position: fixed at the bottom of the viewport, wrap in a
// spacer so it renders inside the story canvas.
const Stage = ({ children }) => (
  <div style={{ minHeight: 240, position: 'relative', padding: 24 }}>
    <p style={{ color: 'var(--neutral-300)', fontSize: 'var(--font-md)' }}>
      BulkBar renders as a floating bar at the bottom of the viewport.
    </p>
    {children}
  </div>
);

export const Playground = {
  render: (args) => (
    <Stage>
      <BulkBar {...args} />
    </Stage>
  ),
  args: {
    selectedIds: ['pt-1', 'pt-2', 'pt-3'],
    onClear: () => {},
  },
};

import { ActionButton } from './ActionButton';

export default {
  title: 'Core/ActionButton',
  component: ActionButton,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A compact, square icon-only button, the workhorse of every toolbar, table row, and popover header in the app. Renders any Solar (or `custom:*`) icon in a bordered box that responds to hover and disabled states, and can carry a small badge (numeric count, orange notification dot, red status dot) or a dropdown chevron for menu triggers. Reach for it when a button needs just an icon and lives inside a dense control cluster, for anything with a label, use `Button` instead.',
      },
    },
  },
  argTypes: {
    icon: { control: 'text', description: 'Solar icon name' },
    size: { control: 'select', options: ['sm', 'md', 'lg'], description: 'sm=16px, md=20px (default), lg=32px icon' },
    tone: { control: 'select', options: ['neutral', 'danger'], description: 'danger paints the icon red, for destructive actions' },
    disabled: { control: 'boolean' },
    loading: { control: 'boolean', description: 'Busy: spinner instead of the icon, clicks ignored. Also set while a promise returned from onClick is pending' },
    tooltip: { control: 'text' },
    notification: { control: 'boolean', description: 'Orange notification badge' },
    count: { control: 'text', description: 'Badge count text' },
    dot: { control: 'boolean', description: 'Red status dot' },
    chevron: { control: 'boolean', description: 'Dropdown chevron' },
    chevronOpen: { control: 'boolean' },
  },
};

export const Playground = {
  args: { icon: 'custom:filter', size: 'md', tooltip: 'Filter', notification: false, dot: false, chevron: false },
};

/** Each size in each tone, plus disabled. */
export const Matrix = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, max-content)', gap: 'var(--space-4)', alignItems: 'center' }}>
      {['sm', 'md', 'lg'].map(size => [
        <ActionButton key={`${size}-n`} icon="solar:pen-linear" size={size} tooltip={`${size} neutral`} />,
        <ActionButton key={`${size}-d`} icon="solar:trash-bin-trash-linear" size={size} tone="danger" tooltip={`${size} danger`} />,
        <ActionButton key={`${size}-x`} icon="solar:pen-linear" size={size} disabled tooltip={`${size} disabled`} />,
      ])}
    </div>
  ),
};

/** An async onClick shows the spinner until it settles. */
export const LoadingFromAsyncClick = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
      <ActionButton icon="solar:refresh-linear" tooltip="Refresh" onClick={() => new Promise(r => setTimeout(r, 2000))} />
      <ActionButton icon="solar:trash-bin-trash-linear" tone="danger" tooltip="Delete" onClick={() => new Promise(r => setTimeout(r, 2000))} />
    </div>
  ),
};

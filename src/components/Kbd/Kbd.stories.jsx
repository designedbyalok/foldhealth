import { Kbd } from './Kbd';

export default {
  title: 'Core/Kbd',
  component: Kbd,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: { component: 'A keyboard key cap for shortcut hints. Renders a `<kbd>`. Pass the key text as children, or a Solar `icon` for symbol keys.' },
    },
  },
  args: { children: 'Enter' },
};

export const Default = {};

export const Shortcut = {
  render: () => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)', color: 'var(--neutral-300)', fontSize: 'var(--font-sm)' }}>
      <Kbd>Ctrl</Kbd> + <Kbd>Shift</Kbd> + <Kbd>K</Kbd>
    </span>
  ),
};

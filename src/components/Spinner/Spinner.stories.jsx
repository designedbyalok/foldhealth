import { Spinner } from './Spinner';

export default {
  title: 'Feedback/Spinner',
  component: Spinner,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Indeterminate ring for work in progress. Draws in `currentColor`, so it matches the text around it. Pass `label` when it stands alone (it becomes a polite `role="status"`); leave it out when it decorates something that already announces it is busy, like a loading Button.',
      },
    },
  },
  argTypes: {
    size: { control: { type: 'number', min: 8, max: 48 } },
    label: { control: 'text' },
  },
  args: { size: 16, label: 'Loading' },
};

export const Default = {};

/** It inherits the color of its container. */
export const Colors = {
  render: () => (
    <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
      {['--neutral-300', '--primary-300', '--status-success', '--status-error'].map(c => (
        <span key={c} style={{ color: `var(${c})`, display: 'inline-flex' }}><Spinner size={20} /></span>
      ))}
    </div>
  ),
};

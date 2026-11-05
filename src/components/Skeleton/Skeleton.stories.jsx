import { Skeleton } from './Skeleton';

export default {
  title: 'Feedback/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'One shimmering placeholder block. Loading layouts (`TableSkeleton`, `CardSkeleton`, `TimelineSkeleton`, feature skeletons) are arrangements of these, so every placeholder shimmers the same way. Hidden from screen readers: mark the loading region with `aria-busy`.',
      },
    },
  },
  argTypes: {
    width: { control: 'text' },
    height: { control: 'number' },
    radius: { control: 'text', description: "Corner radius; default 4px, '50%' for a circle" },
  },
};

export const Playground = { args: { width: 200, height: 12 } };

/** A list row: avatar, name and a meta line. */
export const Row = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div aria-busy="true" style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', width: 320 }}>
      <Skeleton width={32} height={32} radius="50%" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <Skeleton width="55%" height={12} />
        <Skeleton width="80%" height={10} />
      </div>
    </div>
  ),
};

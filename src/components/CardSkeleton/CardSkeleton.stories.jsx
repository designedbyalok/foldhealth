import { CardSkeleton } from './CardSkeleton';
import { SimpleTableSkeleton } from '../SimpleTableSkeleton/SimpleTableSkeleton';
import { TableSkeleton as FullTableSkeleton } from '../TableSkeleton/TableSkeleton';
import { TimelineSkeleton } from '../TimelineSkeleton/TimelineSkeleton';

// The loading layouts built from the Skeleton primitive, side by side.
export default {
  title: 'Feedback/Skeleton Presets',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Loading layouts built from `Skeleton`: `TableSkeleton`, `SimpleTableSkeleton`, `CardSkeleton` and `TimelineSkeleton`. Pick the shape closest to the layout you\'re replacing, or arrange `Skeleton` blocks for a new one.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['FullTableSkeleton', 'SimpleTableSkeleton', 'CardSkeleton', 'TimelineSkeleton'],
      description: 'Which skeleton composition to render.',
      table: { type: { summary: "'FullTableSkeleton' | 'SimpleTableSkeleton' | 'CardSkeleton' | 'TimelineSkeleton'" }, defaultValue: { summary: 'FullTableSkeleton' } },
    },
    rows: {
      control: { type: 'number', min: 1, max: 20 },
      description: 'Row count (Table, SimpleTable, Timeline).',
      table: { type: { summary: 'number' }, defaultValue: { summary: '6' } },
    },
    cols: {
      control: { type: 'number', min: 1, max: 12 },
      description: 'Column count (SimpleTable).',
      table: { type: { summary: 'number' }, defaultValue: { summary: '6' } },
    },
    count: {
      control: { type: 'number', min: 1, max: 12 },
      description: 'Card count (CardSkeleton).',
      table: { type: { summary: 'number' }, defaultValue: { summary: '4' } },
    },
  },
};

function Wrapper({ variant, rows, cols, count }) {
  if (variant === 'FullTableSkeleton') return <FullTableSkeleton rows={rows} />;
  if (variant === 'SimpleTableSkeleton') return <SimpleTableSkeleton rows={rows} cols={cols} />;
  if (variant === 'CardSkeleton') return <CardSkeleton count={count} />;
  if (variant === 'TimelineSkeleton') return <TimelineSkeleton rows={rows} />;
  return null;
}

export const Playground = {
  render: (args) => <Wrapper {...args} />,
  args: { variant: 'FullTableSkeleton', rows: 6, cols: 6, count: 4 },
};

import { EmptyState } from './EmptyState';
import { Button } from '../Button/Button';

export default {
  title: 'Feedback/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The dashed-ring medallion (Figma) for a list, panel or page with nothing to show, or that failed to load: one linear icon, a title, an optional description and an optional action. `tone="danger"` turns the icon red for errors. Replaces `RingEmptyState` (`label` is now `title`) and `ErrorState`.',
      },
    },
  },
  argTypes: {
    icon: { control: 'text', description: 'Solar linear icon name', table: { defaultValue: { summary: 'solar:inbox-linear' } } },
    title: { control: 'text' },
    description: { control: 'text' },
    tone: { control: 'select', options: ['neutral', 'danger'], table: { defaultValue: { summary: 'neutral' } } },
    size: { control: 'select', options: ['xs', 'sm', 'md'], description: 'md 120px medallion, sm 80px, xs 48px', table: { defaultValue: { summary: 'md' } } },
  },
};

export const Playground = {
  args: { icon: 'solar:clipboard-list-linear', title: 'No assessments yet', tone: 'neutral', size: 'md' },
};

/** Title, description and an action. */
export const WithAction = {
  args: {
    icon: 'solar:bolt-linear',
    title: 'No triggers yet',
    description: 'Add a trigger to automate actions when members enter or leave this group.',
    action: <Button leadingIcon="solar:add-circle-linear">Add Trigger</Button>,
  },
};

/** For a fetch that failed: the icon turns red and the action retries. */
export const ErrorTone = {
  args: {
    tone: 'danger',
    icon: 'solar:danger-triangle-linear',
    title: 'Could not load members',
    description: "The fetch failed, so this doesn't mean nobody qualifies.",
    action: <Button variant="soft" leadingIcon="solar:refresh-linear">Try Again</Button>,
  },
};

/** The three medallion sizes. */
export const Sizes = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'flex-end' }}>
      {['md', 'sm', 'xs'].map(size => (
        <EmptyState key={size} size={size} icon="solar:calendar-linear" title={`size="${size}"`} />
      ))}
    </div>
  ),
};

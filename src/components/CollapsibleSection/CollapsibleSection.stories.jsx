import { CollapsibleSection } from './CollapsibleSection';

export default {
  title: 'Layout/CollapsibleSection',
  component: CollapsibleSection,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'A bordered accordion card for long forms: an icon and title header that folds the body away. Built on `Collapsible`.',
      },
    },
  },
  argTypes: {
    defaultOpen: { control: 'boolean', table: { defaultValue: { summary: 'true' } } },
    onOpenChange: { action: 'onOpenChange' },
  },
};

export const Playground = {
  args: { icon: 'solar:shield-user-linear', title: 'Plan Identifiers', defaultOpen: true },
  render: (args) => (
    <div style={{ width: 420 }}>
      <CollapsibleSection {...args}>
        <span style={{ color: 'var(--neutral-300)', fontSize: 'var(--font-base)' }}>Plan name, group number, external ID…</span>
      </CollapsibleSection>
    </div>
  ),
};

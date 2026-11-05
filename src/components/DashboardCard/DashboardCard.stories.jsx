import { DashboardCard, DashboardCardBody } from './DashboardCard';
import { PanelSectionItem } from '../PanelSection/PanelSection';
import { Badge } from '../Badge/Badge';
import { Button } from '../Button/Button';
import { ActionButton } from '../ActionButton/ActionButton';

export default {
  title: 'Layout/DashboardCard',
  component: DashboardCard,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A bordered card for dashboard grids such as the patient Overview: icon, title and count on the left, actions on the right. `tone="ai"` gives the Unity-generated treatment (gradient wash, lilac border, gradient title). Wrap padded content in `DashboardCardBody`; rows are `PanelSectionItem`s.',
      },
    },
  },
  decorators: [Story => <div style={{ width: 400 }}><Story /></div>],
};

const NOTES = [
  { id: 1, title: 'SOAP Note', meta: ['Dr. Emily Carter', '02/19/2024'], status: 'In Progress', tone: 'warning' },
  { id: 2, title: 'Discharge Summary', meta: ['Dr. Sarah Thompson', '02/19/2024'], status: 'Signed', tone: 'success' },
];

export const Default = {
  render: () => (
    <DashboardCard
      icon="solar:notes-linear"
      title="Recent Notes"
      count={2}
      actions={<Button variant="ghost" size="sm">Create note</Button>}
    >
      <DashboardCardBody>
        {NOTES.map(n => (
          <PanelSectionItem key={n.id} title={n.title} meta={n.meta} trailing={<Badge tone={n.tone} size="sm" label={n.status} />} />
        ))}
      </DashboardCardBody>
    </DashboardCard>
  ),
};

export const Ai = {
  render: () => (
    <DashboardCard
      tone="ai"
      icon="custom:ai"
      title="Patient Synopsis"
      actions={<ActionButton icon="solar:refresh-linear" size="sm" tooltip="Regenerate" />}
      footer="Powered by Unity"
    >
      <DashboardCardBody>
        <p style={{ margin: 0, fontSize: 'var(--font-base)', color: 'var(--neutral-400)', lineHeight: 'var(--leading-loose)' }}>
          Annette is a 56-year-old woman with Type 2 Diabetes and Hypertension, both above target.
        </p>
      </DashboardCardBody>
    </DashboardCard>
  ),
};

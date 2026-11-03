import { useState } from 'react';
import { PanelSection, PanelSectionItem, PanelSectionMore } from './PanelSection';
import { Avatar } from '../Avatar/Avatar';
import { Badge } from '../Badge/Badge';
import { ActionButton } from '../ActionButton/ActionButton';
import { FilterChip } from '../FilterChip/FilterChip';

export default {
  title: 'Layout/PanelSection',
  component: PanelSection,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A collapsible section for side panels (patient Summary, Overview). The header holds a chevron + title and right-side actions; `PanelSectionItem` is the list row (leading avatar, title, dot-joined meta, trailing badge or control) and `PanelSectionMore` is the "View N More" toggle. Header and rows share one inline inset, so stacked sections line up on the same edges.',
      },
    },
  },
  decorators: [Story => <div style={{ width: 440, background: 'var(--neutral-0)' }}><Story /></div>],
};

const ROWS = [
  { id: 1, title: 'BlueCross Blue Shield', meta: ['Self'], status: 'Insured', variant: 'success' },
  { id: 2, title: 'American Heritage-Workplace Division', meta: ['Mother'], status: 'Expired', variant: 'danger' },
  { id: 3, title: 'Medicare Part B', meta: ['Self'], status: 'Insured', variant: 'success' },
  { id: 4, title: 'Aetna Dental', meta: ['Self'], status: 'Insured', variant: 'success' },
];

export const Default = {
  render: () => {
    const [expanded, setExpanded] = useState(false);
    const shown = expanded ? ROWS : ROWS.slice(0, 3);
    return (
      <>
        <PanelSection
          title="Insurance"
          actions={(
            <>
              <FilterChip size="S" singleSelect noClear label="View by" options={['Active', 'All']} selected={['Active']} onChange={() => {}} />
              <ActionButton icon="solar:add-circle-linear" size="sm" tooltip="Add" />
            </>
          )}
        >
          {shown.map(r => (
            <PanelSectionItem
              key={r.id}
              leading={<Avatar type="icon" variant="patient" iconName="solar:umbrella-linear" size="M" />}
              title={r.title}
              meta={r.meta}
              trailing={<Badge tone={r.variant} label={r.status} />}
            />
          ))}
          <PanelSectionMore expanded={expanded} hiddenCount={ROWS.length - 3} onToggle={() => setExpanded(v => !v)} />
        </PanelSection>
        <PanelSection title="Collapsed Section" defaultCollapsed>
          <PanelSectionItem title="Hidden until expanded" />
        </PanelSection>
      </>
    );
  },
};

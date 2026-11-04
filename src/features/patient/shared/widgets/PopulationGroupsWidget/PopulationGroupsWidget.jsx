import { useState } from 'react';
import { ActionButton } from '../../../../../components/ActionButton/ActionButton';
import { Avatar } from '../../../../../components/Avatar/Avatar';
import { BadgeSelect } from '../../../../../components/BadgeSelect/BadgeSelect';
import { EmptyState } from '../../../../../components/EmptyState/EmptyState';
import { PanelSection, PanelSectionDivider, PanelSectionItem, PanelSectionMore } from '../../../../../components/PanelSection/PanelSection';

const GROUPS = [
  { id: 1, title: 'PHQ-8 completed every 3 months', joinedOn: '06/30/2023', source: 'Automation', status: 'Active' },
  { id: 2, title: 'Exercise interventions for fall prevention in community-dwelling older adults', joinedOn: '06/30/2023', source: 'Automation', status: 'Active' },
  { id: 3, title: 'Screen for hepatitis C virus infection in adolescents and adults', joinedOn: '06/30/2023', source: 'Automation', status: 'Active' },
  { id: 4, title: 'Screen for hepatitis C virus infection in adolescents and adults', joinedOn: '06/30/2023', source: 'Automation', status: 'Active' },
  { id: 5, title: 'Screen for hepatitis C virus infection in adolescents and adults', joinedOn: '06/30/2023', source: 'Automation', status: 'Active' },
];

const VIEW_OPTIONS = ['Active', 'Inactive', 'All'];
const PREVIEW_COUNT = 3;

export function PopulationGroupsWidget() {
  const [view, setView] = useState('Active');
  const [expanded, setExpanded] = useState(false);

  const groups = view === 'All' ? GROUPS : GROUPS.filter(g => g.status === view);
  const shown = expanded ? groups : groups.slice(0, PREVIEW_COUNT);

  return (
    <PanelSection
      icon="solar:users-group-rounded-linear"
      title="Population Groups"
      actions={(
        <>
          <BadgeSelect
            label="View By"
            value={view}
            options={VIEW_OPTIONS}
            onChange={(v) => { setView(v); setExpanded(false); }}
          />
          <PanelSectionDivider />
          <ActionButton icon="solar:add-circle-linear" size="sm" tooltip="Add to Population Group" />
        </>
      )}
    >
      {groups.length === 0 ? (
        <EmptyState icon="solar:users-group-rounded-linear" title={`No ${view.toLowerCase()} population groups`} size="sm" />
      ) : (
        <>
          {shown.map(g => (
            <PanelSectionItem
              key={g.id}
              leading={<Avatar type="icon" variant="patient" iconName="solar:users-group-rounded-linear" size="M" />}
              title={g.title}
              wrapTitle
              meta={[`Joined ${g.joinedOn}`, g.source]}
            />
          ))}
          <PanelSectionMore expanded={expanded} hiddenCount={groups.length - PREVIEW_COUNT} onToggle={() => setExpanded(v => !v)} />
        </>
      )}
    </PanelSection>
  );
}

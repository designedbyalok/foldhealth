import { useState } from 'react';
import { Badge } from '../Badge/Badge';
import { LinkageTree } from './LinkageTree';

export default {
  title: 'Layout/LinkageTree',
  component: LinkageTree,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Parents with their linked children nested beneath them, joined by connecting lines, and an Unlinked group at the end. Drag a child to another group to re-link it, by pointer or keyboard (focus the grip, Space, arrows, Space).',
      },
    },
  },
};

const INITIAL = {
  bp: ['Home BP log review', 'Transportation'],
  a1c: ['Diabetes education'],
  unlinked: ['Medication cost'],
};
const GOALS = [
  { key: 'bp', title: 'Blood pressure below 130/80', meta: 'Target 130/80 • Weekly' },
  { key: 'a1c', title: 'A1c below 7%', meta: 'Target 7% • Quarterly' },
];
const iconFor = (title) => (title === 'Transportation' || title === 'Medication cost'
  ? 'solar:signpost-2-linear'
  : 'solar:checklist-minimalistic-linear');

export const Default = {
  render: () => {
    const [links, setLinks] = useState(INITIAL);
    const toItems = (titles) => titles.map(t => ({
      key: t,
      title: t,
      icon: iconFor(t),
      meta: iconFor(t) === 'solar:signpost-2-linear' ? 'Barrier' : 'Intervention',
      trailing: <Badge size="sm" label="Not Started" />,
    }));
    const groups = [
      ...GOALS.map(g => ({ ...g, icon: 'solar:flag-linear', emptyText: 'Nothing linked yet', items: toItems(links[g.key]) })),
      { key: 'unlinked', title: 'Unlinked', unlinked: true, emptyText: 'Everything is linked to a goal.', items: toItems(links.unlinked) },
    ];
    return (
      <div style={{ width: 560 }}>
        <LinkageTree
          groups={groups}
          onMove={(item, from, to) => setLinks(prev => ({
            ...prev,
            [from]: prev[from].filter(t => t !== item.key),
            [to]: [...prev[to], item.key],
          }))}
        />
      </div>
    );
  },
};

export const ReadOnly = {
  render: () => (
    <div style={{ width: 560 }}>
      <LinkageTree
        readOnly
        groups={[
          {
            key: 'bp',
            title: 'Blood pressure below 130/80',
            icon: 'solar:flag-linear',
            items: [{ key: 'log', title: 'Home BP log review', icon: 'solar:checklist-minimalistic-linear', meta: 'Intervention' }],
          },
          { key: 'unlinked', title: 'Unlinked', unlinked: true, emptyText: 'Everything is linked to a goal.', items: [] },
        ]}
      />
    </div>
  ),
};

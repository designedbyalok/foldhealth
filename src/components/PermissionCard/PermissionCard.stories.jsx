import { useState } from 'react';
import { PermissionCard } from './PermissionCard';

export default {
  title: 'Data Display/PermissionCard',
  component: PermissionCard,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: { component: 'A titled card of on/off permissions with an Allow All switch, optionally grouped. Controlled: the parent owns which keys are on.' },
    },
  },
};

const GROUPS = [
  { label: 'Nav Bar Accesses', items: [{ key: 'home', label: 'Home' }, { key: 'population', label: 'Population' }, { key: 'calendar', label: 'Calendar' }] },
  { label: 'Other Accesses', items: [{ key: 'patient', label: 'Patient Details' }] },
];

export const Playground = {
  render: () => {
    const [off, setOff] = useState({ population: true });
    const keys = GROUPS.flatMap(g => g.items.map(i => i.key));
    return (
      <div style={{ width: 380, height: 360, display: 'flex' }}>
        <PermissionCard
          icon="solar:buildings-2-linear"
          title="Platform Access"
          groups={GROUPS}
          isOn={k => !off[k]}
          onToggle={(k, on) => setOff(o => ({ ...o, [k]: !on }))}
          onToggleAll={on => setOff(on ? {} : Object.fromEntries(keys.map(k => [k, true])))}
        />
      </div>
    );
  },
};

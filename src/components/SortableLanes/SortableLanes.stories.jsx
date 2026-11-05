import { useState } from 'react';
import { SortableLanes } from './SortableLanes';
import { ActionButton } from '../ActionButton/ActionButton';

export default {
  title: 'Layout/SortableLanes',
  component: SortableLanes,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A kanban-style board: drag cards to reorder within a lane or move them between lanes, by pointer or keyboard. The dragged card leaves a dashed slot where it will land. Cards with `disabled` stay in place, dimmed. `renderActions` controls appear on hover or focus, and always on disabled cards. Used by the patient Overview\'s Customize drawer.',
      },
    },
  },
};

const INITIAL = [
  { key: 'c1', title: 'Column 1', hint: 'Narrow, left', items: [{ key: 'synopsis', label: 'Patient Synopsis' }, { key: 'chart', label: 'Health Chart' }, { key: 'meds', label: 'Medications', disabled: true }] },
  { key: 'c2', title: 'Column 2', hint: 'Wide, middle', items: [{ key: 'actions', label: 'Suggested Actions' }, { key: 'plan', label: 'Care Plan' }] },
  { key: 'c3', title: 'Column 3', hint: 'Narrow, right', items: [{ key: 'tasks', label: 'Tasks' }, { key: 'insurance', label: 'Insurance', meta: 'Sample data', disabled: true }] },
];

export const Default = {
  render: () => {
    const [lanes, setLanes] = useState(INITIAL);
    const toggle = key => setLanes(prev => prev.map(l => ({ ...l, items: l.items.map(i => (i.key === key ? { ...i, disabled: !i.disabled } : i)) })));
    return (
      <div style={{ width: 560 }}>
        <SortableLanes
          lanes={lanes}
          onChange={setLanes}
          renderActions={item => (
            <ActionButton
              icon={item.disabled ? 'solar:eye-closed-linear' : 'solar:eye-linear'}
              size="sm"
              tooltip={item.disabled ? `Show ${item.label}` : `Hide ${item.label}`}
              onClick={() => toggle(item.key)}
            />
          )}
        />
      </div>
    );
  },
};

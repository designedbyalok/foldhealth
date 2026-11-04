import { useRef, useState } from 'react';
import { UserPickerPopover } from './UserPickerPopover';
import { Button } from '../Button/Button';

const USERS = [
  { id: 1, name: 'Alok Kumar', role: 'Care Manager' },
  { id: 2, name: 'Ketan Patni', role: 'Physician' },
  { id: 3, name: 'Jordan Diaz', role: 'Nurse' },
  { id: 4, name: 'Priya Shah', role: 'Care Coordinator' },
];

export default {
  title: 'Popovers/UserPickerPopover',
  component: UserPickerPopover,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: '"Select User" popover: a title, a search box, an optional Unassign row, then people with avatar, name and role, built on `Listbox`. `multiple` gives checkbox rows with Select All / Clear All; `pinned` lists some users first under their own header.',
      },
    },
  },
};

function Demo({ multiple = false, pinned }) {
  const ref = useRef(null);
  const [rect, setRect] = useState(null);
  const [picked, setPicked] = useState(multiple ? ['2'] : 2);
  return (
    <div>
      <Button ref={ref} variant="outline" onClick={() => setRect(ref.current.getBoundingClientRect())}>
        {multiple ? `${picked.length} selected` : (USERS.find(u => u.id === picked)?.name || 'Unassigned')}
      </Button>
      {rect && (
        <UserPickerPopover
          anchorRect={rect}
          users={USERS}
          selected={picked}
          multiple={multiple}
          pinned={pinned}
          onSelect={(v) => setPicked(multiple ? v : v.id)}
          onUnassign={multiple ? undefined : () => setPicked(null)}
          onClose={() => setRect(null)}
        />
      )}
    </div>
  );
}

export const Single = { render: () => <Demo /> };

/** Checkbox rows, with the care team pinned above everyone else. */
export const MultipleWithPinned = { render: () => <Demo multiple pinned={{ label: 'Care team', keys: ['1', '2'] }} /> };

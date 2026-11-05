import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { Calendar } from './Calendar';

export default {
  title: 'Core/Calendar',
  component: Calendar,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'One month of days (Figma Fold-Pixel-1.0). The grid only: `DatePickerPopover` adds the month / year navigation, the two-month range layout and Save / Clear. The picked day (else today) is the tab stop; arrows move by day and week, Home / End to the ends of the week, Enter or Space picks. Days outside `min` / `max` or refused by `isDayDisabled` are disabled (a string reason shows as a tooltip).',
      },
    },
  },
};

function SingleDemo() {
  const [picked, setPicked] = useState(new Date(2026, 10, 4));
  return (
    <div style={{ width: 252 }}>
      <Calendar year={2026} month={10} today={new Date(2026, 10, 4)} selected={picked} onPick={setPicked} isDayDisabled={(iso) => (iso === '2026-11-11' ? 'Veterans Day' : false)} />
    </div>
  );
}

export const Single = {
  render: () => <SingleDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const picked = canvas.getByRole('button', { name: 'Wednesday, November 4, 2026' });
    await expect(picked).toHaveAttribute('tabindex', '0');
    picked.focus();
    await userEvent.keyboard('{ArrowRight}{ArrowDown}');
    await expect(canvas.getByRole('button', { name: 'Thursday, November 12, 2026' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByRole('button', { name: 'Thursday, November 12, 2026' })).toHaveAttribute('aria-pressed', 'true');
  },
};

/** Range mode: the pale strip runs under the days between the ends. */
export const Range = {
  render: () => (
    <div style={{ width: 252 }}>
      <Calendar mode="range" year={2026} month={10} today={new Date(2026, 10, 4)} rangeStart={new Date(2026, 10, 9)} rangeEnd={new Date(2026, 10, 18)} onPick={() => {}} />
    </div>
  ),
};

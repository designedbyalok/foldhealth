import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { Listbox } from './Listbox';
import { Avatar } from '../Avatar/Avatar';

const FRUIT = ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry'].map(f => ({ value: f.toLowerCase(), label: f }));

export default {
  title: 'Core/Listbox',
  component: Listbox,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The list of options inside every picker: Select\'s menu, the filter popovers (checkbox, radio, search lists) and the user picker. It owns the rows, the selection mark (`indicator`: none, check, checkbox, radio), sections, filtering by `query` and the keyboard (Up / Down / Home / End, Enter or Space to pick). The picker around it owns the trigger, search box, header and footer. `variant="menu"` is Select\'s row look; `size="lg"` fits an avatar and a second line.',
      },
    },
  },
  argTypes: {
    indicator: { control: 'select', options: ['none', 'check', 'checkbox', 'radio'] },
    variant: { control: 'select', options: ['plain', 'menu'], table: { defaultValue: { summary: 'plain' } } },
    size: { control: 'select', options: ['md', 'lg'], table: { defaultValue: { summary: 'md' } } },
    multiple: { control: 'boolean' },
    onValueChange: { action: 'onValueChange' },
  },
};

const box = { width: 260, padding: 'var(--space-1)', border: '0.5px solid var(--neutral-150)', borderRadius: 'var(--space-2)', background: 'var(--neutral-0)' };

export const Playground = {
  args: { options: FRUIT, defaultValue: 'banana', indicator: 'none', variant: 'plain', 'aria-label': 'Fruit' },
  render: (args) => <div style={box}><Listbox {...args} /></div>,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('option', { name: 'Banana' }));
    await userEvent.keyboard('{ArrowDown}');
    await expect(canvas.getByRole('option', { name: 'Cherry' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByRole('option', { name: 'Cherry' })).toHaveAttribute('aria-selected', 'true');
    await expect(canvas.getByRole('option', { name: 'Banana' })).toHaveAttribute('aria-selected', 'false');
  },
};

/** Every mark, single and multiple, in both looks. */
export const Indicators = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {[['none', false, 'plain'], ['check', false, 'plain'], ['radio', false, 'plain'], ['checkbox', true, 'plain'], ['none', false, 'menu'], ['checkbox', true, 'menu']].map(([indicator, multiple, variant]) => (
        <div key={indicator + variant} style={box}>
          <Listbox
            aria-label={`${indicator} ${variant}`}
            options={FRUIT.slice(0, 4).map((f, i) => (i === 3 ? { ...f, disabled: true } : f))}
            indicator={indicator}
            multiple={multiple}
            variant={variant}
            defaultValue={multiple ? ['apple', 'cherry'] : 'banana'}
          />
        </div>
      ))}
    </div>
  ),
};

function PeopleDemo() {
  const [q, setQ] = useState('');
  const people = [
    { value: 'ak', label: 'Alok Kumar', description: 'Care Manager', section: 'Care team' },
    { value: 'kp', label: 'Ketan Patni', description: 'Physician', section: 'Care team' },
    { value: 'jd', label: 'Jordan Diaz', description: 'Nurse', section: 'All users' },
  ].map(p => ({ ...p, leading: <Avatar variant="staff" initials={p.label.split(' ').map(w => w[0]).join('')} size="M" /> }));
  return (
    <div style={box}>
      <input aria-label="Search people" placeholder="Search" value={q} onChange={e => setQ(e.target.value)} style={{ width: '100%', marginBottom: 'var(--space-1)' }} />
      <Listbox aria-label="People" options={people} indicator="check" size="lg" dividers defaultValue="kp" query={q} />
    </div>
  );
}

/** Rich rows: avatar, two lines, sections with dividers, filtered by a search box. */
export const People = { render: () => <PeopleDemo /> };

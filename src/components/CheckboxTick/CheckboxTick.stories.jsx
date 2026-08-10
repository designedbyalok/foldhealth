import { CheckboxTick } from './CheckboxTick';

export default {
  title: 'Forms/CheckboxTick',
  component: CheckboxTick,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The *look* of a checkbox with none of the behaviour — decorative and always `aria-hidden`. Use it inside a control that already owns the interaction (a menu-item `<button role="menuitemcheckbox">`, a `role="checkbox"` row). A real `<input type="checkbox">` in that position nests one control inside another, which is invalid HTML and leaves the inner box unlabelled. The enclosing control must carry `aria-checked`; this only paints the state.',
      },
    },
  },
  argTypes: {
    checked: {
      control: 'boolean',
      description: 'Filled + ticked when true.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' } },
    },
    size: {
      control: { type: 'number', min: 10, max: 32, step: 1 },
      description: 'Box edge in px.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '15' } },
    },
  },
};

export const Unchecked = { args: { checked: false } };
export const Checked = { args: { checked: true } };
export const Large = { args: { checked: true, size: 24 } };

export const InAMenuItem = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', width: 220 }}>
      {[
        ['Urgent', true],
        ['Follow-up', false],
        ['Billing', true],
      ].map(([label, checked]) => (
        <button
          key={label}
          type="button"
          role="menuitemcheckbox"
          aria-checked={checked}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
            background: 'none', border: 'none', font: 'inherit', color: 'inherit',
            textAlign: 'left', cursor: 'pointer',
          }}
        >
          <CheckboxTick checked={checked} />
          {label}
        </button>
      ))}
    </div>
  ),
  parameters: {
    docs: { description: { story: 'The intended shape: the button is the control and carries `aria-checked`; the tick is decoration.' } },
  },
};

import { Avatar } from './Avatar';

export default {
  title: 'Core/Avatar',
  component: Avatar,
  tags: ['autodocs'],
  parameters: {
    controls: { sort: 'none' },
    docs: {
      description: {
        component:
          'A round or square identity chip, shows a person\'s initials in a tinted background whose color scheme is picked by `variant` (patient / agent / provider / assignee). Used for patient avatars, assignee cells, comment authors, and any place a person needs to be identified at a glance.',
      },
    },
  },
  argTypes: {
    type: {
      control: 'inline-radio',
      options: ['initial', 'icon'],
      description: 'Toggle between Initial Avatar (initials) and Icon Avatar (Solar icon).',
      table: { order: 1 },
    },
    variant: {
      control: 'select',
      options: ['patient', 'staff', 'others'],
      table: { order: 2 },
    },
    initials: {
      control: 'text',
      if: { arg: 'type', eq: 'initial' },
      table: { order: 3 },
    },
    iconName: {
      control: 'text',
      description: 'Solar icon name, e.g. solar:user-linear.',
      if: { arg: 'type', eq: 'icon' },
      table: { order: 3 },
    },
    size: {
      control: 'select',
      options: ['XS', 'S', 'M', 'L', 'XL', 'DXL'],
      table: { order: 4 },
    },
  },
};

export const Playground = {
  args: { type: 'initial', variant: 'patient', initials: 'AB', iconName: 'solar:user-linear', size: 'M' },
};

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'DXL'];
const COLOR_VARIANTS = [
  { key: 'patient', label: 'Patient (primary)' },
  { key: 'staff',   label: 'Staff (secondary)' },
  { key: 'others',  label: 'Others (grey)' },
];

export const AllSizesAndVariants = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {COLOR_VARIANTS.map(v => (
        <div key={v.key} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 'var(--font-sm)', color: 'var(--neutral-300)' }}>{v.label}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {SIZES.map(s => (
              <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <Avatar variant={v.key} initials="AB" size={s} />
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--neutral-200)' }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  ),
};

export const IconAvatar = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {COLOR_VARIANTS.map(v => (
        <div key={v.key} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 'var(--font-sm)', color: 'var(--neutral-300)' }}>{v.label}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {SIZES.map(s => (
              <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <Avatar variant={v.key} type="icon" iconName="solar:user-linear" size={s} />
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--neutral-200)' }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  ),
};

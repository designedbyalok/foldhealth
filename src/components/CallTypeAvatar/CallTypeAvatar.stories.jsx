import { CallTypeAvatar } from './CallTypeAvatar';

export default {
  title: 'Core/CallTypeAvatar',
  component: CallTypeAvatar,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Round avatar that shows a call\'s direction/outcome (outgoing, incoming, answered, missed, declined). Wraps `Avatar` with per-direction icon, background, and border colors. Used in the Calls view and call-history rows.',
      },
    },
  },
  argTypes: {
    dir: {
      control: 'select',
      options: ['outgoing', 'incoming', 'answered', 'missed', 'declined'],
      description: 'Call direction/outcome: drives icon and color scheme.',
      table: { type: { summary: "'outgoing' | 'incoming' | 'answered' | 'missed' | 'declined'" } },
    },
    size: {
      control: { type: 'number', min: 20, max: 96 },
      description: 'Avatar diameter in px.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '36' } },
    },
    iconSize: {
      control: { type: 'number', min: 10, max: 48 },
      description: 'Inner icon size in px.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '18' } },
    },
  },
};

export const Playground = { args: { dir: 'outgoing', size: 36, iconSize: 18 } };

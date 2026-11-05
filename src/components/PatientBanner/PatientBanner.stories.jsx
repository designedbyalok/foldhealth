import { PatientBanner } from './PatientBanner';

export default {
  title: 'Composed/PatientBanner',
  component: PatientBanner,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: { component: 'Compact patient-header row used at the top of chart drawers, call drawers, and detail views. Shows avatar, name, gender/age, Fold ID, and (optional) RAF trend.' },
    },
  },
  argTypes: {
    initials: {
      control: 'text',
      description: 'Avatar initials (usually 2 letters).',
      table: { type: { summary: 'string' } },
    },
    name: {
      control: 'text',
      description: 'Patient full name.',
      table: { type: { summary: 'string' } },
    },
    gender: {
      control: 'select',
      options: ['Male', 'Female'],
      description: 'Patient gender label.',
      table: { type: { summary: "'Male' | 'Female'" } },
    },
    age: {
      control: 'text',
      description: 'Age string, e.g. "67y 2m".',
      table: { type: { summary: 'string' } },
    },
    memberId: {
      control: 'text',
      description: 'Fold ID, e.g. "11065".',
      table: { type: { summary: 'string' } },
    },
    raf: {
      control: 'text',
      description: 'RAF score, e.g. "4.234" (optional).',
      table: { type: { summary: 'string' } },
    },
    rafChange: {
      control: 'text',
      description: 'RAF change, e.g. "0.512" (optional).',
      table: { type: { summary: 'string' } },
    },
    rafUp: {
      control: 'boolean',
      description: 'RAF trend direction: `true` = up (green), `false` = down (red).',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'true' } },
    },
    hidePatientLabel: {
      control: 'boolean',
      description: 'Omit the leading "Patient" meta label.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' } },
    },
    onCall: {
      action: 'onCall',
      description: 'Call button handler: omit to hide the phone button.',
      table: { type: { summary: '() => void' } },
    },
  },
};

export const Playground = {
  args: {
    initials: 'JD',
    name: 'Jane Doe',
    gender: 'Female',
    age: '67y 2m',
    memberId: '11065',
    raf: '4.234',
    rafChange: '0.512',
    rafUp: true,
    hidePatientLabel: false,
  },
};

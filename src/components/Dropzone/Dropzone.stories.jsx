import { Dropzone } from './Dropzone';

export default {
  title: 'Forms/Dropzone',
  component: Dropzone,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: { component: 'Static drop area: accepts a single file (or many) via drop or click-to-browse, validates against `acceptMime`, and calls `onPick` / `onReject`.' },
    },
  },
  argTypes: {
    accept: {
      control: 'text',
      description: 'Native `accept` attribute for the underlying `<input type="file">` (comma-separated extensions or MIME types).',
      table: { type: { summary: 'string' } },
    },
    acceptMime: {
      control: 'object',
      description: "Set or array of MIME types used by the runtime validator (browsers can't be trusted to enforce the picker filter).",
      table: { type: { summary: 'Set<string> | string[]' } },
    },
    multiple: {
      control: 'boolean',
      description: 'Allow multi-file selection.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' } },
    },
    disabled: {
      control: 'boolean',
      description: 'Disable interaction.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' } },
    },
    icon: {
      control: 'text',
      description: 'Solar icon rendered above the CTA.',
      table: { type: { summary: 'string' }, defaultValue: { summary: 'solar:upload-minimalistic-linear' } },
    },
    iconSize: {
      control: { type: 'number', min: 12, max: 64 },
      description: 'Icon size in px.',
      table: { type: { summary: 'number' }, defaultValue: { summary: '24' } },
    },
    helperText: {
      control: 'text',
      description: 'Left-aligned helper row rendered below the drop area.',
      table: { type: { summary: 'string' } },
    },
    secondaryText: {
      control: 'text',
      description: 'Right-aligned helper row rendered below the drop area.',
      table: { type: { summary: 'string' } },
    },
    onPick: {
      action: 'onPick',
      description: 'Fires with the accepted file(s).',
      table: { type: { summary: '(file: File | File[]) => void' } },
    },
    onReject: {
      action: 'onReject',
      description: 'Fires when validation blocks the selection.',
      table: { type: { summary: '(files: File[]) => void' } },
    },
  },
};

export const Playground = {
  args: {
    accept: '.pdf,.doc,.docx,.jpg,.jpeg,.png',
    multiple: false,
    disabled: false,
    icon: 'solar:upload-minimalistic-linear',
    iconSize: 24,
    helperText: 'Supported formats: PDF, DOC, JPG, or PNG',
    secondaryText: 'Max size: 100 MB',
    onPick: (file) => console.log('picked', file),
    onReject: (files) => console.log('rejected', files),
  },
};

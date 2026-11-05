import { UploadDropField } from './UploadDropField';

export default {
  title: 'Forms/UploadDropField',
  component: UploadDropField,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: { component: 'Stateful upload widget: wraps `Dropzone` and manages drop → uploading → uploaded states. Emits the picked file via `onChange`.' },
    },
  },
  argTypes: {
    accept: {
      control: 'text',
      description: 'Comma-separated extensions forwarded to the underlying `Dropzone`.',
      table: { type: { summary: 'string' }, defaultValue: { summary: '.pdf,.doc,.docx,.jpg,.jpeg,.png' } },
    },
    helperText: {
      control: 'text',
      description: 'Left helper row shown under the drop area.',
      table: { type: { summary: 'string' }, defaultValue: { summary: 'Supported formats: PDF, DOC, JPG, or PNG' } },
    },
    secondaryText: {
      control: 'text',
      description: 'Right helper row shown under the drop area.',
      table: { type: { summary: 'string' }, defaultValue: { summary: 'Max size: 100 MB' } },
    },
    onChange: {
      action: 'onChange',
      description: 'Fires with the picked file once the upload completes.',
      table: { type: { summary: '(file: File) => void' } },
    },
  },
};

export const Playground = {
  args: {
    accept: '.pdf,.doc,.docx,.jpg,.jpeg,.png',
    helperText: 'Supported formats: PDF, DOC, JPG, or PNG',
    secondaryText: 'Max size: 100 MB',
    onChange: (file) => console.log('onChange', file),
  },
};

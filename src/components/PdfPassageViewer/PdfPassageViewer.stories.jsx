import { PdfPassageViewer } from './PdfPassageViewer';

export default {
  title: 'Data Display/PdfPassageViewer',
  component: PdfPassageViewer,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'A PDF rendered page under page, with a quoted passage highlighted and scrolled into view. Used to check an extracted item against its source document.',
      },
    },
  },
  argTypes: {
    page: { control: 'number' },
    passage: { control: 'text' },
  },
  decorators: [Story => <div style={{ height: 560, display: 'flex' }}><Story /></div>],
};

export const Default = {
  args: {
    src: '/charts/progress-note.pdf',
    page: 1,
    passage: 'Progress Note',
  },
};

export const NoPassage = {
  args: { src: '/charts/laboratory-report.pdf', page: 1, passage: '' },
};

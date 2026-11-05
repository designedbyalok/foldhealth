import { Timeline } from './Timeline';

export default {
  title: 'Data/Timeline',
  component: Timeline,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Vertical activity feed grouped by month. Each entry renders with an icon, actor, headline, and (optional) body.',
      },
    },
  },
  argTypes: {
    entries: {
      control: 'object',
      description: 'Activity entries in reverse-chronological order.',
      table: {
        type: {
          summary:
            "Array<{ id, t: 'note'|'status'|'upload'|…, by, role, headline, body?, file?, at: ISOString }>",
        },
      },
    },
    currentUserName: {
      control: 'text',
      description: 'Name of the current user: used to render "You" replacements.',
      table: { type: { summary: 'string' } },
    },
    emptyLabel: {
      control: 'text',
      description: 'Shown when `entries` is empty.',
      table: { type: { summary: 'string' }, defaultValue: { summary: 'No activity yet.' } },
    },
    renderExtra: {
      description: 'Optional render prop for injecting custom content per entry.',
      table: { type: { summary: '(entry) => React.ReactNode' } },
    },
  },
};

const SAMPLE = [
  {
    id: 1,
    createdAt: '2026-07-22T10:00:00Z',
    date: 'Jul 22, 2026',
    time: '10:00 AM',
    user: 'You',
    action: 'note',
    details: 'Confirmed diabetes with retinopathy. Ophthalmology note attached.',
    category: 'Coder note',
  },
  {
    id: 2,
    createdAt: '2026-07-21T15:00:00Z',
    date: 'Jul 21, 2026',
    time: '3:00 PM',
    user: 'Ana Torres',
    action: 'updated',
    details: 'Marked review as complete',
    changes: [{ type: 'status', from: 'In Progress', to: 'Verified' }],
  },
  {
    id: 3,
    createdAt: '2026-07-20T09:15:00Z',
    date: 'Jul 20, 2026',
    time: '9:15 AM',
    user: 'You',
    action: 'created',
    details: 'Uploaded chart.pdf',
    category: 'Document',
  },
  {
    id: 4,
    createdAt: '2026-06-30T11:42:00Z',
    date: 'Jun 30, 2026',
    time: '11:42 AM',
    user: 'Priya Nair',
    action: 'previewed',
    details: 'Reviewed prior encounter notes',
  },
];

export const Playground = { args: { entries: SAMPLE, currentUserName: 'You' } };

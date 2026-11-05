import { useState } from 'react';
import { ReasonDialog } from './ReasonDialog';
import { Button } from '../Button/Button';

export default {
  title: 'Overlays/ReasonDialog',
  component: ReasonDialog,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Confirmation dialog that collects a required reason before completing a Pass/Fail decision (used by document review, dismiss/reject flows).',
      },
    },
  },
  argTypes: {
    title: {
      control: 'text',
      description: 'Dialog heading.',
      table: { type: { summary: 'string' } },
    },
    description: {
      control: 'text',
      description: 'Supporting body copy under the title.',
      table: { type: { summary: 'string' } },
    },
    decision: {
      control: 'select',
      options: ['pass', 'fail'],
      description: 'Which decision is being confirmed: controls copy + button color.',
      table: { type: { summary: "'pass' | 'fail'" }, defaultValue: { summary: 'fail' } },
    },
    standardReasons: {
      control: 'object',
      description: 'Preset reason chips shown as one-click picks (last entry is typically "Other").',
      table: { type: { summary: 'string[]' }, defaultValue: { summary: '[]' } },
    },
    onSubmit: {
      action: 'onSubmit',
      description: 'Fires with the chosen reason + free-text note.',
      table: { type: { summary: '(reason: string, note?: string) => void' } },
    },
    onCancel: {
      action: 'onCancel',
      description: 'Fires when the user dismisses the dialog.',
      table: { type: { summary: '() => void' } },
    },
  },
};

const REASONS = ['Illegible', 'Missing signature', 'Wrong DOS', 'Missing provider', 'Other'];

function Wrapper(props) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24 }}>
      <Button variant="soft" tone="danger" onClick={() => setOpen(true)}>Open ReasonDialog</Button>
      {open && (
        <ReasonDialog
          {...props}
          onCancel={() => setOpen(false)}
          onSubmit={() => setOpen(false)}
        />
      )}
    </div>
  );
}

export const Playground = {
  render: (args) => <Wrapper {...args} />,
  args: { title: 'Why is this document failing?', description: 'Pick the closest reason. "Other" requires a note.', decision: 'fail', standardReasons: REASONS },
};

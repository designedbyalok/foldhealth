import { useState } from 'react';
import { RecordsRequestDialog } from './RecordsRequestDialog';
import { Button } from '../../../components/Button/Button';

export default {
  title: 'HCC / DiagPanel / RecordsRequestDialog',
  component: RecordsRequestDialog,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Modal shown when QA or Compliance picks "Record Requested" in the DOS status menu. Forces a role selection (Coder, QA (Compliance only), or Support Team) before the transition commits, and optionally captures a ≤150 char comment that the destination role will see in the Comments tab. Mirrors Figma ICD-Import 5723-171525. 12px corner radius.',
      },
    },
  },
  argTypes: {
    lastAssignees: {
      control: 'object',
      description:
        '{ coder, support, qa }, name of the last assignee per role. Used to seed the Assignee picker with the reviewer the DOS row was last routed to.',
      table: { type: { summary: '{ coder?: string, support?: string, qa?: string }' } },
    },
    onConfirm: {
      action: 'onConfirm',
      description:
        'Fires with `{ destinationRole, comment, mentions, attachments, assigneeId }` on Request Record click.',
      table: { type: { summary: '(payload) => void' } },
    },
    onCancel: {
      action: 'onCancel',
      description: 'Fires when the user hits Cancel or dismisses via overlay/Escape.',
      table: { type: { summary: '() => void' } },
    },
  },
};

function Harness(args) {
  const [open, setOpen] = useState(true);
  const [lastPayload, setLastPayload] = useState(null);
  return (
    <div style={{ padding: 24, minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 16, background: 'var(--neutral-25)' }}>
      <Button onClick={() => setOpen(true)}>Open dialog</Button>
      {lastPayload && (
        <pre
          style={{
            padding: 'var(--space-3)',
            background: 'var(--neutral-0)',
            border: '1px solid var(--neutral-150)',
            borderRadius: 'var(--space-2)',
            fontSize: 'var(--font-sm)',
            color: 'var(--neutral-500)',
            maxWidth: 'calc(var(--space-8) * 20)',
          }}
        >
          {JSON.stringify(lastPayload, null, 2)}
        </pre>
      )}
      {open && (
        <RecordsRequestDialog
          {...args}
          onCancel={() => { args.onCancel?.(); setOpen(false); }}
          onConfirm={(payload) => {
            args.onConfirm?.(payload);
            setLastPayload(payload);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

export const Default = {
  render: Harness,
  args: {
    lastAssignees: { coder: 'Deborah Hintz', support: 'Marcus Chen', qa: 'Priya Naidu' },
  },
};

export const NoPriorAssignments = {
  render: Harness,
  args: {
    lastAssignees: {},
  },
  parameters: {
    docs: { description: { story: 'When no last-assignee is known for a role, the picker falls back to the first eligible reviewer in the roster.' } },
  },
};

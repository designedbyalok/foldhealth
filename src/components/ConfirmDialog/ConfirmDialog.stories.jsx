import { useState } from 'react';
import { ConfirmDialog } from './ConfirmDialog';
import { Button } from '../Button/Button';

export default {
  title: 'Overlays/ConfirmDialog',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Centered modal dialog for confirming an action. Use `variant="destructive"` (filled red-circle icon, danger button) for irreversible actions like delete/discard; `variant="warning"` (default) for reversible warnings; `variant="primary"` for informational confirms.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['warning', 'destructive', 'primary'],
      description: 'Preset look. `destructive` = filled red icon + danger button. `warning` = triangle icon + danger button. `primary` = info icon + primary button.',
      table: { type: { summary: "'warning' | 'destructive' | 'primary'" }, defaultValue: { summary: 'warning' } },
    },
    icon: {
      control: 'text',
      description: 'Override the variant\'s default Iconify name.',
      table: { type: { summary: 'string' } },
    },
    iconColor: {
      control: 'color',
      description: 'Override the icon color.',
      table: { type: { summary: 'string' } },
    },
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
    confirmLabel: {
      control: 'text',
      description: 'Label for the primary action button.',
      table: { type: { summary: 'string' }, defaultValue: { summary: 'Delete' } },
    },
    cancelLabel: {
      control: 'text',
      description: 'Label for the cancel button.',
      table: { type: { summary: 'string' }, defaultValue: { summary: 'Cancel' } },
    },
    loading: {
      control: 'boolean',
      description: 'Disables both buttons and shows a busy state while an async action is pending.',
      table: { type: { summary: 'boolean' }, defaultValue: { summary: 'false' } },
    },
    onConfirm: {
      action: 'onConfirm',
      description: 'Fires when the primary button is clicked.',
      table: { type: { summary: '() => void' } },
    },
    onCancel: {
      action: 'onCancel',
      description: 'Fires when Cancel or the overlay is clicked.',
      table: { type: { summary: '() => void' } },
    },
  },
};

const centerStage = { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24 };

function DialogWrapper(props) {
  const [open, setOpen] = useState(false);
  return (
    <div style={centerStage}>
      <Button
        variant={props.variant === 'destructive' ? 'soft' : 'outline'} tone={props.variant === 'destructive' ? 'danger' : 'neutral'}
        onClick={() => setOpen(true)}
      >
        Open ConfirmDialog
      </Button>
      {open && <ConfirmDialog {...props} onConfirm={() => setOpen(false)} onCancel={() => setOpen(false)} />}
    </div>
  );
}

export const Playground = {
  render: (args) => <DialogWrapper {...args} />,
  args: {
    variant: 'destructive',
    title: 'Delete this DOS?',
    description: 'This will remove the DOS row and all associated ICDs.',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
  },
};

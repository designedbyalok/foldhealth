import { useState } from 'react';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from './Dialog';
import { Button } from '../Button/Button';

export default {
  title: 'Core/Dialog',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'shadcn/ui compound `Dialog` (Radix-backed): general-purpose modal. Compose: `Dialog` (root, open state), `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose`. Use the `example` control to flip between the composition patterns.',
      },
    },
  },
  argTypes: {
    example: {
      control: { type: 'select' },
      options: ['edit-form', 'info', 'confirm-destructive'],
      description: 'Composition pattern: form dialog, single-action info, or destructive confirm.',
    },
  },
  args: { example: 'edit-form' },
};

const EXAMPLES = {
  'edit-form': {
    trigger: <Button>Open Dialog</Button>,
    title: 'Edit profile',
    description: 'Make changes to your profile here. Click save when done.',
    body: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
        <label style={{ fontSize: 'var(--font-md)', color: 'var(--neutral-400)' }}>
          Name
          <input
            type="text"
            defaultValue="Jane Doe"
            style={{
              display: 'block',
              width: '100%',
              marginTop: 4,
              padding: '6px 10px',
              border: '0.5px solid var(--neutral-150)',
              borderRadius: 4,
              fontSize: 'var(--font-base)',
            }}
          />
        </label>
      </div>
    ),
    footer: (
      <>
        <DialogClose asChild>
          <Button variant="outline">Cancel</Button>
        </DialogClose>
        <Button>Save</Button>
      </>
    ),
  },
  'info': {
    trigger: <Button variant="outline">What's new</Button>,
    title: "What's new in Fold",
    description: 'A round-up of the latest changes across the worklist and drawers.',
    body: null,
    footer: (
      <DialogClose asChild>
        <Button>Got it</Button>
      </DialogClose>
    ),
  },
  'confirm-destructive': {
    trigger: <Button variant="soft" tone="danger">Discard changes</Button>,
    title: 'Discard unsaved changes?',
    description: 'You have unsaved edits. Closing now will drop them.',
    body: null,
    footer: (
      <>
        <DialogClose asChild>
          <Button variant="outline">Keep editing</Button>
        </DialogClose>
        <Button variant="soft" tone="danger">Discard</Button>
      </>
    ),
  },
};

function PlaygroundDialog({ example }) {
  const [open, setOpen] = useState(false);
  const cfg = EXAMPLES[example] || EXAMPLES['edit-form'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24 }}>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{cfg.trigger}</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{cfg.title}</DialogTitle>
            <DialogDescription>{cfg.description}</DialogDescription>
          </DialogHeader>
          {cfg.body}
          <DialogFooter>{cfg.footer}</DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const Playground = { render: (args) => <PlaygroundDialog {...args} /> };

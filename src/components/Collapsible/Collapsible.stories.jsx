import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './Collapsible';
import { Button } from '../Button/Button';

export default {
  title: 'Core/Collapsible',
  component: Collapsible,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A region that folds away, in parts: `Collapsible` owns the open state (`open` / `defaultOpen` / `onOpenChange`), `CollapsibleTrigger` is the button (`aria-expanded`, `aria-controls`), and `CollapsibleContent` eases its height open and shut and is inert while shut. When the control lives elsewhere, use `CollapsibleContent` alone with `open`.',
      },
    },
  },
  argTypes: {
    defaultOpen: { control: 'boolean', table: { defaultValue: { summary: 'false' } } },
    disabled: { control: 'boolean' },
    onOpenChange: { action: 'onOpenChange' },
  },
};

const body = { padding: 'var(--space-3) 0', color: 'var(--neutral-300)', fontSize: 'var(--font-base)' };

export const Playground = {
  args: { defaultOpen: false, disabled: false },
  render: (args) => (
    <Collapsible {...args} style={{ width: 320 }}>
      <CollapsibleTrigger>Show details</CollapsibleTrigger>
      <CollapsibleContent>
        <p style={body}>Enrolled in CCM on 03/14/2026. Next review due in 12 days.</p>
      </CollapsibleContent>
    </Collapsible>
  ),
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'Show details' });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const region = canvasElement.querySelector(`#${CSS.escape(trigger.getAttribute('aria-controls'))}`);
    await expect(region).toHaveAttribute('data-state', 'open');
  },
};

function StandaloneDemo() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ width: 320 }}>
      <Button variant="outline" onClick={() => setOpen(o => !o)}>{open ? 'Hide' : 'Show'} filters</Button>
      <CollapsibleContent open={open}>
        <p style={body}>The control lives elsewhere, so the content takes `open` itself.</p>
      </CollapsibleContent>
    </div>
  );
}

/** `CollapsibleContent` on its own, opened by a control somewhere else. */
export const Standalone = { render: () => <StandaloneDemo /> };

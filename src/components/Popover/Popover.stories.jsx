import { useRef, useState } from 'react';
import { Popover } from './Popover';
import { Button } from '../Button/Button';
import { MenuPopover } from '../MenuPopover/MenuPopover';

export default {
  title: 'Overlays/Popover',
  component: Popover,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'The floating surface every anchored overlay is built on (MenuPopover, the list pickers, DatePickerPopover, AnchoredPopover, …). It positions against an element, a ref or a DOMRect with Floating UI (flip, shift, height capped to the space available), closes on Escape or an outside click, stacks so Escape and outside clicks close only the top popover, and moves focus in on open and back on close. Build new popovers on it rather than on `createPortal`.',
      },
    },
  },
  argTypes: {
    placement: {
      control: 'select',
      options: ['bottom-start', 'bottom', 'bottom-end', 'top-start', 'top', 'top-end', 'left', 'right'],
    },
    offset: { control: { type: 'number', min: 0, max: 24 } },
    width: { control: { type: 'number', min: 120, max: 480, step: 20 } },
    overlay: { control: 'boolean' },
    backdrop: { control: 'boolean' },
    centered: { control: 'boolean' },
    unstyled: { control: 'boolean' },
    role: { control: 'select', options: ['dialog', 'menu', 'listbox', 'group'] },
  },
  args: { placement: 'bottom-start', offset: 4, width: 260, overlay: true, backdrop: false, centered: false, unstyled: false, role: 'dialog' },
};

const center = { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 'var(--space-6)' };
const body = { padding: 'var(--space-3)', margin: 0, color: 'var(--neutral-400)', fontSize: 'var(--font-base)' };

function Trigger({ label = 'Open popover', children, style }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  return (
    <div style={style}>
      <span ref={ref} style={{ display: 'inline-flex' }}>
        <Button variant="secondary" onClick={() => setOpen(o => !o)}>{label}</Button>
      </span>
      {children({ anchor: ref, open, setOpen })}
    </div>
  );
}

export const Default = {
  render: (args) => (
    <Trigger style={center}>
      {({ anchor, open, setOpen }) => (
        <Popover {...args} anchor={anchor} open={open} onOpenChange={setOpen} aria-label="Example">
          <p style={body}>Anchored to the button. Press Escape or click outside to close.</p>
        </Popover>
      )}
    </Trigger>
  ),
};

/** Near the bottom edge it flips above the trigger; near a side it shifts to stay on screen. */
export const FlipsAtTheEdge = {
  render: (args) => (
    <Trigger label="Bottom-right trigger" style={{ position: 'fixed', right: 'var(--space-3)', bottom: 'var(--space-3)' }}>
      {({ anchor, open, setOpen }) => (
        <Popover {...args} anchor={anchor} open={open} onOpenChange={setOpen} aria-label="Edge example">
          <p style={body}>There was no room below or to the right, so it moved.</p>
        </Popover>
      )}
    </Trigger>
  ),
};

/** A popover opened from inside another stacks on top: Escape and outside clicks close only the child first. */
export const Nested = {
  render: (args) => {
    const innerRef = useRef(null);
    const [menu, setMenu] = useState(null);
    return (
      <Trigger style={center}>
        {({ anchor, open, setOpen }) => (
          <Popover {...args} anchor={anchor} open={open} onOpenChange={setOpen} aria-label="Parent">
            <div style={{ ...body, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', alignItems: 'flex-start' }}>
              <span>Parent popover</span>
              <span ref={innerRef} style={{ display: 'inline-flex' }}>
                <Button variant="secondary" size="S" onClick={() => setMenu(innerRef.current.getBoundingClientRect())}>Open menu</Button>
              </span>
            </div>
            {menu && (
              <MenuPopover
                anchorRect={menu}
                align="left"
                onClose={() => setMenu(null)}
                onSelect={() => {}}
                items={[
                  { key: 'edit', icon: 'solar:pen-linear', label: 'Edit' },
                  { key: 'delete', icon: 'solar:trash-bin-trash-linear', label: 'Delete', danger: true },
                ]}
              />
            )}
          </Popover>
        )}
      </Trigger>
    );
  },
};

export const Centered = {
  args: { centered: true, backdrop: true, width: 420 },
  render: (args) => (
    <Trigger style={center}>
      {({ anchor, open, setOpen }) => (
        <Popover {...args} anchor={anchor} open={open} onOpenChange={setOpen} aria-label="Centered example">
          <p style={body}>Centered in the viewport, with the page dimmed behind it.</p>
        </Popover>
      )}
    </Trigger>
  ),
};

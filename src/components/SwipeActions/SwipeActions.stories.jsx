import { fn } from 'storybook/test';
import { SwipeActions } from './SwipeActions';

const rowStyle = {
  display: 'block',
  width: '100%',
  padding: 'var(--space-4)',
  background: 'var(--neutral-0)',
  border: 'none',
  borderBottom: '0.5px solid var(--neutral-150)',
  textAlign: 'left',
  font: 'inherit',
  fontSize: 'var(--font-base)',
  color: 'var(--neutral-500)',
};

export default {
  title: 'Primitives/SwipeActions',
  component: SwipeActions,
  decorators: [Story => <div style={{ width: 375 }}><Story /></div>],
  args: {
    leading: { key: 'call', label: 'Call', icon: 'solar:phone-linear', onAction: fn() },
    trailing: [
      { key: 'chat', label: 'Chat', icon: 'solar:chat-round-linear', onAction: fn() },
      { key: 'task', label: 'Task', icon: 'solar:checklist-minimalistic-linear', onAction: fn() },
      { key: 'more', label: 'More', icon: 'solar:menu-dots-linear', onAction: fn() },
    ],
    children: <button type="button" style={rowStyle}>Swipe this row left or right</button>,
  },
};

export const Default = {};

export const TrailingOnly = { args: { leading: undefined } };

export const DisabledActions = {
  args: {
    leading: { key: 'call', label: 'Call', icon: 'solar:phone-linear', onAction: fn(), disabled: true },
    trailing: [
      { key: 'chat', label: 'Chat', icon: 'solar:chat-round-linear', onAction: fn(), disabled: true },
      { key: 'more', label: 'More', icon: 'solar:menu-dots-linear', onAction: fn() },
    ],
  },
};

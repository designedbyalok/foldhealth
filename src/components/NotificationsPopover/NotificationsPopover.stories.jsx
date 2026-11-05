import { useRef, useState } from 'react';
import { NotificationsPopover } from './NotificationsPopover';
import { Icon } from '../Icon/Icon';

export default {
  title: 'Overlays/NotificationsPopover',
  component: NotificationsPopover,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Bell-icon dropdown that lists entries from the app\'s notifications slice. Each entry has a typed icon, title, body, and relative timestamp. Clicking an entry runs its mapped action and marks it read; the footer "Mark all as read" clears the unread badge. Click-outside closes via a document listener.',
      },
    },
  },
  argTypes: {
    anchorRef: {
      description: 'Ref to the anchor element (usually the bell icon): used by the click-outside handler.',
      table: { type: { summary: 'RefObject<HTMLElement>' } },
      control: false,
    },
    onClose: {
      action: 'onClose',
      description: 'Fires when the popover should dismiss (overlay click or Escape).',
      table: { type: { summary: '() => void' } },
    },
  },
};

function BellDemo(props) {
  const bellRef = useRef(null);
  const [open, setOpen] = useState(true);
  return (
    <div style={{ padding: 24, display: 'flex', justifyContent: 'flex-end' }}>
      <button
        ref={bellRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 6, border: '1px solid var(--neutral-150)', background: 'var(--neutral-0)', cursor: 'pointer',
        }}
        aria-label="Notifications"
      >
        <Icon name="solar:bell-linear" size={18} color="var(--neutral-400)" />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 64, right: 24 }}>
          <NotificationsPopover
            anchorRef={bellRef}
            onClose={() => { setOpen(false); props.onClose?.(); }}
          />
        </div>
      )}
    </div>
  );
}

export const Playground = { render: (args) => <BellDemo {...args} /> };

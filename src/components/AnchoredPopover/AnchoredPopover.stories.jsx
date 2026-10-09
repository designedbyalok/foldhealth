import { useRef, useState } from 'react';
import { AnchoredPopover } from './AnchoredPopover';
import { Button } from '../Button/Button';

export default {
  title: 'Overlays/AnchoredPopover',
  component: AnchoredPopover,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: { component: 'A titled panel anchored to a trigger, for short content that needs more than a menu (a list to review, a small form). Closes on Escape or an outside click.' },
    },
  },
};

export const Default = {
  render: () => {
    const ref = useRef(null);
    const [rect, setRect] = useState(null);
    return (
      <div style={{ padding: 40 }}>
        <span ref={ref}>
          <Button variant="secondary" size="M" onClick={() => setRect(ref.current.getBoundingClientRect())}>Open</Button>
        </span>
        {rect && (
          <AnchoredPopover anchorRect={rect} align="left" backdrop title="3 items to review" description="A short line saying what to do here." onClose={() => setRect(null)}>
            <p style={{ margin: 0 }}>Popover content.</p>
          </AnchoredPopover>
        )}
      </div>
    );
  },
};

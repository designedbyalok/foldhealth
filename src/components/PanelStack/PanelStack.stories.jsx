import { useState } from 'react';
import { PanelStack } from './PanelStack';
import { CloseButton } from '../CloseButton/CloseButton';

export default {
  title: 'Layout/PanelStack',
  component: PanelStack,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'A horizontal row of panel cards that scrolls and snaps one panel at a time. With more than one panel, each card leaves `peek` px of its neighbour showing; clicking that edge brings it into view. Drag a panel header handle to reorder. Used for the care program "Open in right panel" layout, where right-panel tabs open as panels beside the program.',
      },
    },
  },
  argTypes: {
    peek: { control: { type: 'range', min: 48, max: 200, step: 8 } },
  },
};

const SEED = ['Notes', 'Tasks', 'Care Program'];

function Body({ label }) {
  return (
    <div style={{ padding: 'var(--space-4)', overflow: 'auto', flex: 1 }}>
      <p style={{ margin: 0, color: 'var(--neutral-300)', fontSize: 'var(--font-base)' }}>
        {label} content. Scroll sideways (trackpad or Shift + wheel) to switch panels.
      </p>
    </div>
  );
}

export const Default = {
  args: { peek: 56 },
  render: function Render(args) {
    const [order, setOrder] = useState(SEED);
    const [active, setActive] = useState(SEED[0]);
    const close = (id) => {
      const next = order.filter(x => x !== id);
      setOrder(next);
      if (active === id) setActive(next[0]);
    };
    return (
      <div style={{ height: 420, display: 'flex', padding: 'var(--space-1)', background: 'var(--neutral-100)' }}>
        <PanelStack
          {...args}
          panels={order.map(id => ({
            id,
            title: id,
            actions: order.length > 1 ? <CloseButton size={16} label={`Close ${id}`} onClick={() => close(id)} /> : null,
            content: <Body label={id} />,
          }))}
          activeId={active}
          onActiveChange={setActive}
          onReorder={setOrder}
        />
      </div>
    );
  },
};

export const SinglePanel = {
  render: () => (
    <div style={{ height: 320, display: 'flex', padding: 'var(--space-1)', background: 'var(--neutral-100)' }}>
      <PanelStack panels={[{ id: 'only', title: 'Care Program', content: <Body label="A lone panel has no header" /> }]} activeId="only" />
    </div>
  ),
};

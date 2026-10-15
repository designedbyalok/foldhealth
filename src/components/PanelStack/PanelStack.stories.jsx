import { useState } from 'react';
import { PanelStack } from './PanelStack';

export default {
  title: 'Layout/PanelStack',
  component: PanelStack,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Panels side by side that scroll and snap one at a time, with browser-style tabs on top once there is more than one. With more than one panel, each card leaves `peek` px of its neighbour showing; clicking that edge brings it into view. Click a tab to bring its panel into focus; drag a tab to reorder. Used for the care program "Open in right panel" layout, where right-panel tabs open as panels beside the program.',
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
            onClose: id === 'Care Program' ? undefined : () => close(id),
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
      <PanelStack panels={[{ id: 'only', title: 'Care Program', content: <Body label="A lone panel has no tab bar" /> }]} activeId="only" />
    </div>
  ),
};

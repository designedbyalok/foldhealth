import { useRef } from 'react';
import { HorizontalScrollbar } from './HorizontalScrollbar';

export default {
  title: 'Data/HorizontalScrollbar',
  component: HorizontalScrollbar,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Sticky, always-visible horizontal scrollbar that mirrors an internal-scrolled container. Pair with a `ref` to that container.',
      },
    },
  },
  argTypes: {
    targetRef: {
      description: 'React ref pointing at the horizontally-scrollable container to mirror.',
      table: { type: { summary: 'React.RefObject<HTMLElement>' } },
    },
  },
};

export const Default = {
  render: () => {
    function Inner() {
      const ref = useRef(null);
      return (
        <div style={{ width: 480 }}>
          <div ref={ref} style={{ overflowX: 'auto', border: '0.5px solid var(--neutral-150)', borderRadius: 4 }}>
            <div style={{ width: 1600, height: 80, padding: 12, background: 'repeating-linear-gradient(90deg, var(--neutral-50), var(--neutral-50) 40px, var(--neutral-100) 40px, var(--neutral-100) 80px)' }}>
              Wide content: scroll me
            </div>
          </div>
          <HorizontalScrollbar targetRef={ref} />
        </div>
      );
    }
    return <Inner />;
  },
};

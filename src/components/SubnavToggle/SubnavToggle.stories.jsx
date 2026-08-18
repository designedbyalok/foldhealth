import { SubnavToggle } from './SubnavToggle';

export default {
  title: 'Navigation/SubnavToggle',
  component: SubnavToggle,
  parameters: {
    docs: {
      description: {
        component:
          'Sidebar collapse handle placed at the leading edge of every worklist header. Reads state from the app store, so storybook renders a stateless illustration.',
      },
    },
  },
};

export const Default = () => (
  <div style={{ padding: 12, background: 'var(--neutral-0)' }}>
    <SubnavToggle />
  </div>
);

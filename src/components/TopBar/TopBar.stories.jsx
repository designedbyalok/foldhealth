import { TopBar } from './TopBar';

export default {
  title: 'Navigation/TopBar',
  component: TopBar,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'App-wide top bar, breadcrumbs, patient search, Ask Unity, Notifications, Create New popover, Schedule drawer trigger, profile popover. Store-driven, no props.',
      },
    },
  },
};

/**
 * TopBar is store-driven: breadcrumbs, patient search, notifications,
 * Create New, Schedule, and the profile popover all wire directly to
 * `useAppStore` and Supabase auth. There are no props to configure.
 */
export const Playground = {
  render: () => (
    <div style={{ minHeight: '100vh', background: 'var(--neutral-0)' }}>
      <TopBar />
      <div style={{ padding: 24, color: 'var(--neutral-300)', fontSize: 'var(--font-md)', fontFamily: "'Inter', sans-serif" }}>
        App content sits below the top bar.
      </div>
    </div>
  ),
};

import { useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { useAppStore } from '../../store/useAppStore';

export default {
  title: 'Navigation/Sidebar',
  component: Sidebar,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Global left-rail navigation. Store-driven, the active page, theme, nav style, ' +
          'and unread badge all come from `useAppStore`. The pill background slides between ' +
          'items on route change (spring-eased, ~360ms) and icons crossfade between the ' +
          'linear and bold Solar variants. Use the `theme` and `navStyle` controls below to ' +
          'flip between color themes (Foldhealth default, Dark, Blue, Astrana plum) and the ' +
          'minimal light-surface nav variant.',
      },
    },
  },
  argTypes: {
    theme: {
      description: 'Color theme. Plum swaps the sidebar logo to the Astrana wordmark.',
      control: { type: 'select' },
      options: ['light', 'dark', 'blue', 'plum'],
    },
    navStyle: {
      description: 'Nav surface style. `light` renders the minimal white-surface variant.',
      control: { type: 'select' },
      options: ['default', 'light'],
    },
  },
  args: {
    theme: 'light',
    navStyle: 'default',
  },
};

/**
 * StoryFrame: pushes the story's chosen theme + navStyle into the store on
 * mount and restores previous state on unmount, so switching stories doesn't
 * leak app-wide theme changes into the next preview. It also patches the
 * store's `requestNavigate` while the story is mounted so every nav item is
 * clickable inside Storybook: the real app gates "coming soon" pages, but
 * for demo purposes we want the pill to slide anywhere the user clicks.
 */
function StoryFrame({ theme, navStyle }) {
  useEffect(() => {
    const prev = {
      theme: useAppStore.getState().theme,
      navStyle: useAppStore.getState().navStyle,
      requestNavigate: useAppStore.getState().requestNavigate,
    };
    useAppStore.setState({
      theme,
      navStyle,
      // Storybook-only: bypass the "coming soon" toast so every rail item
      // moves the pill. Real app keeps its gating via the original action.
      requestNavigate: (page) => useAppStore.setState({ activePage: page }),
    });
    return () => useAppStore.setState(prev);
  }, [theme, navStyle]);

  return (
    <div
      // Scoped so the token overrides in tokens.css apply only inside this
      // story's subtree, not the Storybook chrome around it. `plum` here
      // matches `[data-theme="plum"]` and swaps the sidebar tokens to the
      // Astrana plum palette; `--sidebar-logo` still resolves via
      // `theme === 'plum'` in the Sidebar body (which draws the wordmark).
      data-theme={theme === 'light' ? undefined : theme}
      data-nav-style={navStyle === 'light' ? 'light' : undefined}
      style={{ display: 'flex', minHeight: '100vh', background: 'var(--neutral-0)' }}
    >
      <Sidebar />
      <div style={{ flex: 1, padding: 24, fontFamily: "'Inter', sans-serif", color: 'var(--neutral-400)' }}>
        <div style={{ fontSize: 'var(--font-base)', fontWeight: 500, color: 'var(--neutral-500)', marginBottom: 6 }}>
          Sidebar preview: theme: {theme}, navStyle: {navStyle}
        </div>
        <p style={{ fontSize: 'var(--font-md)', color: 'var(--neutral-300)', lineHeight: 1.6, maxWidth: 520 }}>
          Click any nav item to see the pill glide to it (spring-eased ~360ms) and the icon
          crossfade from its linear to its bold Solar variant. Use the Controls tab to switch
          between the Foldhealth default, dark, blue, and Astrana-plum themes, or flip navStyle
          to <code>light</code> for the minimal white-surface variant.
        </p>
      </div>
    </div>
  );
}

export const Playground = {
  render: (args) => <StoryFrame {...args} />,
};

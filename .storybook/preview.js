// Load Fold Health design tokens + global styles so all stories render with the correct theme.
// tailwind.css must load BEFORE index.css so the utility layer is registered before Fold's
// own resets; without it every shadcn/Radix primitive (Dialog, Popover, Tooltip, …) renders
// unstyled because the Tailwind classes referenced from `src/components/ui/*` are missing.
import '../src/styles/tailwind.css';
import '../src/tokens/tokens.css';
import '../src/index.css';

/** @type { import('@storybook/react-vite').Preview } */
const preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: 'error',
    },
    backgrounds: {
      options: {
        light: { name: 'light', value: '#FFFFFF' },
        "neutral-50": { name: 'neutral-50', value: '#F6F7F8' },
        dark: { name: 'dark', value: '#16181D' }
      }
    },
    layout: 'centered',
  },

  initialGlobals: {
    backgrounds: {
      value: 'light'
    }
  }
};

export default preview;

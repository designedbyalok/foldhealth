import { SearchIconButton } from './SearchIconButton';

export default {
  title: 'Composed/SearchIconButton',
  component: SearchIconButton,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: { component: 'Icon-only search button: expands into a search input on click. Preset shape used across toolbars.' },
    },
  },
  argTypes: {
    title: {
      control: 'text',
      description: 'Tooltip label.',
      table: { type: { summary: 'string' }, defaultValue: { summary: 'Search' } },
    },
    onClick: {
      action: 'onClick',
      description: 'Click handler.',
      table: { type: { summary: '() => void' } },
    },
    className: {
      control: 'text',
      description: 'Extra class name on the wrapper.',
      table: { type: { summary: 'string' } },
    },
  },
};

export const Playground = {
  args: {
    title: 'Search',
  },
};

import { Link } from './Link';

export default {
  title: 'Core/Link',
  component: Link,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Text-styled clickable link: renders as a `<span>` with underline + primary color; use inline in body copy.',
      },
    },
  },
  argTypes: {
    children: {
      control: 'text',
      description: 'Link text.',
      table: { type: { summary: 'React.ReactNode' } },
    },
    onClick: {
      action: 'onClick',
      description: 'Fires on click.',
      table: { type: { summary: '(event: React.MouseEvent) => void' } },
    },
    className: {
      control: 'text',
      description: 'Extra class on the link element.',
      table: { type: { summary: 'string' } },
    },
  },
};

export const Playground = { args: { children: 'View patient chart' } };

import { Tooltip } from './Tooltip';
import { Button } from '../Button/Button';

export default {
  title: 'Overlays/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Small floating label shown on hover of the wrapped element.',
      },
    },
  },
  argTypes: {
    label: {
      control: 'text',
      description: 'Tooltip text',
      table: { type: { summary: 'string' } },
    },
    placement: {
      control: 'select',
      options: ['top', 'bottom', 'left', 'right'],
      description: 'Placement relative to the trigger',
      table: { type: { summary: "'top' | 'right' | 'bottom' | 'left'" }, defaultValue: { summary: 'top' } },
    },
    className: {
      control: 'text',
      description: 'Extra class on the tooltip element',
      table: { type: { summary: 'string' } },
    },
  },
};

export const Playground = {
  args: { label: 'Delete this row', placement: 'top' },
  render: (args) => (
    <Tooltip {...args}>
      <Button variant="outline">Hover me</Button>
    </Tooltip>
  ),
};

/** Raised: a stronger lift for a card that sits over busy content (e.g. a recipient chip's hover card). */
export const RaisedCard = {
  render: () => (
    <Tooltip variant="card" placement="bottom" align="left" raised label={<span>Patient<br />Amy Phillips · amy89@fold.health</span>}>
      <Button variant="outline">Hover me</Button>
    </Tooltip>
  ),
};

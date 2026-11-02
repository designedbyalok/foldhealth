import { useState } from 'react';
import { IntroCard } from './IntroCard';

const ITEMS = [
  { icon: 'solar:upload-minimalistic-linear', title: 'Upload', description: 'PDF, Word or JSON, many at once.' },
  { icon: 'solar:shield-check-linear', title: 'Review', description: 'Check each item against its source, then approve.' },
  { icon: 'solar:clipboard-list-linear', title: 'Use', description: 'Draft care plan templates from approved protocols.' },
];

export default {
  title: 'Feedback/IntroCard',
  component: IntroCard,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A dismissible explainer at the top of a section: what it is and how it helps, with a few icon points. The host remembers dismissal and offers a help button that brings it back.',
      },
    },
  },
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
    icon: { control: 'text', description: 'Solar icon for the header glyph.' },
  },
};

export const Default = {
  args: {
    icon: 'solar:document-medicine-linear',
    title: 'What are clinical protocols?',
    description: 'Your clients’ clinical practice guidance, turned into structured rules your care team can follow.',
    items: ITEMS,
  },
};

export const Dismissible = {
  render: (args) => {
    const [open, setOpen] = useState(true);
    return open
      ? <IntroCard {...args} onDismiss={() => setOpen(false)} />
      : <button type="button" onClick={() => setOpen(true)}>Show again</button>;
  },
  args: Default.args,
};

export const Steps = {
  args: {
    icon: 'solar:calendar-mark-linear',
    title: 'How episodic templates work',
    description: 'For care that belongs to one event rather than a long-term condition.',
    layout: 'steps',
    items: [
      { icon: 'solar:play-circle-linear', title: 'Starts when applied', description: 'Day 1 is the day it’s applied.' },
      { icon: 'solar:pause-circle-linear', title: 'Pauses other plans', description: 'Their tasks step aside until it ends.' },
      { icon: 'solar:flag-linear', title: 'Ends on its own', description: 'It closes after its last day.' },
    ],
  },
};

export const WithoutItems = {
  args: { icon: 'solar:info-circle-linear', title: 'About this section', description: 'A single sentence explaining what the section is for.' },
};

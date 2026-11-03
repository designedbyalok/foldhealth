import { NoteHoverCard, NoteSummaryCard } from './NoteHoverCard';
import { Link } from '../Link/Link';

const soapNote = {
  noteType: 'SOAP Note',
  badgeLabel: 'Completed',
  badgeTone: 'success',
  statusLabel: 'Signed & Saved',
  title: 'Reviewing Diabetic Conditions',
  meta: 'Created & Signed by: Ivy League on 10/30/2025',
  sections: [
    { label: 'Subjective', text: 'Patient reports acute onset of chest discomfort during exercise.' },
    { label: 'Objective', text: 'ECG performed, results pending.' },
    { label: 'Assessment', text: 'Possible angina, requires further evaluation.' },
    { label: 'Plan', text: 'Schedule stress test and cardiology referral within 2 weeks.' },
  ],
};

export default {
  title: 'Patterns/NoteHoverCard',
  component: NoteSummaryCard,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Summary of a clinical note shown on hover (Figma node 498:57383). `NoteSummaryCard` is the card body; `NoteHoverCard` wraps it in `HoverCard` around a trigger.',
      },
    },
  },
  args: { ...soapNote, onViewNote: () => {}, onViewAll: () => {} },
  argTypes: {
    onViewNote: { action: 'onViewNote' },
    onViewAll: { action: 'onViewAll' },
  },
};

const asPopover = [Story => <div style={{ width: 374, borderRadius: 8, overflow: 'hidden', boxShadow: 'var(--shadow-popover)' }}><Story /></div>];

export const Card = { decorators: asPopover };

export const WithoutLinks = { decorators: asPopover, args: { onViewNote: undefined, onViewAll: undefined } };

export const OnHover = {
  decorators: [Story => <div style={{ padding: 24 }}><Story /></div>],
  render: args => <NoteHoverCard {...args} trigger={<Link>Reviewing Diabetic Conditions</Link>} pinOnClick />,
};

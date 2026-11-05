import { GoalProgress } from './GoalProgress';

export default {
  title: 'Composed/GoalProgress',
  component: GoalProgress,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: { component: 'Goal checklist with pass/fail markers and progress meter. Accepts either a flat list or a Mandatory/Optional structured shape.' },
    },
  },
  argTypes: {
    goalsDetail: {
      control: 'object',
      description: 'Flat list of goals: used by callDetails / DetailDrawer.',
      table: { type: { summary: '{ name, desc, pass }[]' } },
    },
    goals: {
      control: 'object',
      description: 'Structured shape with Mandatory/Optional sections.',
      table: { type: { summary: '{ mandatory, optional, progress, passed, total, mandatoryMet }' } },
    },
  },
};

const GOALS_ALL_FAIL = [
  { name: 'Confirm identity', desc: 'DOB + last 4 SSN', pass: false },
  { name: 'Verify medications', desc: 'Read active med list', pass: false },
  { name: 'Schedule follow-up', desc: 'Within 7 days of discharge', pass: false },
  { name: 'Review discharge instructions', desc: 'Read back to patient', pass: false },
];

const GOALS_MID = [
  { name: 'Confirm identity', desc: 'DOB + last 4 SSN', pass: true },
  { name: 'Verify medications', desc: 'Read active med list', pass: true },
  { name: 'Schedule follow-up', desc: 'Within 7 days of discharge', pass: false },
  { name: 'Review discharge instructions', desc: 'Read back to patient', pass: false },
];

const GOALS_ALL_PASS = [
  { name: 'Confirm identity', desc: 'DOB + last 4 SSN', pass: true },
  { name: 'Verify medications', desc: 'Read active med list', pass: true },
  { name: 'Schedule follow-up', desc: 'Within 7 days of discharge', pass: true },
  { name: 'Review discharge instructions', desc: 'Read back to patient', pass: true },
];

const STRUCTURED_GOALS = {
  mandatory: [
    { name: 'Confirm identity', desc: 'DOB + last 4 SSN', pass: true },
    { name: 'Verify medications', desc: 'Read active med list', pass: true },
  ],
  optional: [
    { name: 'Offer transportation', desc: 'Lyft/Uber voucher', pass: true },
    { name: 'Send educational content', desc: 'Post-discharge PDF', pass: false },
  ],
  progress: 75,
  passed: 3,
  total: 4,
  mandatoryMet: true,
};

export const Playground = {
  args: {
    goalsDetail: GOALS_MID,
  },
};

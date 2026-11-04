import { useState } from 'react';
import { DateTimePicker } from './DateTimePicker';

export default {
  title: 'Forms/DateTimePicker',
  component: DateTimePicker,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Date and time in one popover: the shared Calendar beside hour and minute columns, with Reset and Save. The value is "MM/DD/YYYY, HH:MM" (24-hour); `hour12` shows AM/PM; `autoCommit` applies each pick at once.',
      },
    },
  },
};

function Demo(props) {
  const [value, setValue] = useState('11/04/2026, 09:30');
  return <DateTimePicker label="Follow-up" value={value} onChange={setValue} {...props} />;
}

export const Playground = { render: () => <Demo /> };

/** 12-hour display, days before today disabled. */
export const Hour12WithMin = { render: () => <Demo hour12 minDate={new Date(2026, 10, 4)} /> };

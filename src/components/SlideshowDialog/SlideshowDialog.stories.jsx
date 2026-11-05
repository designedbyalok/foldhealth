import { useState } from 'react';
import { Button } from '../Button/Button';
import { AiInsightIcon } from '../Icon/AiInsightIcon';
import { SlideshowDialog } from './SlideshowDialog';

export default {
  title: 'Overlays/SlideshowDialog',
  component: SlideshowDialog,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'A two-pane walkthrough: steps on the left with an accent bar that fills as the slide autoplays, the current slide on the right with Previous / Next and a primary action. Picking a step or using the arrows stops autoplay; no autoplay under reduced motion.',
      },
    },
  },
};

const preview = text => (
  <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--space-2)', background: 'var(--neutral-0)', border: '0.5px solid var(--neutral-150)' }}>{text}</div>
);

const STEPS = [
  { key: 'appts', icon: 'solar:calendar-mark-linear', title: 'Appointments', summary: 'Missed Annual Wellness Visit is not rebooked.', description: 'Visits missed or cancelled and not yet rebooked.', preview: preview('Missed Annual Wellness Visit • 04/10/2026'), primary: <Button size="sm">Reschedule</Button> },
  { key: 'vitals', icon: 'solar:heart-pulse-linear', title: 'Vitals & Labs', summary: 'Blood Pressure and HbA1c are above goal.', description: 'Latest readings outside the patient’s goals.', preview: preview('Blood Pressure 142/88 mmHg • Goal 120/80'), primary: <Button size="sm">Create Task</Button> },
  { key: 'tasks', icon: 'solar:checklist-minimalistic-linear', title: 'Tasks', summary: '3 tasks are past due.', description: 'Work on this patient past its due date.', preview: preview('3 overdue tasks') },
];

export const Default = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open Recap</Button>
        <SlideshowDialog
          open={open}
          onOpenChange={setOpen}
          leading={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}><AiInsightIcon size={24} />Unity Recap</span>}
          title="What's new with Annette Brave"
          subtitle="2 new since the last touch on 10/21/2026."
          steps={STEPS}
          footerStart={<Button variant="ghost" size="sm" leadingIcon="solar:history-linear">Open Timeline</Button>}
        />
      </>
    );
  },
};
